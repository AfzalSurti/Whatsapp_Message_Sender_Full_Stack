const mongoose = require('mongoose');

const ApiKeySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    key: {
      type: String,
      unique: true,
      required: true,
      index: true
    },

    name: {
      type: String,
      required: [true, 'API key name is required'],
      trim: true,
      default: 'My API Key'
    },

    usageCount: {
      type: Number,
      default: 0
    },

    monthlyUsage: {
      type: Number,
      default: 0
    },

    monthlyLimit: {
      type: Number,
      default: 100
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true
    },

    lastUsed: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Compound index for efficient user key lookups
ApiKeySchema.index({ userId: 1, isActive: 1 });

module.exports = mongoose.model('ApiKey', ApiKeySchema);
