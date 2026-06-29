const mongoose = require('mongoose');

const BaileysAuthKeySchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    fileKey: {
      type: String,
      required: true
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    }
  },
  {
    timestamps: true
  }
);

BaileysAuthKeySchema.index({ userId: 1, fileKey: 1 }, { unique: true });

module.exports = mongoose.model('BaileysAuthKey', BaileysAuthKeySchema);
