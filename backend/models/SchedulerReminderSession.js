const mongoose = require('mongoose');

const SchedulerReminderSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ScheduledCampaign',
      required: true,
      index: true
    },
    alertPhoneDigits: {
      type: String,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['awaiting_action', 'awaiting_reschedule'],
      default: 'awaiting_action'
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    }
  },
  { timestamps: true }
);

SchedulerReminderSessionSchema.index({ userId: 1, alertPhoneDigits: 1, expiresAt: 1 });

module.exports = mongoose.model('SchedulerReminderSession', SchedulerReminderSessionSchema);
