const mongoose = require('mongoose');

const MessageLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      default: null
    },

    number: {
      type: String,
      required: true
    },

    message: {
      type: String,
      required: true
    },

    status: {
      type: String,
      enum: ['sent', 'failed', 'skipped'],  // only these values
      required: true
    },

    failReason: {
      type: String,
      default: null    // stores why it failed if status is failed
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('MessageLog', MessageLogSchema);