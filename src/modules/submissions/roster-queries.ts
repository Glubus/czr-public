import { and, eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import type { Database } from "../../db/client.ts";
import {
  bestRecords,
  categories,
  games,
  maps,
  submissionParticipants,
  submissions,
  users,
} from "../../db/schema.ts";
import { NotFoundError, ValidationError } from "../shared/errors.ts";
import { parsePage } from "../shared/pagination.ts";
import { calculatePerformancePoints } from "./performance-points.ts";
import { isBetterRecord } from "./ranking.ts";

const ROSTER_PAGE_SIZE = 50;

type RosterFilters = {
  playerCount?: string;
  categories?: string;
  game?: string;
  mapsStatus?: string;
  page?: string;
};

export function getRosterLeaderboard(db: Database, query: RosterFilters) {
  return parseRosterFilters(query, true).pipe(
    Effect.flatMap((filters) =>
      databaseEffect(async () => {
        const entries = await buildRosterEntries(db, filters);
        const offset = filters.page * ROSTER_PAGE_SIZE;
        return {
          filters: {
            playerCount: filters.playerCount,
            categories: filters.categorySlugs,
            game: filters.gameSlug,
            mapsStatus: filters.mapsStatus,
          },
          page: filters.page,
          pageSize: ROSTER_PAGE_SIZE,
          hasMore: entries.length > offset + ROSTER_PAGE_SIZE,
          entries: entries.slice(offset, offset + ROSTER_PAGE_SIZE).map((entry, index) => ({
            rank: offset + index + 1,
            ...entry,
          })),
        };
      })
    ),
  );
}

let globalRosterRankCache:
  | { db: Database; expiresAt: number; value: Promise<Map<string, number>> }
  | undefined;

export function getBestGlobalRosterRanksByUser(db: Database, fresh = false) {
  if (!fresh && globalRosterRankCache?.db === db && globalRosterRankCache.expiresAt > Date.now()) {
    return globalRosterRankCache.value;
  }
  const value = calculateBestGlobalRosterRanksByUser(db);
  globalRosterRankCache = { db, expiresAt: Date.now() + 60_000, value };
  return value;
}

async function calculateBestGlobalRosterRanksByUser(db: Database) {
  const bestRanks = new Map<string, number>();
  for (const playerCount of [2, 3, 4]) {
    const entries = await buildRosterEntries(db, { playerCount });
    entries.forEach((entry, index) => {
      const rank = index + 1;
      for (const member of entry.members) {
        bestRanks.set(member.id, Math.min(bestRanks.get(member.id) ?? Infinity, rank));
      }
    });
  }
  return bestRanks;
}

export function getRosterDetail(db: Database, competitorKey: string) {
  return validateCompetitorKey(competitorKey).pipe(
    Effect.flatMap((competitorKey) =>
      databaseEffect(async () => {
        const records = await loadRosterRecords(db, { competitorKey });
        if (records.length === 0) throw new NotFoundError("roster not found");
        const members = await loadMembers(db, records);
        const allFormatRecords = await loadRosterRecords(db, { playerCount: records[0]!.playerCount });
        const boardRanks = rankRecordsByBoard(allFormatRecords);
        return {
          competitorKey,
          playerCount: records[0]!.playerCount,
          members: members.get(competitorKey) ?? [],
          performancePoints: calculatePerformancePoints(records.map((record) => record.points)),
          recordCount: records.length,
          firstPlaces: records.filter((record) => boardRanks.get(record.submissionId) === 1).length,
          podiums: records.filter((record) => (boardRanks.get(record.submissionId) ?? Infinity) <= 3).length,
          lastVerifiedAt: records.reduce<Date | null>(
            (latest, record) =>
              !latest || (record.verifiedAt && record.verifiedAt > latest) ? record.verifiedAt : latest,
            null,
          ),
        };
      })
    ),
  );
}

export function getRosterRecords(db: Database, competitorKey: string, pageValue?: string) {
  return validateCompetitorKey(competitorKey).pipe(
    Effect.flatMap((competitorKey) =>
      databaseEffect(async () => {
        const page = parsePage(pageValue);
        const records = await loadRosterRecords(db, { competitorKey });
        if (records.length === 0) throw new NotFoundError("roster not found");
        const allFormatRecords = await loadRosterRecords(db, { playerCount: records[0]!.playerCount });
        const boardRanks = rankRecordsByBoard(allFormatRecords);
        const allEntries = records.sort((left, right) =>
          right.points - left.points ||
          (right.verifiedAt?.getTime() ?? 0) - (left.verifiedAt?.getTime() ?? 0) ||
          right.submissionId - left.submissionId
        ).map((record) => ({
          ...record,
          isWorldRecord: boardRanks.get(record.submissionId) === 1,
        }));
        const offset = page * ROSTER_PAGE_SIZE;
        return {
          competitorKey,
          page,
          pageSize: ROSTER_PAGE_SIZE,
          hasMore: allEntries.length > offset + ROSTER_PAGE_SIZE,
          entries: allEntries.slice(offset, offset + ROSTER_PAGE_SIZE),
        };
      })
    ),
  );
}

type ParsedFilters = {
  playerCount?: number;
  categorySlugs?: string[];
  gameSlug?: string;
  mapsStatus?: string;
  mapTypes?: ReadonlyArray<"official" | "custom" | "uem">;
  page?: number;
  competitorKey?: string;
};

async function buildRosterEntries(db: Database, filters: ParsedFilters) {
  const records = await loadRosterRecords(db, filters);
  const members = await loadMembers(db, records);
  const boardRanks = rankRecordsByBoard(records);
  const rosters = new Map<string, {
    competitorKey: string;
    recordPoints: number[];
    recordCount: number;
    firstPlaces: number;
    podiums: number;
    lastVerifiedAt: Date | null;
  }>();
  for (const record of records) {
    const roster = rosters.get(record.competitorKey) ?? {
      competitorKey: record.competitorKey,
      recordPoints: [],
      recordCount: 0,
      firstPlaces: 0,
      podiums: 0,
      lastVerifiedAt: null,
    };
    roster.recordPoints.push(record.points);
    roster.recordCount++;
    const boardRank = boardRanks.get(record.submissionId)!;
    if (boardRank === 1) roster.firstPlaces++;
    if (boardRank <= 3) roster.podiums++;
    if (!roster.lastVerifiedAt || (record.verifiedAt && record.verifiedAt > roster.lastVerifiedAt)) {
      roster.lastVerifiedAt = record.verifiedAt;
    }
    rosters.set(record.competitorKey, roster);
  }
  return [...rosters.values()].map((roster) => ({
    competitorKey: roster.competitorKey,
    playerCount: filters.playerCount!,
    members: members.get(roster.competitorKey) ?? [],
    performancePoints: calculatePerformancePoints(roster.recordPoints),
    recordCount: roster.recordCount,
    firstPlaces: roster.firstPlaces,
    podiums: roster.podiums,
    lastVerifiedAt: roster.lastVerifiedAt,
  })).sort(compareRosters);
}

function loadRosterRecords(db: Database, filters: ParsedFilters) {
  const conditions = [eq(submissions.status, "verified")];
  if (filters.playerCount) conditions.push(eq(submissions.playerCount, filters.playerCount));
  if (filters.competitorKey) conditions.push(eq(submissions.competitorKey, filters.competitorKey));
  if (filters.categorySlugs?.length) conditions.push(inArray(categories.slug, filters.categorySlugs));
  if (filters.gameSlug) conditions.push(eq(games.slug, filters.gameSlug));
  if (filters.mapTypes) conditions.push(inArray(maps.type, filters.mapTypes));
  return db.select({
    submissionId: submissions.id,
    competitorKey: submissions.competitorKey,
    playerCount: submissions.playerCount,
    scoreValue: submissions.scoreValue,
    runDurationMs: submissions.runDurationMs,
    proofLevel: submissions.proofLevel,
    proofUrl: submissions.proofUrl,
    verifiedAt: submissions.verifiedAt,
    points: bestRecords.points,
    categoryAssignmentId: submissions.categoryAssignmentId,
    scoreType: categories.scoreType,
    rankingDirection: categories.rankingDirection,
    game: { id: games.id, slug: games.slug, name: games.name },
    map: { id: maps.id, slug: maps.slug, name: maps.name, type: maps.type },
    category: { id: categories.id, slug: categories.slug, name: categories.name },
  }).from(bestRecords)
    .innerJoin(submissions, eq(bestRecords.submissionId, submissions.id))
    .innerJoin(games, eq(submissions.gameId, games.id))
    .innerJoin(maps, eq(submissions.mapId, maps.id))
    .innerJoin(categories, eq(submissions.categoryId, categories.id))
    .where(and(...conditions));
}

async function loadMembers(
  db: Database,
  records: Awaited<ReturnType<typeof loadRosterRecords>>,
) {
  if (records.length === 0) {
    return new Map<string, Array<{ id: string; name: string; image: string | null }>>();
  }
  const submissionToTeam = new Map(records.map((record) => [record.submissionId, record.competitorKey]));
  const rows = await db.select({
    submissionId: submissionParticipants.submissionId,
    id: users.id,
    name: users.name,
    image: users.image,
  }).from(submissionParticipants).innerJoin(users, eq(submissionParticipants.userId, users.id))
    .where(and(
      inArray(submissionParticipants.submissionId, records.map((record) => record.submissionId)),
      eq(submissionParticipants.status, "accepted"),
    ));
  const members = new Map<string, Map<string, { id: string; name: string; image: string | null }>>();
  for (const row of rows) {
    const competitorKey = submissionToTeam.get(row.submissionId)!;
    const team = members.get(competitorKey) ?? new Map();
    team.set(row.id, { id: row.id, name: row.name, image: row.image });
    members.set(competitorKey, team);
  }
  return new Map([...members].map(([key, team]) => [
    key,
    [...team.values()].sort((left, right) => left.id.localeCompare(right.id)),
  ]));
}

function rankRecordsByBoard(records: Awaited<ReturnType<typeof loadRosterRecords>>) {
  const boards = Map.groupBy(
    records,
    (record) => `${record.map.id}:${record.categoryAssignmentId}:${record.playerCount}`,
  );
  const ranks = new Map<number, number>();
  for (const board of boards.values()) {
    board.sort(compareRecords);
    board.forEach((record, index) => ranks.set(record.submissionId, index + 1));
  }
  return ranks;
}

function compareRecords(
  left: Awaited<ReturnType<typeof loadRosterRecords>>[number],
  right: Awaited<ReturnType<typeof loadRosterRecords>>[number],
) {
  if (
    isBetterRecord(
      left.scoreValue,
      right.scoreValue,
      left.runDurationMs,
      right.runDurationMs,
      left.scoreType,
      left.rankingDirection,
    )
  ) return -1;
  if (
    isBetterRecord(
      right.scoreValue,
      left.scoreValue,
      right.runDurationMs,
      left.runDurationMs,
      right.scoreType,
      right.rankingDirection,
    )
  ) return 1;
  return (left.verifiedAt?.getTime() ?? 0) - (right.verifiedAt?.getTime() ?? 0) ||
    left.submissionId - right.submissionId;
}

function compareRosters(
  left: {
    performancePoints: number;
    firstPlaces: number;
    podiums: number;
    lastVerifiedAt: Date | null;
    competitorKey: string;
  },
  right: {
    performancePoints: number;
    firstPlaces: number;
    podiums: number;
    lastVerifiedAt: Date | null;
    competitorKey: string;
  },
) {
  return right.performancePoints - left.performancePoints ||
    right.firstPlaces - left.firstPlaces ||
    right.podiums - left.podiums ||
    (left.lastVerifiedAt?.getTime() ?? 0) - (right.lastVerifiedAt?.getTime() ?? 0) ||
    left.competitorKey.localeCompare(right.competitorKey);
}

function parseRosterFilters(query: RosterFilters, requirePlayerCount: boolean) {
  return Effect.try({
    try: () => {
      if (requirePlayerCount && query.playerCount === undefined) {
        throw new ValidationError("player_count is required");
      }
      if (query.playerCount !== undefined && !["2", "3", "4"].includes(query.playerCount)) {
        throw new ValidationError("player_count must be 2, 3, or 4");
      }
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
      if (query.page !== undefined && !/^[0-9]+$/.test(query.page)) {
        throw new ValidationError("page must be a non-negative integer");
      }
      return {
        playerCount: query.playerCount === undefined ? undefined : Number(query.playerCount),
        categorySlugs,
        gameSlug: query.game,
        mapsStatus: query.mapsStatus,
        mapTypes: query.mapsStatus === "official"
          ? ["official"] as const
          : query.mapsStatus === "community"
          ? ["custom", "uem"] as const
          : undefined,
        page: query.page === undefined ? 0 : Number(query.page),
      };
    },
    catch: (error) => error,
  });
}

function validateCompetitorKey(value: string): Effect.Effect<string, ValidationError> {
  if (
    value.startsWith("team:") && value.length <= 600 &&
    ![...value].some((character) => character.charCodeAt(0) < 32)
  ) {
    return Effect.succeed(value);
  }
  return Effect.fail(new ValidationError("competitorKey must identify a 2P, 3P, or 4P roster"));
}

function databaseEffect<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({ try: operation, catch: (error) => error });
}
