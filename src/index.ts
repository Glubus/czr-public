import { loadAppConfig } from "./config.ts";
import { closeDatabase, createDatabase } from "./db/client.ts";
import { createApp } from "./http/app.ts";
import { createRedisStore } from "./infra/redis.ts";
import { createAccountEmail } from "./infra/email.ts";
import { createFileBlobStore } from "./infra/blob-store.ts";

const config = loadAppConfig();
const db = createDatabase();
const redis = config.redisUrl ? await createRedisStore(config.redisUrl) : undefined;
const accountEmail = createAccountEmail(config.email);
const app = createApp({
  db,
  redis,
  docsToken: config.docsToken,
  trustProxy: config.trustProxy,
  accountEmail,
  frontendUrl: config.frontendUrl,
  blobStore: createFileBlobStore(config.clientBlobRoot),
});

console.log(JSON.stringify({
  event: "server_started",
  port: config.port,
  environment: config.environment,
  redis: Boolean(redis),
  trustProxy: config.trustProxy,
}));
const server = Deno.serve({ port: config.port }, app.fetch);
let stopping = false;

async function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log(JSON.stringify({ event: "server_stopping" }));
  await server.shutdown();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  Deno.addSignalListener(signal, () => {
    void shutdown();
  });
}

await server.finished.finally(async () => {
  await redis?.close();
  await closeDatabase(db);
});
