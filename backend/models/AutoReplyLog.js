const mongoose = require('mongoose');

const ConversationMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const AutoReplyLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    contactPhone: {
      type: String,
      required: true,
      trim: true
    },
    contactName: {
      type: String,
      default: '',
      trim: true
    },
    incomingMessage: {
      type: String,
      required: true
    },
    aiReply: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['sent', 'failed', 'skipped'],
      required: true
    },
    failReason: {
      type: String,
      default: ''
    },
    conversationHistory: {
      type: [ConversationMessageSchema],
      default: []
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

AutoReplyLogSchema.index({ userId: 1, createdAt: -1 });
AutoReplyLogSchema.index({ userId: 1, contactPhone: 1, createdAt: -1 });

module.exports = mongoose.model('AutoReplyLog', AutoReplyLogSchema);
