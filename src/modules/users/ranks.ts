import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { Effect } from "effect";
import type { Database } from "../../db/client.ts";
import {
  bestRecords,
  categories,
  games,
  submissionParticipants,
  submissions,
  userCategoryPerformance,
  userGamePerformance,
  users,
} from "../../db/schema.ts";
import { calculatePerformancePoints } from "../submissions/performance-points.ts";
import { NotFoundError } from "../shared/errors.ts";

type ScopedRankRow = {
  scope: "game" | "category";
  id: number;
  slug: string;
  name: string;
  rank: number;
  totalPlayers: number;
  performancePoints: number;
  recordCount: number;
};

export function getUserScopedRanks(db: Database, userId: string) {
  return Effect.tryPromise({
    try: async () => {
      const [user] = await db.select({ id: users.id }).from(users).where(
        and(eq(users.id, userId), isNull(users.deletedAt)),
      ).limit(1);
      if (!user) throw new NotFoundError("user not found");

      const rows = await db.execute<ScopedRankRow>(sql`
        SELECT 'game'::text AS scope, game.id, game.slug, game.name,
          ranked.higher_players + 1 AS rank,
          ranked.total_players AS "totalPlayers",
          target.performance_points AS "performancePoints",
          target.record_count AS "recordCount"
        FROM ${userGamePerformance} target
        JOIN ${games} game ON game.id = target.game_id
        CROSS JOIN LATERAL (
          SELECT
            count(*) FILTER (WHERE
                competitor.performance_points > target.performance_points
                OR (
                  competitor.performance_points = target.performance_points
                  AND competitor.user_id < target.user_id
                )
            )::int AS higher_players,
            count(*)::int AS total_players
          FROM ${userGamePerformance} competitor
          JOIN ${users} ranked_user ON ranked_user.id = competitor.user_id
          WHERE competitor.game_id = target.game_id
            AND ranked_user.deleted_at IS NULL
        ) ranked
        WHERE target.user_id = ${userId}

        UNION ALL

        SELECT 'category'::text AS scope, category.id, category.slug, category.name,
          ranked.higher_players + 1 AS rank,
          ranked.total_players AS "totalPlayers",
          target.performance_points AS "performancePoints",
          target.record_count AS "recordCount"
        FROM ${userCategoryPerformance} target
        JOIN ${categories} category ON category.id = target.category_id
        CROSS JOIN LATERAL (
          SELECT
            count(*) FILTER (WHERE
                competitor.performance_points > target.performance_points
                OR (
                  competitor.performance_points = target.performance_points
                  AND competitor.user_id < target.user_id
                )
            )::int AS higher_players,
            count(*)::int AS total_players
          FROM ${userCategoryPerformance} competitor
          JOIN ${users} ranked_user ON ranked_user.id = competitor.user_id
          WHERE competitor.category_id = target.category_id
            AND ranked_user.deleted_at IS NULL
        ) ranked
        WHERE target.user_id = ${userId}
      `);

      const serialize = (row: ScopedRankRow) => ({
        id: Number(row.id),
        slug: row.slug,
        name: row.name,
        rank: Number(row.rank),
        totalPlayers: Number(row.totalPlayers),
        performancePoints: Number(row.performancePoints),
        recordCount: Number(row.recordCount),
      });
      return {
        userId,
        games: rows.filter((row) => row.scope === "game").map(serialize).sort(rankOrder),
        categories: rows.filter((row) => row.scope === "category").map(serialize).sort(rankOrder),
      };
    },
    catch: (error) => error,
  });
}

export async function refreshScopedPerformanceForUsers(db: Database, userIds: readonly string[]) {
  const uniqueUserIds = [...new Set(userIds)];
  if (!uniqueUserIds.length) return;

  const rows = await db.select({
    userId: submissionParticipants.userId,
    gameId: submissions.gameId,
    categoryId: submissions.categoryId,
    points: bestRecords.points,
  }).from(submissionParticipants)
    .innerJoin(bestRecords, eq(submissionParticipants.submissionId, bestRecords.submissionId))
    .innerJoin(submissions, eq(bestRecords.submissionId, submissions.id))
    .where(and(
      inArray(submissionParticipants.userId, uniqueUserIds),
      eq(submissionParticipants.isPersonalBest, true),
    ));

  const gamesByUser = new Map<string, Map<number, number[]>>();
  const categoriesByUser = new Map<string, Map<number, number[]>>();
  for (const row of rows) {
    addPoints(gamesByUser, row.userId, row.gameId, row.points);
    addPoints(categoriesByUser, row.userId, row.categoryId, row.points);
  }

  await db.delete(userGamePerformance).where(inArray(userGamePerformance.userId, uniqueUserIds));
  await db.delete(userCategoryPerformance).where(
    inArray(userCategoryPerformance.userId, uniqueUserIds),
  );

  const calculatedAt = new Date();
  const gameValues = aggregateValues(gamesByUser, "gameId", calculatedAt);
  const categoryValues = aggregateValues(categoriesByUser, "categoryId", calculatedAt);
  for (let offset = 0; offset < gameValues.length; offset += 1_000) {
    await db.insert(userGamePerformance).values(gameValues.slice(offset, offset + 1_000));
  }
  for (let offset = 0; offset < categoryValues.length; offset += 1_000) {
    await db.insert(userCategoryPerformance).values(categoryValues.slice(offset, offset + 1_000));
  }
}

function addPoints(
  target: Map<string, Map<number, number[]>>,
  userId: string,
  scopeId: number,
  points: number,
) {
  const scopes = target.get(userId) ?? new Map<number, number[]>();
  const values = scopes.get(scopeId) ?? [];
  values.push(points);
  scopes.set(scopeId, values);
  target.set(userId, scopes);
}

function aggregateValues<Key extends "gameId" | "categoryId">(
  valuesByUser: Map<string, Map<number, number[]>>,
  key: Key,
  calculatedAt: Date,
) {
  return [...valuesByUser].flatMap(([userId, scopes]) =>
    [...scopes].map(([scopeId, points]) => ({
      userId,
      [key]: scopeId,
      performancePoints: calculatePerformancePoints(points),
      recordCount: points.length,
      calculatedAt,
    }))
  ) as Array<
    & { userId: string; performancePoints: number; recordCount: number; calculatedAt: Date }
    & {
      [Property in Key]: number;
    }
  >;
}

function rankOrder(left: { rank: number; name: string }, right: { rank: number; name: string }) {
  return left.rank - right.rank || left.name.localeCompare(right.name);
}
