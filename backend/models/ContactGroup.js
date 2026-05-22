const mongoose = require('mongoose');

const ContactGroupSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: [true, 'Group name is required'],
      trim: true
    },
    color: {
      type: String,
      default: '#25D366'
    },
    numbers: [
      {
        name: { type: String, default: '' },
        phone: { type: String, required: true, match: [/^\+[1-9]\d{7,14}$/, 'Phone number must be in E.164 format'] },
        tags: [{ type: String, trim: true }]
      }
    ]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('ContactGroup', ContactGroupSchema);
