const ScheduledCampaign = require('../models/ScheduledCampaign');
const ContactGroup = require('../models/ContactGroup');

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

          let allNumbers = [];
          const phoneSet = new Set();

          if (campaign.groupIds && campaign.groupIds.length > 0) {
            const groups = await ContactGroup.find({
              _id: { $in: campaign.groupIds }
            });

            groups.forEach(group => {
              group.numbers.forEach(num => {
                const cleanPhone = stripNumber(num.phone);
                if (!phoneSet.has(cleanPhone)) {
                  phoneSet.add(cleanPhone);
                  allNumbers.push(cleanPhone);
                }
              });
            });
          }

          if (campaign.individualNumbers && campaign.individualNumbers.length > 0) {
            campaign.individualNumbers.forEach(item => {
              const cleanPhone = stripNumber(item.phone);
              if (!phoneSet.has(cleanPhone)) {
                phoneSet.add(cleanPhone);
                allNumbers.push(cleanPhone);
              }
            });
          }

          if (allNumbers.length === 0) {
            await ScheduledCampaign.findByIdAndUpdate(campaign._id, {
              status: 'failed',
              failReason: 'No valid phone numbers to send to'
            });
            continue;
          }

          await sendMessages(
            client,
            campaign.userId,
            allNumbers,
            campaign.message,
            async (progress) => {
              await ScheduledCampaign.findByIdAndUpdate(campaign._id, {
                sent: progress.sent,
                failed: progress.failed,
                skipped: progress.skipped
              });
            }
          );

          const final = await ScheduledCampaign.findById(campaign._id);
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
