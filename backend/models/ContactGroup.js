const mongoose = require('mongoose');
const { normalizePhoneNumber } = require('../utils/phone');

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
        phone: { type: String, required: true },
        tags: [{ type: String, trim: true }]
      }
    ]
  },
  {
    timestamps: true
  }
);

const normalizeGroupNumbers = (numbers = [], { skipInvalid = false } = {}) => {
  const seen = new Set();
  const normalized = [];

  for (const entry of numbers) {
    const plain = entry?.toObject ? entry.toObject() : entry;
    const parsed = normalizePhoneNumber(plain?.phone);

    if (!parsed?.e164) {
      const raw = String(plain?.phone || '').trim();
      if (skipInvalid) continue;
      throw new Error(
        raw
          ? `Phone number must be in E.164 format: ${raw}`
          : 'Phone number is required'
      );
    }

    if (seen.has(parsed.e164)) continue;

    seen.add(parsed.e164);
    normalized.push({
      name: String(plain?.name || '').trim(),
      phone: parsed.e164,
      tags: Array.isArray(plain?.tags) ? plain.tags : []
    });
  }

  return normalized;
};

ContactGroupSchema.pre('validate', function normalizeNumbers() {
  if (Array.isArray(this.numbers) && this.numbers.length > 0) {
    this.numbers = normalizeGroupNumbers(this.numbers);
  }
});

module.exports = mongoose.model('ContactGroup', ContactGroupSchema);
module.exports.normalizeGroupNumbers = normalizeGroupNumbers;
