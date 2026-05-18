const { validationResult } = require('express-validator');
const ScheduledCampaign = require('../models/ScheduledCampaign');
const ContactGroup = require('../models/ContactGroup');

const stripNumber = (num) => num.replace(/\D/g, '');

const createCampaign = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, message, scheduledAt, timezone, groupIds, individualNumbers } = req.body;

    const scheduleTime = new Date(scheduledAt);
    const now = new Date();
    const minTime = new Date(now.getTime() + 60000);

    if (scheduleTime <= minTime) {
      return res.status(400).json({ error: 'Scheduled time must be at least 1 minute in the future' });
    }

    let allNumbers = [];
    const phoneSet = new Set();

    if (groupIds && groupIds.length > 0) {
      const groups = await ContactGroup.find({
        _id: { $in: groupIds },
        userId: req.user._id
      });

      groups.forEach(group => {
        group.numbers.forEach(num => {
          const cleanPhone = stripNumber(num.phone);
          if (!phoneSet.has(cleanPhone)) {
            phoneSet.add(cleanPhone);
            allNumbers.push({
              name: num.name || '',
              phone: cleanPhone,
              groupId: group._id
            });
          }
        });
      });
    }

    if (individualNumbers && individualNumbers.length > 0) {
      individualNumbers.forEach(item => {
        const phone = typeof item === 'string' ? item : item.phone;
        const name = typeof item === 'object' ? (item.name || '') : '';
        const cleanPhone = stripNumber(phone);

        if (cleanPhone.length >= 10 && !phoneSet.has(cleanPhone)) {
          phoneSet.add(cleanPhone);
          allNumbers.push({
            name,
            phone: cleanPhone,
            groupId: null
          });
        }
      });
    }

    if (allNumbers.length === 0) {
      return res.status(400).json({ error: 'No valid phone numbers found' });
    }

    const campaign = await ScheduledCampaign.create({
      userId: req.user._id,
      name: name || 'Untitled Campaign',
      message,
      scheduledAt: scheduleTime,
      timezone: timezone || 'Asia/Kolkata',
      groupIds: groupIds || [],
      individualNumbers: allNumbers,
      totalNumbers: allNumbers.length
    });

    res.status(201).json({ campaign });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getCampaigns = async (req, res) => {
  try {
    const campaigns = await ScheduledCampaign.find({ userId: req.user._id })
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
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json({ campaign });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
  cancelCampaign,
  deleteCampaign
};
