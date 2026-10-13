const IORedis = require("ioredis");
const config = require("./config");

function createRedisConnection() {
  return new IORedis({
    host: config.redisHost,
    port: config.redisPort,
    password: config.redisPassword,
    maxRetriesPerRequest: null
  });
}

module.exports = { createRedisConnection };
