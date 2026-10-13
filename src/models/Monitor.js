const mongoose = require("mongoose");

const monitorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  url: { type: String, required: true, trim: true, maxlength: 2048 },
  intervalSeconds: { type: Number, default: 300, min: 30, max: 86400 },
  enabled: { type: Boolean, default: true },
  lastStatus: { type: String, enum: ["unknown", "up", "down"], default: "unknown" },
  lastCheckedAt: { type: Date, default: null },
  consecutiveFailures: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

monitorSchema.index({ enabled: 1, lastCheckedAt: 1 });
module.exports = mongoose.model("Monitor", monitorSchema);
