import { closeDatabase, createDatabase } from "./db/client.ts";
import { runWorkerCycle } from "./modules/worker/cycle.ts";
import { createFileBlobStore } from "./infra/blob-store.ts";

const pollIntervalMs = parsePositiveInteger(
  Deno.env.get("WORKER_POLL_INTERVAL_MS") ?? "1000",
  "WORKER_POLL_INTERVAL_MS",
);
const db = createDatabase();
const blobStore = createFileBlobStore(Deno.env.get("CLIENT_BLOB_ROOT") ?? "/tmp/zwr-client-blobs");
const abortController = new AbortController();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  Deno.addSignalListener(signal, () => abortController.abort());
}

console.log(JSON.stringify({ event: "worker_started", pollIntervalMs }));

try {
  while (!abortController.signal.aborted) {
    try {
      const result = await runWorkerCycle(db, blobStore);
      if (
        result.expiredParticipationGroups > 0 || result.projectedEvents > 0 ||
        result.deletedClientRunBlobs > 0
      ) {
        console.log(JSON.stringify({ event: "worker_cycle_completed", ...result }));
      }
    } catch (error) {
      console.error(JSON.stringify({
        event: "worker_cycle_failed",
        message: error instanceof Error ? error.message : String(error),
      }));
    }
    await delay(pollIntervalMs, abortController.signal);
  }
} finally {
  console.log(JSON.stringify({ event: "worker_stopping" }));
  await closeDatabase(db);
}

function parsePositiveInteger(value: string, name: string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function delay(milliseconds: number, signal: AbortSignal) {
  if (signal.aborted) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, milliseconds);
    signal.addEventListener("abort", () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}
