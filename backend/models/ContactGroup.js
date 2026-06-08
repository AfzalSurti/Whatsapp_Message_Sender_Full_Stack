const mongoose = require('mongoose');
const { normalizePhoneNumber } = require('../utils/phone');

const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

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

ContactGroupSchema.pre('save', function normalizeNumbers(next) {
  if (!Array.isArray(this.numbers) || this.numbers.length === 0) {
    return next();
  }

  this.numbers = this.numbers.map((entry) => {
    const plain = entry?.toObject ? entry.toObject() : entry;
    const normalized = normalizePhoneNumber(plain?.phone);
    return {
      name: String(plain?.name || '').trim(),
      phone: normalized?.e164 || String(plain?.phone || '').trim(),
      tags: Array.isArray(plain?.tags) ? plain.tags : []
    };
  });

  const invalid = this.numbers.find((entry) => !E164_PATTERN.test(entry.phone));
  if (invalid) {
    return next(new Error(`Phone number must be in E.164 format: ${invalid.phone}`));
  }

  return next();
});

module.exports = mongoose.model('ContactGroup', ContactGroupSchema);
