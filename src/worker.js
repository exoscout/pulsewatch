const mongoose = require("mongoose");
const { Worker } = require("bullmq");
const config = require("./config");
const { createRedisConnection } = require("./redis");
const Monitor = require("./models/Monitor");
const CheckResult = require("./models/CheckResult");
const { validatePublicHttpUrl } = require("./url-safety");

async function main() {
  await mongoose.connect(config.mongoUri);
  const connection = createRedisConnection();

  const worker = new Worker(config.queueName, async job => {
    if (job.name !== "check") throw new Error(`Unknown job type: ${job.name}`);
    const monitor = await Monitor.findById(job.data.monitorId);
    if (!monitor || !monitor.enabled) return { skipped: true };

    // Revalidate immediately before fetch. Redirects are disabled to avoid redirect-based SSRF.
    const url = await validatePublicHttpUrl(monitor.url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    const startedAt = Date.now();
    let statusCode = null;
    let error = null;
    let status = "down";

    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "PulseWatch/1.0 uptime-monitor" }
      });
      statusCode = response.status;
      status = response.status >= 200 && response.status < 400 ? "up" : "down";
      await response.body?.cancel().catch(() => {});
      if (response.status >= 400) error = `HTTP ${response.status}`;
    } catch (err) {
      error = err.name === "AbortError" ? "Request timed out" : err.message;
    } finally {
      clearTimeout(timeout);
    }

    const checkedAt = new Date();
    const latencyMs = Date.now() - startedAt;
    await CheckResult.create({
      monitorId: monitor._id, status, statusCode, latencyMs, error, checkedAt
    });
    monitor.lastStatus = status;
    monitor.lastCheckedAt = checkedAt;
    monitor.consecutiveFailures = status === "up" ? 0 : monitor.consecutiveFailures + 1;
    await monitor.save();

    return { monitorId: String(monitor._id), status, statusCode, latencyMs, error };
  }, { connection, concurrency: 10 });

  worker.on("completed", (job, result) => console.log(`Check ${job.id} completed`, result));
  worker.on("failed", (job, err) => console.error(`Check ${job?.id} failed:`, err.message));
  worker.on("error", err => console.error("Worker error:", err));
  console.log("PulseWatch worker ready (concurrency=10)");

  async function shutdown(signal) {
    console.log(`${signal}: shutting down worker`);
    await worker.close();
    await connection.quit();
    await mongoose.disconnect();
    process.exit(0);
  }
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch(error => {
  console.error("Worker startup failed:", error);
  process.exit(1);
});
