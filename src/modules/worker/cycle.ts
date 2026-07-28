import type { Database } from "../../db/client.ts";
import { cleanupExpiredParticipationInvitations } from "../submissions/participation-invitations.ts";
import { projectPendingOutbox } from "../social/outbox.ts";
import type { BlobStore } from "../../infra/blob-store.ts";
import { cleanupClientRunBlobs } from "../client-ingestion/blob-cleanup.ts";
import { snapshotDailyPerformancePoints } from "../submissions/performance-history.ts";
import { Effect } from "effect";

let lastPerformanceSnapshotDay: string | null = null;

export async function runWorkerCycle(db: Database, blobStore: BlobStore) {
  const expiredParticipationGroups = await cleanupExpiredParticipationInvitations(db);
  const projectedEvents = await projectPendingOutbox(db);
  const deletedClientRunBlobs = await cleanupClientRunBlobs(db, blobStore);
  const today = new Date().toISOString().slice(0, 10);
  const dailyPerformanceSnapshots = lastPerformanceSnapshotDay === today
    ? 0
    : await Effect.runPromise(snapshotDailyPerformancePoints(db));
  lastPerformanceSnapshotDay = today;
  void dailyPerformanceSnapshots;
  return { expiredParticipationGroups, projectedEvents, deletedClientRunBlobs };
}
