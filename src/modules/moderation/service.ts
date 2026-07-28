import { asc, eq, sql } from "drizzle-orm";
import { Effect } from "effect";
import type { Database } from "../../db/client.ts";
import { profileClaims, submissions } from "../../db/schema.ts";

export function moderationOverview(db: Database) {
  return Effect.tryPromise({
    try: async () => {
      const [submissionCounts, claimCounts, oldestPending] = await Promise.all([
        db.select({ status: submissions.status, count: sql<number>`count(*)::int` }).from(submissions)
          .groupBy(submissions.status),
        db.select({ status: profileClaims.status, count: sql<number>`count(*)::int` }).from(profileClaims)
          .groupBy(profileClaims.status),
        db.select({ id: submissions.id, submittedAt: submissions.submittedAt }).from(submissions)
          .where(eq(submissions.status, "pending")).orderBy(asc(submissions.submittedAt)).limit(1),
      ]);
      return {
        submissions: Object.fromEntries(submissionCounts.map((row) => [row.status, row.count])),
        profileClaims: Object.fromEntries(claimCounts.map((row) => [row.status, row.count])),
        oldestPendingSubmission: oldestPending[0] ?? null,
      };
    },
    catch: (error) => error,
  });
}
