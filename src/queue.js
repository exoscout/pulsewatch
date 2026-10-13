const { Queue } = require("bullmq");
const config = require("./config");
const { createRedisConnection } = require("./redis");

const connection = createRedisConnection();
const queue = new Queue(config.queueName, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { age: 86400, count: 2000 },
    removeOnFail: { age: 604800 }
  }
});

module.exports = { queue, connection };
