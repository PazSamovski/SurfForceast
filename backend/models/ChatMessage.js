const mongoose = require('mongoose');

const CHAT_SPOT_NAMES = ['Netanya', 'Tel Aviv', 'Haifa', 'Ashdod'];

const chatMessageSchema = new mongoose.Schema(
  {
    spot: {
      type: String,
      required: true,
      enum: CHAT_SPOT_NAMES,
    },
    user: {
      type: String,
      required: true,
      trim: true,
      default: 'Local Surfer',
    },
    message: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    versionKey: false,
  }
);

chatMessageSchema.index({ spot: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
