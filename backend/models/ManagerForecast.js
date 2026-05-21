const mongoose = require('mongoose');

const managerForecastSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('ManagerForecast', managerForecastSchema);
