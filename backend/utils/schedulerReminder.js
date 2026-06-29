const User = require('../models/User');
const Session = require('../models/Session');
const { normalizePhoneNumber } = require('./phone');
const { sendMessageWithFooter } = require('./sendMessageWithFooter');
const { toBaileysJid } = require('./baileysAdapter');
const { getOrCreateBusinessProfile } = require('./businessProfile');
const { resolveMessageFooter } = require('./messageFooter');

const stripNumber = (value) => String(value || '').replace(/\D/g, '');

const normalizeAlertPhone = (value) => {
  if (!value) return null;
  const normalized = normalizePhoneNumber(value);
  return normalized?.e164 || null;
};

const resolveSchedulerAlertPhone = async (userId, {
  campaignReminderPhone = null,
  connectedPhone = null
} = {}) => {
  const override = normalizeAlertPhone(campaignReminderPhone);
  if (override) return override;

  const user = await User.findById(userId).select('schedulerAlertPhone').lean();
  const fromUser = normalizeAlertPhone(user?.schedulerAlertPhone);
  if (fromUser) return fromUser;

  const fromConnected = normalizeAlertPhone(connectedPhone);
  if (fromConnected) return fromConnected;

  const session = await Session.findOne({ userId }).select('phoneNumber').lean();
  return normalizeAlertPhone(session?.phoneNumber);
};

const buildReminderMessage = (campaign, minutesBefore) => {
  const scheduled = new Date(campaign.scheduledAt);
  const timeLabel = scheduled.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: campaign.timezone || 'Asia/Kolkata'
  });

  return [
    '⏰ *Scheduled campaign reminder*',
    '',
    `*Campaign:* ${campaign.name || 'Untitled Campaign'}`,
    `*Starts in:* ${minutesBefore} minute${minutesBefore === 1 ? '' : 's'}`,
    `*Scheduled at:* ${timeLabel}`,
    `*Recipients:* ${campaign.totalNumbers || 0}`,
    '',
    'Your campaign will start automatically. Make sure WhatsApp stays connected.'
  ].join('\n');
};

const sendSchedulerReminder = async (client, userId, phone, message) => {
  const cleanNumber = stripNumber(phone);
  if (cleanNumber.length < 10) {
    throw new Error('Invalid scheduler alert phone number');
  }

  const businessProfile = await getOrCreateBusinessProfile(userId);
  const messageFooter = resolveMessageFooter(businessProfile);
  await sendMessageWithFooter(client, toBaileysJid(cleanNumber), message, messageFooter);
};

const ensureDefaultSchedulerAlertPhone = async (userId, connectedPhone) => {
  const normalized = normalizeAlertPhone(connectedPhone);
  if (!normalized) return;

  await User.findOneAndUpdate(
    {
      _id: userId,
      $or: [{ schedulerAlertPhone: null }, { schedulerAlertPhone: '' }]
    },
    { $set: { schedulerAlertPhone: normalized } }
  );
};

module.exports = {
  normalizeAlertPhone,
  resolveSchedulerAlertPhone,
  buildReminderMessage,
  sendSchedulerReminder,
  ensureDefaultSchedulerAlertPhone
};
