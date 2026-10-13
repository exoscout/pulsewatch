const mongoose = require("mongoose");

const checkResultSchema = new mongoose.Schema({
  monitorId: { type: mongoose.Schema.Types.ObjectId, ref: "Monitor", required: true, index: true },
  status: { type: String, enum: ["up", "down"], required: true },
  statusCode: { type: Number, default: null },
  latencyMs: { type: Number, required: true },
  error: { type: String, default: null },
  checkedAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

checkResultSchema.index({ monitorId: 1, checkedAt: -1 });
module.exports = mongoose.model("CheckResult", checkResultSchema);
