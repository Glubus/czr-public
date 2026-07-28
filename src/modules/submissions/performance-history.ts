import { asc, eq, sql } from "drizzle-orm";
import { Effect } from "effect";
import type { Database } from "../../db/client.ts";
import { performancePointSnapshots, users } from "../../db/schema.ts";
import { NotFoundError } from "../shared/errors.ts";

export function getPerformancePointHistory(db: Database, userId: string) {
  return Effect.tryPromise({
    try: async () => {
      const [user] = await db.select({
        id: users.id,
        performancePoints: users.performancePoints,
      }).from(users).where(eq(users.id, userId)).limit(1);
      if (!user) throw new NotFoundError("user not found");
      const entries = await db.select({
        id: performancePointSnapshots.id,
        points: performancePointSnapshots.points,
        delta: performancePointSnapshots.delta,
        source: performancePointSnapshots.source,
        sourceSubmissionId: performancePointSnapshots.sourceSubmissionId,
        formulaVersion: performancePointSnapshots.formulaVersion,
        recordedAt: performancePointSnapshots.recordedAt,
      }).from(performancePointSnapshots).where(eq(performancePointSnapshots.userId, userId)).orderBy(
        asc(performancePointSnapshots.recordedAt),
        asc(performancePointSnapshots.id),
      );
      return { userId, currentPoints: user.performancePoints, entries };
    },
    catch: (error) => error,
  });
}

export function snapshotDailyPerformancePoints(db: Database) {
  return Effect.tryPromise({
    try: async () => {
      const result = await db.execute<{ count: number }>(sql`
        WITH inserted AS (
          INSERT INTO performance_point_snapshots
            (user_id, points, delta, source, formula_version, metadata, recorded_at)
          SELECT u.id, u.performance_points,
            u.performance_points - COALESCE(previous.points, u.performance_points),
            'daily', 5, '{}'::jsonb, now()
          FROM users u
          LEFT JOIN LATERAL (
            SELECT snapshot.points
            FROM performance_point_snapshots snapshot
            WHERE snapshot.user_id = u.id
            ORDER BY snapshot.recorded_at DESC, snapshot.id DESC
            LIMIT 1
          ) previous ON true
          WHERE u.deleted_at IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM performance_point_snapshots today
              WHERE today.user_id = u.id
                AND today.source = 'daily'
                AND today.recorded_at >= date_trunc('day', now())
            )
          RETURNING id
        ) SELECT count(*)::int AS count FROM inserted
      `);
      return result[0]?.count ?? 0;
    },
    catch: (error) => error,
  });
}
