const mongoose = require('mongoose');

const DEFAULT_FOOTER_SEPARATOR = '───────────────';

const BusinessProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },

    businessName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120
    },

    footerText: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200
    },

    footerEnabled: {
      type: Boolean,
      default: false
    },

    footerSeparator: {
      type: String,
      default: DEFAULT_FOOTER_SEPARATOR,
      trim: true,
      maxlength: 40
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('BusinessProfile', BusinessProfileSchema);
module.exports.DEFAULT_FOOTER_SEPARATOR = DEFAULT_FOOTER_SEPARATOR;
