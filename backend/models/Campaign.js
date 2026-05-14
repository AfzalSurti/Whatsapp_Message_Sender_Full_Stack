const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema(
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
      required: true
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

    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      default: 'pending'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Campaign', CampaignSchema);