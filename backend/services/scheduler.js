const ScheduledCampaign = require('../models/ScheduledCampaign');
const ContactGroup = require('../models/ContactGroup');
const { buildRecipientMessage } = require('../utils/template');
const {
  resolveSchedulerAlertPhone,
  buildReminderMessage,
  sendSchedulerReminder
} = require('../utils/schedulerReminder');

const stripNumber = (num) => num.replace(/\D/g, '');

const processDueReminders = async (clientManager) => {
  const now = new Date();

  const reminderCampaigns = await ScheduledCampaign.find({
    status: 'pending',
    reminderEnabled: true,
    reminderSentAt: null,
    scheduledAt: { $gt: now }
  });

  for (const campaign of reminderCampaigns) {
    const minutesBefore = campaign.reminderMinutesBefore || 5;
    const reminderAt = new Date(campaign.scheduledAt.getTime() - minutesBefore * 60 * 1000);

    if (now < reminderAt) continue;

    try {
      const client = await clientManager.getOrRestoreReadyClient(campaign.userId, {
        maxWaitMs: 45000
      });

      if (!client?.info) {
        console.warn(`Scheduler reminder skipped for ${campaign._id}: WhatsApp not connected`);
        continue;
      }

      const connectedPhone = clientManager.getConnectedPhoneNumber(campaign.userId);
      const alertPhone = await resolveSchedulerAlertPhone(campaign.userId, {
        campaignReminderPhone: campaign.reminderPhone,
        connectedPhone
      });

      if (!alertPhone) {
        console.warn(`Scheduler reminder skipped for ${campaign._id}: no alert phone configured`);
        continue;
      }

      const text = buildReminderMessage(campaign, minutesBefore);
      await sendSchedulerReminder(client, campaign.userId, alertPhone, text);

      await ScheduledCampaign.findByIdAndUpdate(campaign._id, {
        reminderSentAt: new Date()
      });

      console.log(`📬 Scheduler reminder sent for campaign ${campaign._id} to ${alertPhone}`);
    } catch (error) {
      console.error(`Scheduler reminder failed for ${campaign._id}:`, error.message);
    }
  }
};

const processDueCampaigns = async (sendMessages, clientManager) => {
  const now = new Date();
  const dueCampaigns = await ScheduledCampaign.find({
    status: 'pending',
    scheduledAt: { $lte: now }
  });

  for (const campaign of dueCampaigns) {
    try {
      await ScheduledCampaign.findByIdAndUpdate(campaign._id, { status: 'running' });

      const client = await clientManager.getOrRestoreReadyClient(campaign.userId, {
        maxWaitMs: 60000
      });

      if (!client || !client.info) {
        await ScheduledCampaign.findByIdAndUpdate(campaign._id, {
          status: 'failed',
          failReason: 'WhatsApp not connected at scheduled time'
        });
        continue;
      }

      const recipients = [];
      const phoneSet = new Set();
      const groupNameById = new Map();

      if (campaign.groupIds && campaign.groupIds.length > 0) {
        const groups = await ContactGroup.find({
          _id: { $in: campaign.groupIds }
        });

        groups.forEach((group) => {
          groupNameById.set(String(group._id), group.name);
          group.numbers.forEach((num) => {
            const cleanPhone = stripNumber(num.phone);
            if (!phoneSet.has(cleanPhone)) {
              phoneSet.add(cleanPhone);
              recipients.push({
                name: num.name || '',
                phone: cleanPhone,
                segment: group.name
              });
            }
          });
        });
      }

      if (campaign.individualNumbers && campaign.individualNumbers.length > 0) {
        campaign.individualNumbers.forEach((item) => {
          const cleanPhone = stripNumber(item.phone);
          if (!phoneSet.has(cleanPhone)) {
            phoneSet.add(cleanPhone);
            recipients.push({
              name: item.name || '',
              phone: cleanPhone,
              segment: groupNameById.get(String(item.groupId)) || item.segment || ''
            });
          }
        });
      }

      if (recipients.length === 0) {
        await ScheduledCampaign.findByIdAndUpdate(campaign._id, {
          status: 'failed',
          failReason: 'No valid phone numbers to send to'
        });
        continue;
      }

      const templateVariables = campaign.templateVariables instanceof Map
        ? Object.fromEntries(campaign.templateVariables)
        : (campaign.templateVariables || {});

      const personalizedRecipients = recipients.map((recipient) => ({
        phone: recipient.phone,
        message: buildRecipientMessage(campaign.message, recipient, templateVariables)
      }));

      await sendMessages(
        client,
        campaign.userId,
        personalizedRecipients,
        null,
        async (progress) => {
          await ScheduledCampaign.findByIdAndUpdate(campaign._id, {
            sent: progress.sent,
            failed: progress.failed,
            skipped: progress.skipped
          });
        }
      );

      await ScheduledCampaign.findByIdAndUpdate(campaign._id, {
        status: 'completed'
      });
    } catch (error) {
      console.error(`Error executing campaign ${campaign._id}:`, error.message);
      await ScheduledCampaign.findByIdAndUpdate(campaign._id, {
        status: 'failed',
        failReason: error.message
      });
    }
  }
};

const startScheduler = (sendMessages, clientManager) => {
  setInterval(async () => {
    try {
      await processDueReminders(clientManager);
      await processDueCampaigns(sendMessages, clientManager);
    } catch (error) {
      console.error('Scheduler error:', error.message);
    }
  }, 60000);
};

module.exports = { startScheduler };
