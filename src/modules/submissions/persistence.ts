import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../../db/client.ts";
import {
  bestRecords,
  categories,
  performancePointSnapshots,
  submissionParticipants,
  submissions,
  users,
} from "../../db/schema.ts";
import { calculatePerformancePoints } from "./performance-points.ts";
import { isBetterRecord, type RankingDirection } from "./ranking.ts";

type PerformanceDatabase = Pick<Database, "execute" | "insert" | "select" | "update">;

type PerformanceSnapshotContext = {
  source: "submission" | "formula_change";
  sourceSubmissionId?: number;
  formulaVersion?: number;
  metadata?: Record<string, unknown>;
};

export async function recalculatePerformancePoints(
  db: PerformanceDatabase,
  userId: string,
  context?: PerformanceSnapshotContext,
) {
  await recalculatePerformancePointsForUsers(db, [userId], context);
}

export async function recalculatePerformancePointsForUsers(
  db: PerformanceDatabase,
  userIds: readonly string[],
  context?: PerformanceSnapshotContext,
) {
  const uniqueUserIds = [...new Set(userIds)];
  if (!uniqueUserIds.length) return;

  const currentPoints = new Map<string, number>();
  const records = [];
  for (let offset = 0; offset < uniqueUserIds.length; offset += 1_000) {
    const batch = uniqueUserIds.slice(offset, offset + 1_000);
    const [currentUsers, currentRecords] = await Promise.all([
      db.select({ id: users.id, points: users.performancePoints }).from(users).where(
        inArray(users.id, batch),
      ),
      db.select({
        userId: submissionParticipants.userId,
        points: bestRecords.points,
        mapId: submissions.mapId,
        assignmentId: submissions.categoryAssignmentId,
        playerCount: submissions.playerCount,
        scoreValue: submissions.scoreValue,
        runDurationMs: submissions.runDurationMs,
        scoreType: categories.scoreType,
        rankingDirection: categories.rankingDirection,
      }).from(submissionParticipants).innerJoin(
        bestRecords,
        eq(submissionParticipants.submissionId, bestRecords.submissionId),
      ).innerJoin(submissions, eq(bestRecords.submissionId, submissions.id))
        .innerJoin(categories, eq(submissions.categoryId, categories.id))
        .where(and(
          inArray(submissionParticipants.userId, batch),
          eq(submissionParticipants.isPersonalBest, true),
        )),
    ]);
    for (const user of currentUsers) currentPoints.set(user.id, user.points);
    records.push(...currentRecords);
  }

  type PerformanceRecord = (typeof records)[number];
  const bestByUser = new Map<string, Map<string, PerformanceRecord>>();
  for (const record of records) {
    const bestByTarget = bestByUser.get(record.userId) ?? new Map<string, PerformanceRecord>();
    const key = `${record.mapId}:${record.assignmentId}:${record.playerCount}`;
    const current = bestByTarget.get(key);
    if (
      !current || isBetterRecord(
        record.scoreValue,
        current.scoreValue,
        record.runDurationMs,
        current.runDurationMs,
        record.scoreType,
        record.rankingDirection,
      )
    ) bestByTarget.set(key, record);
    bestByUser.set(record.userId, bestByTarget);
  }

  const calculated = [...currentPoints].map(([userId, previousPoints]) => {
    const performancePoints = calculatePerformancePoints(
      [...(bestByUser.get(userId)?.values() ?? [])].map((record) => record.points),
    );
    return { userId, previousPoints, performancePoints };
  });
  for (let offset = 0; offset < calculated.length; offset += 1_000) {
    const batch = calculated.slice(offset, offset + 1_000);
    const values = sql.join(
      batch.map((entry) => sql`(${entry.userId}::text, ${entry.performancePoints}::double precision)`),
      sql`, `,
    );
    await db.execute(sql`
      UPDATE ${users} AS account
      SET performance_points = payload.points
      FROM (VALUES ${values}) AS payload(user_id, points)
      WHERE account.id = payload.user_id
    `);
  }

  if (!context) return;
  const snapshots = calculated.filter((entry) =>
    Math.abs(entry.performancePoints - entry.previousPoints) > 0.001
  ).map((entry) => ({
    userId: entry.userId,
    points: entry.performancePoints,
    delta: entry.performancePoints - entry.previousPoints,
    source: context.source,
    sourceSubmissionId: context.sourceSubmissionId ?? null,
    formulaVersion: context.formulaVersion ?? 5,
    metadata: context.metadata ?? {},
  }));
  for (let offset = 0; offset < snapshots.length; offset += 1_000) {
    await db.insert(performancePointSnapshots).values(snapshots.slice(offset, offset + 1_000));
  }
}

export function leaderboardOrderBy(scoreType: string, direction: RankingDirection) {
  if (scoreType === "round") {
    return [
      desc(submissions.scoreValue),
      sql`${submissions.runDurationMs} ASC NULLS LAST`,
      asc(submissions.verifiedAt),
      asc(submissions.id),
    ] as const;
  }

  return direction === "higher_is_better"
    ? [desc(submissions.scoreValue), asc(submissions.verifiedAt), asc(submissions.id)] as const
    : [asc(submissions.scoreValue), asc(submissions.verifiedAt), asc(submissions.id)] as const;
}
