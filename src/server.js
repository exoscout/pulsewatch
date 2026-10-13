const mongoose = require("mongoose");
const app = require("./app");
const config = require("./config");
const { queue, connection } = require("./queue");

async function main() {
  await mongoose.connect(config.mongoUri);
  const server = app.listen(config.port, () => {
    console.log(`PulseWatch API listening on http://localhost:${config.port}`);
  });

  async function shutdown(signal) {
    console.log(`${signal}: shutting down API`);
    server.close(async () => {
      await queue.close();
      await connection.quit();
      await mongoose.disconnect();
      process.exit(0);
    });
  }
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch(error => {
  console.error("API startup failed:", error);
  process.exit(1);
});
