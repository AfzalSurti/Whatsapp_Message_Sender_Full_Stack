const mongoose = require('mongoose');

const CustomFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, default: '', trim: true },
    value: { type: String, default: '', trim: true }
  },
  { _id: false }
);

const MediaFileSchema = new mongoose.Schema(
  {
    name: { type: String, default: '', trim: true },
    mimeType: { type: String, default: '', trim: true },
    dataUrl: { type: String, default: '' },
    caption: { type: String, default: '', trim: true }
  },
  { _id: false }
);

const ExampleConversationSchema = new mongoose.Schema(
  {
    userMessage: { type: String, default: '', trim: true },
    botReply: { type: String, default: '', trim: true },
    mediaFiles: { type: [MediaFileSchema], default: [] }
  },
  { _id: false }
);

const SharedDocumentSchema = new mongoose.Schema(
  {
    name: { type: String, default: '', trim: true },
    keywords: { type: [String], default: [] },
    mimeType: { type: String, default: '', trim: true },
    dataUrl: { type: String, default: '' },
    caption: { type: String, default: '', trim: true }
  },
  { _id: false }
);

const AITemplateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    customFields: {
      type: [CustomFieldSchema],
      default: []
    },
    exampleConversations: {
      type: [ExampleConversationSchema],
      default: []
    },
    aiAdvice: {
      type: String,
      default: '',
      trim: true,
      maxlength: 4000
    },
    sharedDocuments: {
      type: [SharedDocumentSchema],
      default: []
    },
    priority: {
      type: Number,
      default: 1,
      min: 1,
      max: 100
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isExample: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: true }
  }
);

AITemplateSchema.index({ userId: 1, isActive: 1, priority: 1 });

module.exports = mongoose.model('AITemplate', AITemplateSchema);
