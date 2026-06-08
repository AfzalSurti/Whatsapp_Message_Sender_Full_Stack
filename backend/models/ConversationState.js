const mongoose = require('mongoose');

const ConversationMessageSchema = new mongoose.Schema(
  {
    role: { type: String, required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const ConversationStateSchema = new mongoose.Schema(
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
    activeTemplateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AITemplate',
      default: null
    },
    currentStep: {
      type: Number,
      default: 0
    },
    collectedInfo: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    conversationHistory: {
      type: [ConversationMessageSchema],
      default: []
    },
    intentDetectedAt: {
      type: Date,
      default: null
    },
    lastMessageAt: {
      type: Date,
      default: null
    },
    isCompleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: true }
  }
);

ConversationStateSchema.index({ userId: 1, contactPhone: 1 }, { unique: true });
ConversationStateSchema.index({ userId: 1, lastMessageAt: -1 });

module.exports = mongoose.model('ConversationState', ConversationStateSchema);
