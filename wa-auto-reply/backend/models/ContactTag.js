const mongoose = require('mongoose');

const ContactTagSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40
    },
    category: {
      type: String,
      enum: ['religion', 'relationship', 'gender', 'custom'],
      default: 'custom'
    },
    color: {
      type: String,
      default: '#25D366'
    }
  },
  {
    timestamps: true
  }
);

ContactTagSchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('ContactTag', ContactTagSchema);
