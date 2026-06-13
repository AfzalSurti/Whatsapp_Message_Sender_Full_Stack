const mongoose = require('mongoose');

const AutoReplyConfigSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    isEnabled: {
      type: Boolean,
      default: false
    },
    mode: {
      type: String,
      enum: ['smart', 'all', 'selected'],
      default: 'smart'
    },
    selectedContacts: {
      type: [String],
      default: []
    },
    systemPrompt: {
      type: String,
      default: 'You are a helpful WhatsApp assistant. Reply naturally and concisely.',
      trim: true,
      maxlength: 2000
    },
    delay: {
      type: Number,
      default: 2000,
      min: 1000,
      max: 10000
    },
    enabledTemplateIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AITemplate' }],
      default: []
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: true }
  }
);

module.exports = mongoose.model('AutoReplyConfig', AutoReplyConfigSchema);
