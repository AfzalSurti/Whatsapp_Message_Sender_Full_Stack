const mongoose = require('mongoose');

const ScheduledCampaignSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      default: 'Untitled Campaign'
    },
    message: {
      type: String,
      required: [true, 'Message is required']
    },
    scheduledAt: {
      type: Date,
      required: [true, 'Scheduled time is required']
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata'
    },
    groupIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ContactGroup'
      }
    ],
    individualNumbers: [
      {
        name: String,
        phone: String,
        groupId: {
          type: mongoose.Schema.Types.ObjectId,
          default: null
        }
      }
    ],
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
      default: 'pending'
    },
    totalNumbers: {
      type: Number,
      default: 0
    },
    sent: {
      type: Number,
      default: 0
    },
    failed: {
      type: Number,
      default: 0
    },
    skipped: {
      type: Number,
      default: 0
    },
    failReason: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('ScheduledCampaign', ScheduledCampaignSchema);
