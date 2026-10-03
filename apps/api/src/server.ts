import { loadEnv } from "./config/env.js";
import { createContainer } from "./container.js";
import { createApp } from "./app.js";
const env = loadEnv(),
  container = createContainer(env),
  app = createApp(container, env);
const server = app.listen(env.PORT, "0.0.0.0", (error) => {
  if (error) {
    container.logger.fatal({ err: error }, "Startup failed");
    process.exit(1);
  }
  container.logger.info({ port: env.PORT }, "API listening");
});
let stopping = false;
async function stop(signal: string) {
  if (stopping) return;
  stopping = true;
  container.logger.info({ signal }, "Shutting down");
  const timer = setTimeout(() => process.exit(1), 10000).unref();
  server.close(async () => {
    await container.db.$disconnect();
    clearTimeout(timer);
    process.exit(0);
  });
}
process.on("SIGTERM", () => void stop("SIGTERM"));
process.on("SIGINT", () => void stop("SIGINT"));
