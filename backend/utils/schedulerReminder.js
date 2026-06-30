const User = require('../models/User');
const Session = require('../models/Session');
const { normalizePhoneNumber } = require('./phone');

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
  ensureDefaultSchedulerAlertPhone
};
