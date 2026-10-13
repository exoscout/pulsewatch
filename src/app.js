const express = require("express");
const Monitor = require("./models/Monitor");
const CheckResult = require("./models/CheckResult");
const { queue } = require("./queue");
const { validatePublicHttpUrl } = require("./url-safety");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));

app.get("/health", async (_req, res) => {
  try {
    await queue.client.ping();
    res.json({ status: "ok", queue: queue.name, database: "connected" });
  } catch {
    res.status(503).json({ status: "degraded" });
  }
});

app.post("/monitors", async (req, res, next) => {
  try {
    const { name, url, intervalSeconds = 300 } = req.body || {};
    if (typeof name !== "string" || !name.trim() || name.length > 100) {
      return res.status(400).json({ error: "name must be a non-empty string up to 100 characters" });
    }
    if (typeof url !== "string" || url.length > 2048) {
      return res.status(400).json({ error: "url must be a string up to 2048 characters" });
    }
    if (!Number.isInteger(intervalSeconds) || intervalSeconds < 30 || intervalSeconds > 86400) {
      return res.status(400).json({ error: "intervalSeconds must be between 30 and 86400" });
    }
    let safeUrl;
    try { safeUrl = await validatePublicHttpUrl(url); }
    catch (error) { return res.status(400).json({ error: error.message }); }

    const monitor = await Monitor.create({ name: name.trim(), url: safeUrl, intervalSeconds });
    const job = await queue.add("check", { monitorId: String(monitor._id) }, {
      jobId: `monitor-${monitor._id}-${Date.now()}`
    });
    res.status(201).json({ monitor, initialCheckJobId: job.id });
  } catch (error) { next(error); }
});

app.get("/monitors", async (_req, res, next) => {
  try {
    const monitors = await Monitor.find().sort({ createdAt: -1 }).lean();
    res.json({ count: monitors.length, monitors });
  } catch (error) { next(error); }
});

app.get("/monitors/:id", async (req, res, next) => {
  try {
    const monitor = await Monitor.findById(req.params.id).lean();
    if (!monitor) return res.status(404).json({ error: "Monitor not found" });
    res.json(monitor);
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ error: "Invalid monitor ID" });
    next(error);
  }
});

app.post("/monitors/:id/check", async (req, res, next) => {
  try {
    const monitor = await Monitor.findById(req.params.id);
    if (!monitor) return res.status(404).json({ error: "Monitor not found" });
    const job = await queue.add("check", { monitorId: String(monitor._id) }, {
      jobId: `manual-${monitor._id}-${Date.now()}`
    });
    res.status(202).json({ accepted: true, jobId: job.id });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ error: "Invalid monitor ID" });
    next(error);
  }
});

app.get("/monitors/:id/history", async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit || "50", 10) || 50, 1), 200);
    const results = await CheckResult.find({ monitorId: req.params.id })
      .sort({ checkedAt: -1 }).limit(limit).lean();
    res.json({ count: results.length, results });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ error: "Invalid monitor ID" });
    next(error);
  }
});

app.delete("/monitors/:id", async (req, res, next) => {
  try {
    const monitor = await Monitor.findByIdAndDelete(req.params.id);
    if (!monitor) return res.status(404).json({ error: "Monitor not found" });
    await CheckResult.deleteMany({ monitorId: monitor._id });
    res.status(204).end();
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ error: "Invalid monitor ID" });
    next(error);
  }
});

app.get("/stats", async (_req, res, next) => {
  try {
    const [monitorCount, upCount, downCount, queueCounts] = await Promise.all([
      Monitor.countDocuments(),
      Monitor.countDocuments({ lastStatus: "up" }),
      Monitor.countDocuments({ lastStatus: "down" }),
      queue.getJobCounts("waiting", "active", "completed", "failed", "delayed")
    ]);
    res.json({ monitors: { total: monitorCount, up: upCount, down: downCount }, queue: queueCounts });
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
