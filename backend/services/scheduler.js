const ScheduledCampaign = require('../models/ScheduledCampaign');
const ContactGroup = require('../models/ContactGroup');
const { buildRecipientMessage } = require('../utils/template');

const stripNumber = (num) => num.replace(/\D/g, '');

const startScheduler = (sendMessages, clientManager) => {
  setInterval(async () => {
    try {
      const now = new Date();
      const dueCampaigns = await ScheduledCampaign.find({
        status: 'pending',
        scheduledAt: { $lte: now }
      });

      for (const campaign of dueCampaigns) {
        try {
          await ScheduledCampaign.findByIdAndUpdate(campaign._id, { status: 'running' });

          const client = clientManager.getClient(campaign.userId);
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
    } catch (error) {
      console.error('Scheduler error:', error.message);
    }
  }, 60000);
};

module.exports = { startScheduler };
