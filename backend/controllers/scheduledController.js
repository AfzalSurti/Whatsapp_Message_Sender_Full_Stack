const { validationResult } = require('express-validator');
const ScheduledCampaign = require('../models/ScheduledCampaign');
const ContactGroup = require('../models/ContactGroup');
const MessageTemplate = require('../models/MessageTemplate');
const { validateScheduleVariables } = require('../utils/template');
const { normalizePhoneNumber, getPhoneValidationError } = require('../utils/phone');
const { collectContactsByTags } = require('../utils/contactSegments');
const { getSafeErrorMessage } = require('../utils/safeError');
const { normalizeAlertPhone } = require('../utils/schedulerReminder');

const stripNumber = (num) => num.replace(/\D/g, '');

const resolveCampaignRecipients = async (userId, {
  groupIds,
  individualNumbers,
  segmentTags
}) => {
  let allNumbers = [];
  const phoneSet = new Set();
  const userGroups = await ContactGroup.find({ userId });

  if (segmentTags && segmentTags.length > 0) {
    collectContactsByTags(userGroups, segmentTags).forEach((entry) => {
      if (!phoneSet.has(entry.phone)) {
        phoneSet.add(entry.phone);
        allNumbers.push(entry);
      }
    });
  }

  if (groupIds && groupIds.length > 0) {
    const groups = userGroups.filter((g) =>
      groupIds.some((id) => String(id) === String(g._id))
    );

    groups.forEach((group) => {
      group.numbers.forEach((num) => {
        const cleanPhone = stripNumber(num.phone);
        if (!phoneSet.has(cleanPhone)) {
          phoneSet.add(cleanPhone);
          const entryTags = (num.tags || []).filter(Boolean);
          allNumbers.push({
            name: num.name || '',
            phone: cleanPhone,
            groupId: group._id,
            segment: entryTags.length > 0 ? entryTags.join(', ') : group.name
          });
        }
      });
    });
  }

  if (individualNumbers && individualNumbers.length > 0) {
    individualNumbers.forEach((item) => {
      const phone = typeof item === 'string' ? item : item.phone;
      const name = typeof item === 'object' ? (item.name || '') : '';
      const normalized = normalizePhoneNumber(phone);

      if (!normalized) {
        return;
      }

      const cleanPhone = stripNumber(normalized.e164);
      if (!phoneSet.has(cleanPhone)) {
        phoneSet.add(cleanPhone);
        allNumbers.push({
          name,
          phone: cleanPhone,
          groupId: null,
          segment: ''
        });
      }
    });
  }

  return allNumbers;
};

const resolveCampaignMessage = async (userId, { message, templateId, templateVariables = {} }) => {
  let resolvedMessage = message ? String(message).trim() : '';
  let resolvedTemplateId = null;
  let resolvedTemplateVariables = {};

  if (templateId) {
    const template = await MessageTemplate.findOne({
      _id: templateId,
      $or: [{ isSystem: true }, { userId }]
    });

    if (!template) {
      return { error: 'Template not found', status: 404 };
    }

    resolvedMessage = template.body;
    resolvedTemplateId = template._id;
  }

  if (!resolvedMessage) {
    return { error: 'Message or template is required', status: 400 };
  }

  if (templateVariables && typeof templateVariables === 'object') {
    resolvedTemplateVariables = Object.fromEntries(
      Object.entries(templateVariables)
        .filter(([key, value]) => key && String(value || '').trim())
        .map(([key, value]) => [key, String(value).trim()])
    );
  }

  return {
    resolvedMessage,
    resolvedTemplateId,
    resolvedTemplateVariables
  };
};

const createCampaign = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      message,
      scheduledAt,
      timezone,
      groupIds,
      individualNumbers,
      segmentTags,
      templateId,
      templateVariables = {},
      sendingSpeed,
      recurrencePattern,
      recurrenceStartDate,
      recurrenceEndDate,
      reminderEnabled,
      reminderMinutesBefore,
      reminderPhone
    } = req.body;

    const scheduleTime = new Date(scheduledAt);
    const now = new Date();
    const minTime = new Date(now.getTime() + 60000);

    if (scheduleTime <= minTime) {
      return res.status(400).json({ error: 'Scheduled time must be at least 1 minute in the future' });
    }

    let resolvedMessage = message ? String(message).trim() : '';
    let resolvedTemplateId = null;
    let resolvedTemplateVariables = {};

    const messageResult = await resolveCampaignMessage(req.user._id, {
      message,
      templateId,
      templateVariables
    });

    if (messageResult.error) {
      return res.status(messageResult.status).json({ error: messageResult.error });
    }

    ({
      resolvedMessage,
      resolvedTemplateId,
      resolvedTemplateVariables
    } = messageResult);

    const allNumbers = await resolveCampaignRecipients(req.user._id, {
      groupIds,
      individualNumbers,
      segmentTags
    });

    if (allNumbers.length === 0) {
      return res.status(400).json({ error: getPhoneValidationError() });
    }

    const variableCheck = validateScheduleVariables(
      resolvedMessage,
      resolvedTemplateVariables,
      allNumbers
    );

    if (!variableCheck.valid) {
      return res.status(400).json({ error: variableCheck.error });
    }

    const resolvedReminderPhone = normalizeAlertPhone(reminderPhone);
    const wantsReminder = reminderEnabled !== false;
    const resolvedReminderMinutes = Number(reminderMinutesBefore) || 5;

    if (wantsReminder) {
      const minutesUntilStart = (scheduleTime.getTime() - now.getTime()) / 60000;
      if (minutesUntilStart < resolvedReminderMinutes + 1) {
        return res.status(400).json({
          error: `Schedule must be at least ${resolvedReminderMinutes + 1} minutes ahead to send a ${resolvedReminderMinutes}-minute reminder`
        });
      }
    }

    const campaign = await ScheduledCampaign.create({
      userId: req.user._id,
      name: name || 'Untitled Campaign',
      message: resolvedMessage,
      templateId: resolvedTemplateId,
      templateVariables: resolvedTemplateVariables,
      scheduledAt: scheduleTime,
      timezone: timezone || 'Asia/Kolkata',
      groupIds: groupIds || [],
      individualNumbers: allNumbers,
      totalNumbers: allNumbers.length,
      sendingSpeed: sendingSpeed || 'safe',
      recurrencePattern: recurrencePattern && recurrencePattern !== 'none' ? recurrencePattern : null,
      recurrenceStartDate:
        recurrencePattern && recurrencePattern !== 'none' && recurrenceStartDate
          ? new Date(recurrenceStartDate)
          : null,
      recurrenceEndDate:
        recurrencePattern && recurrencePattern !== 'none' && recurrenceEndDate
          ? new Date(recurrenceEndDate)
          : null,
      reminderEnabled: wantsReminder,
      reminderMinutesBefore: resolvedReminderMinutes,
      reminderPhone: resolvedReminderPhone,
      reminderSentAt: null
    });

    res.status(201).json({ campaign });
  } catch (err) {
    res.status(500).json({ error: getSafeErrorMessage(err) });
  }
};

const getCampaigns = async (req, res) => {
  try {
    const campaigns = await ScheduledCampaign.find({ userId: req.user._id })
      .populate('templateId', 'name icon category')
      .sort({ scheduledAt: -1 });

    res.json({ campaigns });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await ScheduledCampaign.findOne({
      _id: id,
      userId: req.user._id
    }).populate('templateId', 'name icon category');

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json({ campaign });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateCampaign = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const campaign = await ScheduledCampaign.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (campaign.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending campaigns can be edited' });
    }

    const {
      name,
      message,
      scheduledAt,
      timezone,
      groupIds,
      individualNumbers,
      segmentTags,
      templateId,
      templateVariables = {},
      sendingSpeed,
      recurrencePattern,
      recurrenceStartDate,
      recurrenceEndDate,
      reminderEnabled,
      reminderMinutesBefore,
      reminderPhone
    } = req.body;

    const scheduleTime = new Date(scheduledAt);
    const now = new Date();
    const minTime = new Date(now.getTime() + 60000);

    if (scheduleTime <= minTime) {
      return res.status(400).json({ error: 'Scheduled time must be at least 1 minute in the future' });
    }

    const messageResult = await resolveCampaignMessage(req.user._id, {
      message,
      templateId,
      templateVariables
    });

    if (messageResult.error) {
      return res.status(messageResult.status).json({ error: messageResult.error });
    }

    const { resolvedMessage, resolvedTemplateId, resolvedTemplateVariables } = messageResult;

    const allNumbers = await resolveCampaignRecipients(req.user._id, {
      groupIds,
      individualNumbers,
      segmentTags
    });

    if (allNumbers.length === 0) {
      return res.status(400).json({ error: getPhoneValidationError() });
    }

    const variableCheck = validateScheduleVariables(
      resolvedMessage,
      resolvedTemplateVariables,
      allNumbers
    );

    if (!variableCheck.valid) {
      return res.status(400).json({ error: variableCheck.error });
    }

    const resolvedReminderPhone = normalizeAlertPhone(reminderPhone);
    const wantsReminder = reminderEnabled !== false;
    const resolvedReminderMinutes = Number(reminderMinutesBefore) || campaign.reminderMinutesBefore || 5;

    if (wantsReminder) {
      const minutesUntilStart = (scheduleTime.getTime() - now.getTime()) / 60000;
      if (minutesUntilStart < resolvedReminderMinutes + 1) {
        return res.status(400).json({
          error: `Schedule must be at least ${resolvedReminderMinutes + 1} minutes ahead to send a ${resolvedReminderMinutes}-minute reminder`
        });
      }
    }

    campaign.name = name || 'Untitled Campaign';
    campaign.message = resolvedMessage;
    campaign.templateId = resolvedTemplateId;
    campaign.templateVariables = resolvedTemplateVariables;
    campaign.scheduledAt = scheduleTime;
    campaign.timezone = timezone || campaign.timezone || 'Asia/Kolkata';
    campaign.groupIds = groupIds || [];
    campaign.individualNumbers = allNumbers;
    campaign.totalNumbers = allNumbers.length;
    campaign.sendingSpeed = sendingSpeed || campaign.sendingSpeed || 'safe';
    campaign.recurrencePattern =
      recurrencePattern && recurrencePattern !== 'none' ? recurrencePattern : null;
    campaign.recurrenceStartDate =
      recurrencePattern && recurrencePattern !== 'none' && recurrenceStartDate
        ? new Date(recurrenceStartDate)
        : null;
    campaign.recurrenceEndDate =
      recurrencePattern && recurrencePattern !== 'none' && recurrenceEndDate
        ? new Date(recurrenceEndDate)
        : null;
    campaign.reminderEnabled = wantsReminder;
    campaign.reminderMinutesBefore = resolvedReminderMinutes;
    campaign.reminderPhone = resolvedReminderPhone;
    campaign.reminderSentAt = null;

    await campaign.save();
    await campaign.populate('templateId', 'name icon category');

    res.json({ campaign });
  } catch (err) {
    res.status(500).json({ error: getSafeErrorMessage(err) });
  }
};

const cancelCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await ScheduledCampaign.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (campaign.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending campaigns can be cancelled' });
    }

    campaign.status = 'cancelled';
    await campaign.save();

    res.json({ campaign });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await ScheduledCampaign.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (!['completed', 'cancelled', 'failed'].includes(campaign.status)) {
      return res.status(400).json({ error: 'Can only delete completed, cancelled, or failed campaigns' });
    }

    await ScheduledCampaign.findByIdAndDelete(id);

    res.json({ message: 'Campaign deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createCampaign,
  getCampaigns,
  getCampaign,
  updateCampaign,
  cancelCampaign,
  deleteCampaign
};
