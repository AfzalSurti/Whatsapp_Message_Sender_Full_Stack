const mongoose = require('mongoose');

const PickerContactSnapshotSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    contacts: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    contactCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('PickerContactSnapshot', PickerContactSnapshotSchema);
