const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId, // reference to User
      ref: 'User',
      required: true,
      unique: true       // one session per user
    },

    isActive: {
      type: Boolean,
      default: false     // becomes true after QR scan
    },

    phoneNumber: {
      type: String,
      default: null      // WhatsApp number connected
    },

    lastSeen: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Session', SessionSchema);