import { and, eq, inArray, or } from "drizzle-orm";
import type { Database } from "../../db/client.ts";
import { bestRecords, clientRuns, submissions } from "../../db/schema.ts";
import { type BlobStore, clientRunPrefix } from "../../infra/blob-store.ts";

const TERMINAL_SUBMISSION_STATUSES = new Set(["verified", "rejected", "cancelled"]);

export async function cleanupClientRunBlobs(db: Database, blobStore: BlobStore, limit = 100) {
  const runs = await db.select().from(clientRuns).where(or(
    and(eq(clientRuns.status, "finalized"), eq(clientRuns.blobState, "retained")),
    and(inArray(clientRuns.status, ["finalized", "abandoned"]), eq(clientRuns.blobState, "active")),
  )).limit(limit);
  let deleted = 0;

  for (const run of runs) {
    if (run.blobState === "retained" && run.submissionGroupId) {
      const group = await db.select({ id: submissions.id, status: submissions.status }).from(submissions)
        .where(eq(submissions.submissionGroupId, run.submissionGroupId));
      if (group.length === 0 || group.some((entry) => !TERMINAL_SUBMISSION_STATUSES.has(entry.status))) {
        continue;
      }
      const records = await db.select({ submissionId: bestRecords.submissionId }).from(bestRecords).where(
        inArray(bestRecords.submissionId, group.map((entry) => entry.id)),
      ).limit(1);
      if (records.length > 0) continue;
    }

    await blobStore.deletePrefix(clientRunPrefix(run.id));
    const updated = await db.update(clientRuns).set({
      blobState: "deleted",
      blobsDeletedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(eq(clientRuns.id, run.id), eq(clientRuns.blobState, run.blobState))).returning({
      id: clientRuns.id,
    });
    deleted += updated.length;
  }

  return deleted;
}
