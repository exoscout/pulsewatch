require("dotenv").config();

function integer(name, fallback, min = 1) {
  const value = Number.parseInt(process.env[name] ?? String(fallback), 10);
  if (!Number.isInteger(value) || value < min) throw new Error(`${name} must be >= ${min}`);
  return value;
}

module.exports = {
  port: integer("PORT", 3000),
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pulsewatch",
  redisHost: process.env.REDIS_HOST || "127.0.0.1",
  redisPort: integer("REDIS_PORT", 6379),
  redisPassword: process.env.REDIS_PASSWORD || undefined,
  queueName: process.env.QUEUE_NAME || "uptime-checks",
  timeoutMs: integer("CHECK_TIMEOUT_MS", 8000),
  maxResponseBytes: integer("MAX_RESPONSE_BYTES", 1024)
};
