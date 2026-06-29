const ScheduledCampaign = require('../models/ScheduledCampaign');
const SchedulerReminderSession = require('../models/SchedulerReminderSession');
const { getOrCreateBusinessProfile } = require('../utils/businessProfile');
const { resolveMessageFooter } = require('../utils/messageFooter');
const { sendMessageWithFooter } = require('../utils/sendMessageWithFooter');
const { toBaileysJid } = require('../utils/baileysAdapter');
const { resolveMessageContact } = require('../utils/whatsappChat');
const { parseRescheduleDateTime, formatScheduleLabel } = require('../utils/scheduleDateParser');
const {
  normalizeAlertPhone,
  resolveSchedulerAlertPhone
} = require('../utils/schedulerReminder');

const BRAND = 'WA Sender';
const stripNumber = (value) => String(value || '').replace(/\D/g, '');

const signedMessage = (lines) => {
  const body = Array.isArray(lines) ? lines.join('\n') : String(lines);
  return `${body}\n\n— ${BRAND}`;
};

const getDisplayName = async (userId) => {
  const profile = await getOrCreateBusinessProfile(userId);
  const name = String(profile?.businessName || '').trim();
  return name || 'there';
};

const buildReminderMessage = async (userId, campaign, minutesBefore) => {
  const displayName = await getDisplayName(userId);
  const scheduled = new Date(campaign.scheduledAt);
  const dateLabel = formatScheduleLabel(scheduled, campaign.timezone || 'Asia/Kolkata');
  const createdLabel = campaign.createdAt
    ? formatScheduleLabel(new Date(campaign.createdAt), campaign.timezone || 'Asia/Kolkata')
    : dateLabel;

  return signedMessage([
    `Hello ${displayName},`,
    '',
    `You scheduled the campaign *${campaign.name || 'Untitled Campaign'}* on ${createdLabel}.`,
    `It is set for *${dateLabel}* and will activate in *${minutesBefore} minute${minutesBefore === 1 ? '' : 's'}*.`,
    '',
    `Recipients: ${campaign.totalNumbers || 0}`
  ]);
};

const buildFollowUpMessage = () =>
  signedMessage([
    'Do you want to *cancel* this schedule or *reschedule* it?',
    '',
    'Reply with:',
    '• *cancel* or *cancel campaign* to stop it',
    '• *reschedule* to pick a new date and time',
    '',
    'Example for reschedule: `17 May 3:30 PM` or `today 6:00 PM`'
  ]);

const sendPlainReply = async (client, userId, phoneDigits, text) => {
  const businessProfile = await getOrCreateBusinessProfile(userId);
  const messageFooter = resolveMessageFooter(businessProfile);
  await sendMessageWithFooter(client, toBaileysJid(phoneDigits), text, messageFooter);
};

const upsertReminderSession = async (userId, campaign, alertPhone) => {
  const alertPhoneDigits = stripNumber(alertPhone);
  const expiresAt = new Date(new Date(campaign.scheduledAt).getTime() + 10 * 60 * 1000);

  await SchedulerReminderSession.findOneAndUpdate(
    { userId, campaignId: campaign._id },
    {
      userId,
      campaignId: campaign._id,
      alertPhoneDigits,
      status: 'awaiting_action',
      expiresAt
    },
    { upsert: true, returnDocument: 'after' }
  );
};

const sendSchedulerReminderBundle = async (client, userId, phone, campaign, minutesBefore) => {
  const reminderText = await buildReminderMessage(userId, campaign, minutesBefore);
  await sendPlainReply(client, userId, stripNumber(phone), reminderText);
  await sendPlainReply(client, userId, stripNumber(phone), buildFollowUpMessage());
  await upsertReminderSession(userId, campaign, phone);
};

const isCancelIntent = (text) =>
  /^(yes[, ]+)?cancel\b/i.test(text) ||
  /\bcancel(?:led)?(\s+(the\s+)?(campaign|schedule|scheduled))?\b/i.test(text) ||
  /\b(stop|abort)\s+(the\s+)?(campaign|schedule)\b/i.test(text);

const isRescheduleIntent = (text) =>
  /\b(re-?schedule|reschedule|change (the )?(time|date)|postpone|new time|new date)\b/i.test(text);

const isActivateIntent = (text) =>
  /\b(activate|re-?activate|start again|undo cancel|resume)\b/i.test(text);

const phonesMatch = (left, right) => {
  const a = stripNumber(left);
  const b = stripNumber(right);
  if (!a || !b) return false;
  return a === b || a.endsWith(b) || b.endsWith(a);
};

const findOpenSessionForSender = async (userId, senderDigits) => {
  const now = new Date();
  const sessions = await SchedulerReminderSession.find({
    userId,
    expiresAt: { $gt: now }
  }).sort({ updatedAt: -1 });

  return sessions.find((session) => phonesMatch(session.alertPhoneDigits, senderDigits)) || null;
};

const findRecentCancelledCampaign = async (userId, senderDigits) => {
  const alertPhone = await resolveSchedulerAlertPhone(userId);
  if (!phonesMatch(alertPhone, senderDigits)) return null;

  return ScheduledCampaign.findOne({
    userId,
    status: 'cancelled'
  }).sort({ updatedAt: -1 });
};

const handleSchedulerReply = async (client, userId, msg) => {
  const incomingMessage = String(msg.body || '').trim();
  if (!incomingMessage) return false;

  const resolved = await resolveMessageContact(msg);
  const senderDigits = stripNumber(resolved.contactPhone || resolved.chatId);
  if (!senderDigits) return false;

  let session = await findOpenSessionForSender(userId, senderDigits);

  if (!session && isActivateIntent(incomingMessage)) {
    const cancelledCampaign = await findRecentCancelledCampaign(userId, senderDigits);
    if (!cancelledCampaign) return false;

    const now = new Date();
    if (new Date(cancelledCampaign.scheduledAt) <= now) {
      await sendPlainReply(
        client,
        userId,
        senderDigits,
        signedMessage([
          `Campaign *${cancelledCampaign.name}* cannot be activated again because the scheduled time has already passed.`,
          'Please create a new schedule with a future date and time.'
        ])
      );
      return true;
    }

    cancelledCampaign.status = 'pending';
    cancelledCampaign.reminderSentAt = null;
    cancelledCampaign.failReason = null;
    await cancelledCampaign.save();

    await sendPlainReply(
      client,
      userId,
      senderDigits,
      signedMessage([
        `Your campaign *${cancelledCampaign.name}* is active again.`,
        `It will run on *${formatScheduleLabel(new Date(cancelledCampaign.scheduledAt), cancelledCampaign.timezone)}*.`
      ])
    );
    return true;
  }

  if (!session) return false;

  const campaign = await ScheduledCampaign.findOne({
    _id: session.campaignId,
    userId
  });

  if (!campaign) {
    await SchedulerReminderSession.deleteOne({ _id: session._id });
    return false;
  }

  if (campaign.status !== 'pending') {
    if (campaign.status === 'cancelled' && isActivateIntent(incomingMessage)) {
      const now = new Date();
      if (new Date(campaign.scheduledAt) <= now) {
        await sendPlainReply(
          client,
          userId,
          senderDigits,
          signedMessage([
            'This campaign cannot be activated again because the scheduled time has already passed.',
            'Please create a new schedule with a future date and time.'
          ])
        );
        return true;
      }

      campaign.status = 'pending';
      campaign.reminderSentAt = null;
      await campaign.save();
      await sendPlainReply(
        client,
        userId,
        senderDigits,
        signedMessage([
          `Your campaign *${campaign.name}* is active again.`,
          `It will run on *${formatScheduleLabel(new Date(campaign.scheduledAt), campaign.timezone)}*.`
        ])
      );
      await SchedulerReminderSession.deleteOne({ _id: session._id });
      return true;
    }

    await SchedulerReminderSession.deleteOne({ _id: session._id });
    return false;
  }

  if (session.status === 'awaiting_reschedule') {
    const parsed = parseRescheduleDateTime(incomingMessage);
    if (parsed.error) {
      await sendPlainReply(
        client,
        userId,
        senderDigits,
        signedMessage([
          parsed.error,
          '',
          'Please reply like: `17 May 3:30 PM` or `today 6:00 PM`.'
        ])
      );
      return true;
    }

    campaign.scheduledAt = parsed.date;
    campaign.reminderSentAt = null;
    campaign.status = 'pending';
    await campaign.save();

    session.status = 'awaiting_action';
    session.expiresAt = new Date(parsed.date.getTime() + 10 * 60 * 1000);
    await session.save();

    await sendPlainReply(
      client,
      userId,
      senderDigits,
      signedMessage([
        `Your campaign *${campaign.name}* is rescheduled.`,
        `It will activate on *${formatScheduleLabel(parsed.date, campaign.timezone)}*.`
      ])
    );
    return true;
  }

  if (isCancelIntent(incomingMessage)) {
    campaign.status = 'cancelled';
    await campaign.save();
    await SchedulerReminderSession.deleteOne({ _id: session._id });

    await sendPlainReply(
      client,
      userId,
      senderDigits,
      signedMessage([
        `Your campaign schedule for *${campaign.name}* is cancelled.`,
        'Reply *activate* before the original time if you want to turn it back on.'
      ])
    );
    return true;
  }

  if (isRescheduleIntent(incomingMessage)) {
    session.status = 'awaiting_reschedule';
    await session.save();

    await sendPlainReply(
      client,
      userId,
      senderDigits,
      signedMessage([
        'Sure. Please send the new date and time.',
        'Examples: `17 May 3:30 PM`, `today 6:00 PM`, or `tomorrow 10:00 AM`.'
      ])
    );
    return true;
  }

  const maybeReschedule = parseRescheduleDateTime(incomingMessage);
  if (!maybeReschedule.error && (/\d/.test(incomingMessage) || /\b(today|tomorrow)\b/i.test(incomingMessage))) {
    campaign.scheduledAt = maybeReschedule.date;
    campaign.reminderSentAt = null;
    await campaign.save();
    session.expiresAt = new Date(maybeReschedule.date.getTime() + 10 * 60 * 1000);
    await session.save();

    await sendPlainReply(
      client,
      userId,
      senderDigits,
      signedMessage([
        `Your campaign *${campaign.name}* is rescheduled.`,
        `It will activate on *${formatScheduleLabel(maybeReschedule.date, campaign.timezone)}*.`
      ])
    );
    return true;
  }

  await sendPlainReply(
    client,
    userId,
    senderDigits,
    signedMessage([
      'Please reply with *cancel* to cancel the campaign or *reschedule* to change the date and time.'
    ])
  );
  return true;
};

module.exports = {
  buildReminderMessage,
  buildFollowUpMessage,
  sendSchedulerReminderBundle,
  handleSchedulerReply,
  getDisplayName
};
