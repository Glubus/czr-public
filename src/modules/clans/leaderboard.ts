import { and, eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import type { Database } from "../../db/client.ts";
import {
  bestRecords,
  categories,
  clanMembers,
  clans,
  games,
  maps,
  submissionParticipants,
  submissions,
} from "../../db/schema.ts";
import { ValidationError } from "../shared/errors.ts";

const CLAN_PAGE_SIZE = 50;
const COUNTED_RUN_LIMIT = 20;

type ClanLeaderboardFilters = {
  categories?: string;
  game?: string;
  mapsStatus?: string;
  playerCount?: string;
  page?: string;
};

export function getClanLeaderboard(db: Database, query: ClanLeaderboardFilters) {
  return parseFilters(query).pipe(
    Effect.flatMap((filters) =>
      databaseEffect(async () => {
        const conditions = [
          eq(submissions.status, "verified"),
          eq(submissionParticipants.status, "accepted"),
        ];
        if (filters.categorySlugs.length > 0) {
          conditions.push(inArray(categories.slug, filters.categorySlugs));
        }
        if (filters.gameSlug) conditions.push(eq(games.slug, filters.gameSlug));
        if (filters.mapTypes) conditions.push(inArray(maps.type, filters.mapTypes));
        if (filters.playerCount) conditions.push(eq(submissions.playerCount, filters.playerCount));

        const rows = await db.select({
          clanId: clans.id,
          clanSlug: clans.slug,
          clanName: clans.name,
          submissionId: submissions.id,
          points: bestRecords.points,
          playerCount: submissions.playerCount,
          verifiedAt: submissions.verifiedAt,
        }).from(bestRecords)
          .innerJoin(submissions, eq(bestRecords.submissionId, submissions.id))
          .innerJoin(submissionParticipants, eq(submissionParticipants.submissionId, submissions.id))
          .innerJoin(clanMembers, eq(clanMembers.userId, submissionParticipants.userId))
          .innerJoin(clans, eq(clans.id, clanMembers.clanId))
          .innerJoin(games, eq(games.id, submissions.gameId))
          .innerJoin(maps, eq(maps.id, submissions.mapId))
          .innerJoin(categories, eq(categories.id, submissions.categoryId))
          .where(and(...conditions));

        // A coop run may represent several clans, but can count only once inside each clan.
        const uniqueRuns = new Map<string, (typeof rows)[number]>();
        for (const row of rows) uniqueRuns.set(`${row.clanId}:${row.submissionId}`, row);
        const runsByClan = Map.groupBy([...uniqueRuns.values()], (row) => row.clanId);
        const membershipRows = await db.select({ clanId: clanMembers.clanId }).from(clanMembers);
        const memberCounts = new Map<number, number>();
        for (const membership of membershipRows) {
          memberCounts.set(membership.clanId, (memberCounts.get(membership.clanId) ?? 0) + 1);
        }

        const entries = [...runsByClan.values()].map((runs) => {
          const countedRuns = runs.sort(compareRuns).slice(0, COUNTED_RUN_LIMIT);
          const clan = runs[0]!;
          return {
            clan: {
              id: clan.clanId,
              slug: clan.clanSlug,
              name: clan.clanName,
              memberCount: memberCounts.get(clan.clanId) ?? 0,
            },
            score: countedRuns.reduce((total, run) => total + run.points, 0),
            eligibleRunCount: runs.length,
            countedRunCount: countedRuns.length,
            countedRuns: countedRuns.map((run) => ({
              submissionId: run.submissionId,
              points: run.points,
              playerCount: run.playerCount,
              verifiedAt: run.verifiedAt,
            })),
          };
        }).sort((left, right) =>
          right.score - left.score ||
          right.countedRunCount - left.countedRunCount ||
          (right.countedRuns[0]?.points ?? 0) - (left.countedRuns[0]?.points ?? 0) ||
          left.clan.slug.localeCompare(right.clan.slug)
        );
        const offset = filters.page * CLAN_PAGE_SIZE;
        return {
          rules: {
            maxCountedRuns: COUNTED_RUN_LIMIT,
            membership: "current",
            coopRunAttribution: "every_represented_clan",
            duplicatePolicy: "once_per_clan",
          },
          filters: {
            categories: filters.categorySlugs,
            game: filters.gameSlug ?? null,
            mapsStatus: filters.mapsStatus ?? null,
            playerCount: filters.playerCount ?? null,
          },
          page: filters.page,
          pageSize: CLAN_PAGE_SIZE,
          hasMore: entries.length > offset + CLAN_PAGE_SIZE,
          entries: entries.slice(offset, offset + CLAN_PAGE_SIZE).map((entry, index) => ({
            rank: offset + index + 1,
            ...entry,
          })),
        };
      })
    ),
  );
}

function compareRuns(
  left: { points: number; verifiedAt: Date | null; submissionId: number },
  right: { points: number; verifiedAt: Date | null; submissionId: number },
) {
  return right.points - left.points ||
    (left.verifiedAt?.getTime() ?? 0) - (right.verifiedAt?.getTime() ?? 0) ||
    left.submissionId - right.submissionId;
}

function parseFilters(query: ClanLeaderboardFilters) {
  return Effect.try({
    try: () => {
      const categorySlugs = query.categories?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
      if (query.categories !== undefined && categorySlugs.length === 0) {
        throw new ValidationError("categories must contain at least one category slug");
      }
      if (categorySlugs.some((category) => !/^[a-z0-9-]+$/.test(category))) {
        throw new ValidationError("categories must be comma-separated category slugs");
      }
      if (query.game !== undefined && !/^[a-z0-9-]+$/.test(query.game)) {
        throw new ValidationError("game must be a game slug");
      }
      if (query.mapsStatus !== undefined && !["official", "community"].includes(query.mapsStatus)) {
        throw new ValidationError("maps_status must be official or community");
      }
      if (query.playerCount !== undefined && !["1", "2", "3", "4"].includes(query.playerCount)) {
        throw new ValidationError("player_count must be 1, 2, 3, or 4");
      }
      if (query.page !== undefined && !/^[0-9]+$/.test(query.page)) {
        throw new ValidationError("page must be a non-negative integer");
      }
      return {
        categorySlugs,
        gameSlug: query.game,
        mapsStatus: query.mapsStatus,
        mapTypes: query.mapsStatus === "official"
          ? ["official"] as const
          : query.mapsStatus === "community"
          ? ["custom", "uem"] as const
          : undefined,
        playerCount: query.playerCount === undefined ? undefined : Number(query.playerCount),
        page: query.page === undefined ? 0 : Number(query.page),
      };
    },
    catch: (error) => error,
  });
}

function databaseEffect<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({ try: operation, catch: (error) => error });
}
