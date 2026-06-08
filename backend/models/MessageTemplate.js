const mongoose = require('mongoose');

const MessageTemplateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true,
      maxlength: 100
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    },
    icon: {
      type: String,
      default: '📋',
      maxlength: 8
    },
    body: {
      type: String,
      required: [true, 'Template body is required'],
      maxlength: 4096
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: 40
      }
    ],
    category: {
      type: String,
      enum: ['eid', 'diwali', 'birthday', 'promo', 'reminder', 'custom', 'ai'],
      default: 'custom'
    },
    languages: [
      {
        type: String,
        trim: true,
        maxlength: 40
      }
    ],
    isSystem: {
      type: Boolean,
      default: false
    },
    defaultVariables: {
      type: Map,
      of: String,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

MessageTemplateSchema.index({ userId: 1, name: 1 });

module.exports = mongoose.model('MessageTemplate', MessageTemplateSchema);
