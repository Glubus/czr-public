import { and, eq, sql } from "drizzle-orm";
import { Effect } from "effect";
import { UnauthorizedError } from "../../auth/session.ts";
import type { Database } from "../../db/client.ts";
import { follows } from "../../db/schema.ts";
import { ValidationError } from "../shared/errors.ts";

export type PerformanceLeaderboardQuery = {
  categories?: string;
  game?: string;
  mapsStatus?: string;
  playerCount?: string;
  page?: string;
  scope?: string;
  country?: string;
};

export function parseHighestPointRecordFilters(
  query: Pick<PerformanceLeaderboardQuery, "categories" | "game" | "mapsStatus">,
) {
  return Effect.try({
    try: () => {
      if (query.categories !== undefined && !/^[a-z0-9-]+$/.test(query.categories)) {
        throw new ValidationError("categories must be a single category slug");
      }
      if (query.game !== undefined && !/^[a-z0-9-]+$/.test(query.game)) {
        throw new ValidationError("game must be a game slug");
      }
      if (
        query.mapsStatus !== undefined && query.mapsStatus !== "official" &&
        query.mapsStatus !== "community"
      ) {
        throw new ValidationError("maps_status must be official or community");
      }
      return {
        categorySlug: query.categories,
        gameSlug: query.game,
        mapTypes: query.mapsStatus === "official"
          ? ["official"] as const
          : query.mapsStatus === "community"
          ? ["custom", "uem"] as const
          : undefined,
      };
    },
    catch: (error) => error,
  });
}

export function parsePerformanceLeaderboardFilters(query: PerformanceLeaderboardQuery) {
  return Effect.try({
    try: () => {
      const categorySlugs = query.categories === undefined
        ? []
        : query.categories.split(",").map((category) => category.trim()).filter(Boolean);
      if (query.categories !== undefined && categorySlugs.length === 0) {
        throw new ValidationError("categories must contain at least one category slug");
      }
      if (categorySlugs.some((category) => !/^[a-z0-9-]+$/.test(category))) {
        throw new ValidationError("categories must be comma-separated category slugs");
      }
      if (query.game !== undefined && !/^[a-z0-9-]+$/.test(query.game)) {
        throw new ValidationError("game must be a game slug");
      }
      if (
        query.mapsStatus !== undefined && query.mapsStatus !== "official" &&
        query.mapsStatus !== "community"
      ) {
        throw new ValidationError("maps_status must be official or community");
      }
      if (query.playerCount !== undefined && !/^[1-9][0-9]*$/.test(query.playerCount)) {
        throw new ValidationError("player_count must be a positive integer");
      }
      if (query.page !== undefined && !/^[0-9]+$/.test(query.page)) {
        throw new ValidationError("page must be a non-negative integer");
      }
      if (query.scope !== undefined && !["world", "following", "friends"].includes(query.scope)) {
        throw new ValidationError("scope must be world, following or friends");
      }
      if (query.country !== undefined && !/^[A-Za-z]{2}$/.test(query.country)) {
        throw new ValidationError("country must be an ISO 3166-1 alpha-2 code");
      }
      return {
        categorySlugs,
        gameSlug: query.game,
        mapsStatus: query.mapsStatus,
        playerCount: query.playerCount === undefined ? undefined : Number(query.playerCount),
        page: query.page === undefined ? 0 : Number(query.page),
        scope: (query.scope ?? "world") as "world" | "following" | "friends",
        countryCode: query.country?.toUpperCase(),
        mapTypes: query.mapsStatus === "official"
          ? ["official"] as const
          : query.mapsStatus === "community"
          ? ["custom", "uem"] as const
          : undefined,
      };
    },
    catch: (error) => error,
  });
}

export async function resolveScopedUserIds(
  db: Database,
  scope: "world" | "following" | "friends",
  currentUserId?: string,
) {
  if (scope === "world") return undefined;
  if (!currentUserId) throw new UnauthorizedError();
  const rows = scope === "following"
    ? await db.select({ userId: follows.targetId }).from(follows).where(and(
      eq(follows.followerUserId, currentUserId),
      eq(follows.targetType, "user"),
    ))
    : await db.execute<{ userId: string }>(sql`
      SELECT outgoing.target_id AS "userId"
      FROM follows outgoing
      WHERE outgoing.follower_user_id = ${currentUserId} AND outgoing.target_type = 'user'
        AND EXISTS (
          SELECT 1 FROM follows incoming
          WHERE incoming.follower_user_id = outgoing.target_id
            AND incoming.target_type = 'user' AND incoming.target_id = ${currentUserId}
        )
    `);
  return [...new Set([currentUserId, ...rows.map((row) => row.userId)])];
}

export function parseHistoryPage(value: string | undefined) {
  return Effect.try({
    try: () => {
      if (value === undefined) return 0;
      if (!/^[0-9]+$/.test(value)) {
        throw new ValidationError("page must be a non-negative integer");
      }
      return Number(value);
    },
    catch: (error) => error,
  });
}
