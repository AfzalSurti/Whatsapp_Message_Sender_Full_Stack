const mongoose = require('mongoose');

const WorkflowStepSchema = new mongoose.Schema(
  {
    step: { type: Number, required: true },
    instruction: { type: String, default: '', trim: true },
    collectField: { type: String, default: '', trim: true },
    isLastStep: { type: Boolean, default: false }
  },
  { _id: false }
);

const AttachedDocumentSchema = new mongoose.Schema(
  {
    name: { type: String, default: '', trim: true },
    content: { type: String, default: '' },
    fileUrl: { type: String, default: '', trim: true }
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
      default: '',
      trim: true,
      maxlength: 500
    },
    intentDescription: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    triggerExamples: {
      type: [String],
      default: []
    },
    initialMessage: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000
    },
    workflowSteps: {
      type: [WorkflowStepSchema],
      default: []
    },
    aiInstructions: {
      type: String,
      default: '',
      trim: true,
      maxlength: 4000
    },
    knowledgeBase: {
      type: String,
      default: '',
      maxlength: 10000
    },
    attachedDocuments: {
      type: [AttachedDocumentSchema],
      default: []
    },
    leadFields: {
      type: [String],
      default: []
    },
    escalationRules: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000
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
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: true }
  }
);

AITemplateSchema.index({ userId: 1, isActive: 1, priority: 1 });

module.exports = mongoose.model('AITemplate', AITemplateSchema);
