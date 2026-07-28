import { and, count, desc, eq, gt, gte, inArray, isNull, sql } from "drizzle-orm";
import { Effect } from "effect";
import type { Database } from "../../db/client.ts";
import {
  bestRecords,
  categories,
  categoryAssignments,
  games,
  maps,
  profilePinnedRecords,
  submissionParticipants,
  submissions,
  users,
} from "../../db/schema.ts";
import { NotFoundError } from "../shared/errors.ts";
import { calculatePerformancePointContributions, calculatePerformancePoints } from "./performance-points.ts";
import { recalculatePerformancePointsForUsers } from "./persistence.ts";
import { isBetterRecord } from "./ranking.ts";
import { parsePage } from "../shared/pagination.ts";
import {
  parseHighestPointRecordFilters,
  parseHistoryPage,
  parsePerformanceLeaderboardFilters,
  type PerformanceLeaderboardQuery,
  resolveScopedUserIds,
} from "./performance-query-filters.ts";
import { findWorldRecordIds } from "./featured-record-queries.ts";
import { refreshScopedPerformanceForUsers } from "../users/ranks.ts";
export {
  getHighestPointRecordsThisWeek,
  getLatestWorldRecords,
  weeklyWindow,
} from "./featured-record-queries.ts";

const USER_HISTORY_PAGE_SIZE = 25;
const PERFORMANCE_LEADERBOARD_PAGE_SIZE = 50;

export function getPerformanceLeaderboard(
  db: Database,
  query: PerformanceLeaderboardQuery = {},
  currentUserId?: string,
) {
  return parsePerformanceLeaderboardFilters(query).pipe(
    Effect.flatMap((filters) =>
      Effect.tryPromise({
        try: async () => {
          if (
            filters.scope === "world" && filters.categorySlugs.length === 0 && !filters.gameSlug &&
            !filters.mapTypes && !filters.playerCount && !filters.countryCode
          ) {
            return getCachedGlobalLeaderboard(db, filters.page);
          }
          const conditions = [eq(submissionParticipants.isPersonalBest, true)];
          if (filters.categorySlugs.length > 0) {
            conditions.push(inArray(categories.slug, filters.categorySlugs));
          }
          if (filters.gameSlug) conditions.push(eq(games.slug, filters.gameSlug));
          if (filters.mapTypes) conditions.push(inArray(maps.type, filters.mapTypes));
          if (filters.playerCount) conditions.push(eq(submissions.playerCount, filters.playerCount));
          if (filters.countryCode) conditions.push(eq(users.countryCode, filters.countryCode));
          const scopedUserIds = await resolveScopedUserIds(db, filters.scope, currentUserId);
          if (scopedUserIds) conditions.push(inArray(users.id, scopedUserIds));

          const rows = await db.select({
            user: { id: users.id, name: users.name, image: users.image },
            recordPoints: bestRecords.points,
          }).from(bestRecords).innerJoin(submissions, eq(bestRecords.submissionId, submissions.id))
            .innerJoin(submissionParticipants, eq(submissions.id, submissionParticipants.submissionId))
            .innerJoin(users, eq(submissionParticipants.userId, users.id))
            .innerJoin(games, eq(submissions.gameId, games.id))
            .innerJoin(maps, eq(submissions.mapId, maps.id))
            .innerJoin(categories, eq(submissions.categoryId, categories.id))
            .where(and(eq(submissionParticipants.isPersonalBest, true), ...conditions));

          const recordsByUser = new Map<string, {
            user: { id: string; name: string; image: string | null };
            recordPoints: number[];
          }>();
          for (const row of rows) {
            const current = recordsByUser.get(row.user.id) ?? { user: row.user, recordPoints: [] };
            current.recordPoints.push(row.recordPoints);
            recordsByUser.set(row.user.id, current);
          }

          const entries = [...recordsByUser.values()].map(({ user, recordPoints }) => ({
            user: { ...user, performancePoints: calculatePerformancePoints(recordPoints) },
            recordCount: recordPoints.length,
          })).sort((left, right) =>
            right.user.performancePoints - left.user.performancePoints ||
            left.user.id.localeCompare(right.user.id)
          );

          return {
            filters: {
              categories: filters.categorySlugs,
              game: filters.gameSlug,
              mapsStatus: filters.mapsStatus,
              scope: filters.scope,
              country: filters.countryCode,
            },
            page: filters.page,
            pageSize: PERFORMANCE_LEADERBOARD_PAGE_SIZE,
            totalEntries: entries.length,
            totalPages: Math.ceil(entries.length / PERFORMANCE_LEADERBOARD_PAGE_SIZE),
            hasMore: entries.length > (filters.page + 1) * PERFORMANCE_LEADERBOARD_PAGE_SIZE,
            entries: entries.slice(
              filters.page * PERFORMANCE_LEADERBOARD_PAGE_SIZE,
              (filters.page + 1) * PERFORMANCE_LEADERBOARD_PAGE_SIZE,
            ).map((entry, index) => ({
              rank: filters.page * PERFORMANCE_LEADERBOARD_PAGE_SIZE + index + 1,
              ...entry,
            })),
          };
        },
        catch: (error) => error,
      })
    ),
  );
}

export function getHighestPointRecords(
  db: Database,
  query: Pick<PerformanceLeaderboardQuery, "categories" | "game" | "mapsStatus"> = {},
) {
  return parseHighestPointRecordFilters(query).pipe(Effect.flatMap((filters) =>
    Effect.tryPromise({
      try: async () => {
        const conditions = [];
        if (filters.categorySlug) conditions.push(eq(categories.slug, filters.categorySlug));
        if (filters.gameSlug) conditions.push(eq(games.slug, filters.gameSlug));
        if (filters.mapTypes) conditions.push(inArray(maps.type, filters.mapTypes));
        const records = await db.select({
          submissionId: bestRecords.submissionId,
          points: bestRecords.points,
          scoreValue: submissions.scoreValue,
          runDurationMs: submissions.runDurationMs,
          playerCount: submissions.playerCount,
          verifiedAt: submissions.verifiedAt,
          game: { id: games.id, slug: games.slug, name: games.name },
          map: { id: maps.id, slug: maps.slug, name: maps.name },
          category: {
            id: categories.id,
            slug: categories.slug,
            name: categories.name,
            scoreType: categories.scoreType,
          },
        }).from(bestRecords)
          .innerJoin(submissions, eq(bestRecords.submissionId, submissions.id))
          .innerJoin(games, eq(submissions.gameId, games.id))
          .innerJoin(maps, eq(submissions.mapId, maps.id))
          .innerJoin(categories, eq(submissions.categoryId, categories.id))
          .where(conditions.length ? and(...conditions) : undefined)
          .orderBy(desc(bestRecords.points), desc(submissions.verifiedAt), desc(submissions.id))
          .limit(50);

        if (!records.length) return { limit: 50, entries: [] };
        const participants = await db.select({
          submissionId: submissionParticipants.submissionId,
          role: submissionParticipants.role,
          user: { id: users.id, name: users.name, image: users.image },
        }).from(submissionParticipants)
          .innerJoin(users, eq(submissionParticipants.userId, users.id))
          .where(inArray(submissionParticipants.submissionId, records.map((record) => record.submissionId)))
          .orderBy(submissionParticipants.submissionId, submissionParticipants.role, users.name);

        const worldRecordIds = await findWorldRecordIds(
          db,
          records.map((record) => record.submissionId),
        );

        const participantsBySubmission = new Map<number, typeof participants>();
        for (const participant of participants) {
          const current = participantsBySubmission.get(participant.submissionId) ?? [];
          current.push(participant);
          participantsBySubmission.set(participant.submissionId, current);
        }

        return {
          limit: 50,
          entries: records.map((record, index) => ({
            rank: index + 1,
            ...record,
            isWorldRecord: worldRecordIds.has(record.submissionId),
            participants: (participantsBySubmission.get(record.submissionId) ?? []).map(({ role, user }) => ({
              role,
              user,
            })),
          })),
        };
      },
      catch: (error) => error,
    })
  ));
}

export function getHighestAverageLeaderboard(
  db: Database,
  query: Pick<PerformanceLeaderboardQuery, "categories" | "game" | "mapsStatus"> = {},
) {
  return parseHighestPointRecordFilters(query).pipe(Effect.flatMap((filters) =>
    Effect.tryPromise({
      try: async () => {
        const conditions = [
          eq(submissionParticipants.isPersonalBest, true),
          isNull(users.deletedAt),
        ];
        if (filters.categorySlug) conditions.push(eq(categories.slug, filters.categorySlug));
        if (filters.gameSlug) conditions.push(eq(games.slug, filters.gameSlug));
        if (filters.mapTypes) conditions.push(inArray(maps.type, filters.mapTypes));

        const averagePoints = sql<number>`avg(${bestRecords.points})`;
        const recordCount = count(bestRecords.submissionId);
        const rows = await db.select({
          user: {
            id: users.id,
            name: users.name,
            image: users.image,
            performancePoints: users.performancePoints,
          },
          averagePoints,
          recordCount,
        }).from(submissionParticipants)
          .innerJoin(bestRecords, eq(submissionParticipants.submissionId, bestRecords.submissionId))
          .innerJoin(submissions, eq(bestRecords.submissionId, submissions.id))
          .innerJoin(users, eq(submissionParticipants.userId, users.id))
          .innerJoin(games, eq(submissions.gameId, games.id))
          .innerJoin(maps, eq(submissions.mapId, maps.id))
          .innerJoin(categories, eq(submissions.categoryId, categories.id))
          .where(and(...conditions))
          .groupBy(users.id)
          .having(gte(recordCount, 5))
          .orderBy(desc(averagePoints), desc(recordCount), users.id)
          .limit(50);

        return {
          limit: 50,
          entries: rows.map((row, index) => ({
            rank: index + 1,
            user: row.user,
            recordCount: Number(row.recordCount),
            averagePoints: Number(row.averagePoints),
          })),
        };
      },
      catch: (error) => error,
    })
  ));
}

async function getCachedGlobalLeaderboard(db: Database, page: number) {
  const offset = page * PERFORMANCE_LEADERBOARD_PAGE_SIZE;
  const rows = await db.execute<{
    id: string;
    name: string;
    image: string | null;
    performancePoints: number;
    recordCount: number;
    totalEntries: number;
  }>(sql`
    SELECT users.id, users.name, users.image,
      users.performance_points AS "performancePoints",
      count(participants.submission_id)::int AS "recordCount",
      count(*) OVER()::int AS "totalEntries"
    FROM users
    JOIN submission_participants participants
      ON participants.user_id = users.id AND participants.is_personal_best = true
    WHERE users.deleted_at IS NULL
    GROUP BY users.id
    ORDER BY users.performance_points DESC, users.id
    LIMIT ${PERFORMANCE_LEADERBOARD_PAGE_SIZE + 1}
    OFFSET ${offset}
  `);
  return {
    filters: { categories: [], game: undefined, mapsStatus: undefined, scope: "world" as const },
    page,
    pageSize: PERFORMANCE_LEADERBOARD_PAGE_SIZE,
    totalEntries: Number(rows[0]?.totalEntries ?? 0),
    totalPages: Math.ceil(Number(rows[0]?.totalEntries ?? 0) / PERFORMANCE_LEADERBOARD_PAGE_SIZE),
    hasMore: rows.length > PERFORMANCE_LEADERBOARD_PAGE_SIZE,
    entries: rows.slice(0, PERFORMANCE_LEADERBOARD_PAGE_SIZE).map((row, index) => ({
      rank: offset + index + 1,
      user: {
        id: row.id,
        name: row.name,
        image: row.image,
        performancePoints: Number(row.performancePoints),
      },
      recordCount: Number(row.recordCount),
    })),
  };
}

export function getUserRecords(db: Database, userId: string, pageValue?: string) {
  return Effect.tryPromise({
    try: async () => {
      const page = parsePage(pageValue);
      const user = await getPublicUser(db, userId);
      const records = await db.select({
        submissionId: bestRecords.submissionId,
        points: bestRecords.points,
        scoreValue: submissions.scoreValue,
        runDurationMs: submissions.runDurationMs,
        categoryAssignmentId: submissions.categoryAssignmentId,
        playerCount: submissions.playerCount,
        proofLevel: submissions.proofLevel,
        verifiedAt: submissions.verifiedAt,
        game: { id: games.id, slug: games.slug, name: games.name },
        map: { id: maps.id, slug: maps.slug, name: maps.name },
        category: {
          id: categories.id,
          slug: categories.slug,
          name: categories.name,
          scoreType: categories.scoreType,
          rankingDirection: categories.rankingDirection,
        },
        assignmentSpecificRules: categoryAssignments.specificRules,
      }).from(submissionParticipants).innerJoin(
        bestRecords,
        eq(submissionParticipants.submissionId, bestRecords.submissionId),
      ).innerJoin(submissions, eq(bestRecords.submissionId, submissions.id))
        .innerJoin(games, eq(submissions.gameId, games.id))
        .innerJoin(maps, eq(submissions.mapId, maps.id))
        .innerJoin(categories, eq(submissions.categoryId, categories.id))
        .leftJoin(categoryAssignments, eq(submissions.categoryAssignmentId, categoryAssignments.id))
        .where(
          and(eq(submissionParticipants.userId, userId), eq(submissionParticipants.isPersonalBest, true)),
        )
        .orderBy(desc(bestRecords.points), desc(submissions.verifiedAt), desc(submissions.id));
      const bestByTarget = new Map<string, (typeof records)[number]>();
      for (const record of records) {
        const key = `${record.map.id}:${record.categoryAssignmentId}:${record.playerCount}`;
        const current = bestByTarget.get(key);
        if (
          !current || isBetterRecord(
            record.scoreValue,
            current.scoreValue,
            record.runDurationMs,
            current.runDurationMs,
            record.category.scoreType,
            record.category.rankingDirection,
          )
        ) bestByTarget.set(key, record);
      }
      const allEntries = [...bestByTarget.values()].sort((left, right) => right.points - left.points);
      const worldRecordIds = await findWorldRecordIds(
        db,
        allEntries.map((record) => record.submissionId),
      );
      const [higherRanked] = await db.select({ value: count() }).from(users).where(and(
        isNull(users.deletedAt),
        gt(users.performancePoints, user.performancePoints),
      ));
      const [higherInCountry, countryPlayers] = user.countryCode
        ? await Promise.all([
          db.select({ value: count() }).from(users).where(and(
            isNull(users.deletedAt),
            eq(users.countryCode, user.countryCode),
            gt(users.performancePoints, user.performancePoints),
          )),
          db.select({ value: count() }).from(users).where(and(
            isNull(users.deletedAt),
            eq(users.countryCode, user.countryCode),
          )),
        ])
        : [[], []];
      const verifiedParticipation = and(
        eq(submissionParticipants.userId, userId),
        eq(submissions.status, "verified"),
      );
      const [
        mostPlayedGames,
        mostPlayedMaps,
        mostPlayedCategories,
        totalVerifiedPlays,
        playHistory,
        pinnedRecords,
      ] = await Promise.all([
        db.select({
          id: games.id,
          slug: games.slug,
          name: games.name,
          playCount: count(submissions.id),
        }).from(submissionParticipants)
          .innerJoin(submissions, eq(submissionParticipants.submissionId, submissions.id))
          .innerJoin(games, eq(submissions.gameId, games.id))
          .where(verifiedParticipation)
          .groupBy(games.id)
          .orderBy(desc(count(submissions.id)), games.name)
          .limit(5),
        db.select({
          id: maps.id,
          slug: maps.slug,
          name: maps.name,
          gameName: games.name,
          playCount: count(submissions.id),
        }).from(submissionParticipants)
          .innerJoin(submissions, eq(submissionParticipants.submissionId, submissions.id))
          .innerJoin(maps, eq(submissions.mapId, maps.id))
          .innerJoin(games, eq(submissions.gameId, games.id))
          .where(verifiedParticipation)
          .groupBy(maps.id, games.name)
          .orderBy(desc(count(submissions.id)), maps.name)
          .limit(5),
        db.select({
          id: categories.id,
          slug: categories.slug,
          name: categories.name,
          playCount: count(submissions.id),
        }).from(submissionParticipants)
          .innerJoin(submissions, eq(submissionParticipants.submissionId, submissions.id))
          .innerJoin(categories, eq(submissions.categoryId, categories.id))
          .where(verifiedParticipation)
          .groupBy(categories.id)
          .orderBy(desc(count(submissions.id)), categories.name)
          .limit(5),
        db.select({ value: count(submissions.id) }).from(submissionParticipants)
          .innerJoin(submissions, eq(submissionParticipants.submissionId, submissions.id))
          .where(verifiedParticipation),
        db.execute<{ month: string; playCount: number }>(sql`
          WITH eligible AS (
            SELECT date_trunc('month', ${submissions.verifiedAt}) AS month
            FROM ${submissionParticipants}
            INNER JOIN ${submissions}
              ON ${submissionParticipants.submissionId} = ${submissions.id}
            WHERE ${submissionParticipants.userId} = ${userId}
              AND ${submissions.status} = 'verified'
              AND ${submissions.verifiedAt} IS NOT NULL
          ), bounds AS (
            SELECT greatest(min(month), max(month) - interval '35 months') AS starts_at,
              max(month) AS ends_at
            FROM eligible
          ), months AS (
            SELECT generate_series(starts_at, ends_at, interval '1 month') AS month
            FROM bounds
            WHERE starts_at IS NOT NULL
          ), monthly AS (
            SELECT month, count(*)::integer AS play_count
            FROM eligible
            GROUP BY month
          )
          SELECT to_char(months.month, 'YYYY-MM-DD') AS month,
            coalesce(monthly.play_count, 0)::integer AS "playCount"
          FROM months
          LEFT JOIN monthly ON monthly.month = months.month
          ORDER BY months.month
        `),
        db.select({ submissionId: profilePinnedRecords.submissionId })
          .from(profilePinnedRecords)
          .innerJoin(bestRecords, eq(bestRecords.submissionId, profilePinnedRecords.submissionId))
          .innerJoin(
            submissionParticipants,
            and(
              eq(submissionParticipants.submissionId, profilePinnedRecords.submissionId),
              eq(submissionParticipants.userId, userId),
              eq(submissionParticipants.isPersonalBest, true),
            ),
          )
          .where(eq(profilePinnedRecords.userId, userId))
          .orderBy(desc(profilePinnedRecords.createdAt))
          .limit(3),
      ]);
      const pageSize = 50;
      const offset = page * pageSize;
      const awardedBySubmission = new Map(
        calculatePerformancePointContributions(allEntries.map((record) => record.points)).map(
          (awardedPoints, index) => [allEntries[index]!.submissionId, awardedPoints] as const,
        ),
      );
      const pinnedSubmissionIds = pinnedRecords.map((entry) => entry.submissionId);
      const pinnedIds = new Set(pinnedSubmissionIds);
      const serializeRecord = (record: (typeof allEntries)[number]) => {
        const { assignmentSpecificRules, ...entry } = record;
        return {
          ...entry,
          awardedPoints: awardedBySubmission.get(record.submissionId) ?? 0,
          awardPercentage: record.points > 0
            ? ((awardedBySubmission.get(record.submissionId) ?? 0) / record.points) * 100
            : 0,
          category: {
            ...entry.category,
            specificRules: assignmentSpecificRules ?? {},
          },
          isWorldRecord: worldRecordIds.has(record.submissionId),
        };
      };
      return {
        user,
        globalRank: Number(higherRanked?.value ?? 0) + 1,
        countryRank: user.countryCode ? Number(higherInCountry[0]?.value ?? 0) + 1 : null,
        countryPlayerCount: user.countryCode ? Number(countryPlayers[0]?.value ?? 0) : null,
        recordCount: allEntries.length,
        averageRecordPoints: allEntries.length
          ? allEntries.reduce((total, record) => total + record.points, 0) / allEntries.length
          : 0,
        page,
        pageSize,
        hasMore: allEntries.length > offset + pageSize,
        pinnedSubmissionIds,
        pinnedEntries: allEntries.filter((record) => pinnedIds.has(record.submissionId)).map(
          serializeRecord,
        ),
        worldRecordEntries: allEntries.filter((record) => worldRecordIds.has(record.submissionId))
          .map(serializeRecord),
        entries: allEntries.slice(offset, offset + pageSize).map(serializeRecord),
        mostPlayed: {
          totalPlayCount: Number(totalVerifiedPlays[0]?.value ?? 0),
          playHistory: playHistory.map((entry) => ({
            month: entry.month,
            playCount: Number(entry.playCount),
          })),
          games: mostPlayedGames.map((entry) => ({ ...entry, playCount: Number(entry.playCount) })),
          maps: mostPlayedMaps.map((entry) => ({ ...entry, playCount: Number(entry.playCount) })),
          categories: mostPlayedCategories.map((entry) => ({
            ...entry,
            playCount: Number(entry.playCount),
          })),
        },
      };
    },
    catch: (error) => error,
  });
}

export function getUserHistory(db: Database, userId: string, page?: string) {
  return parseHistoryPage(page).pipe(
    Effect.flatMap((page) =>
      Effect.tryPromise({
        try: async () => {
          const user = await getPublicUser(db, userId);

          const history = await db.select({
            submissionId: submissions.id,
            scoreValue: submissions.scoreValue,
            runDurationMs: submissions.runDurationMs,
            proofLevel: submissions.proofLevel,
            submittedAt: submissions.submittedAt,
            verifiedAt: submissions.verifiedAt,
            isBestRecord: sql<boolean>`${bestRecords.submissionId} IS NOT NULL`,
            points: bestRecords.points,
            game: { id: games.id, slug: games.slug, name: games.name },
            map: { id: maps.id, slug: maps.slug, name: maps.name },
            category: {
              id: categories.id,
              slug: categories.slug,
              name: categories.name,
              scoreType: categories.scoreType,
            },
          }).from(submissionParticipants).innerJoin(
            submissions,
            eq(submissionParticipants.submissionId, submissions.id),
          ).innerJoin(games, eq(submissions.gameId, games.id))
            .innerJoin(maps, eq(submissions.mapId, maps.id))
            .innerJoin(categories, eq(submissions.categoryId, categories.id))
            .leftJoin(bestRecords, eq(submissions.id, bestRecords.submissionId))
            .where(and(
              eq(submissionParticipants.userId, userId),
              eq(submissions.status, "verified"),
            ))
            .orderBy(desc(submissions.verifiedAt), desc(submissions.id))
            .limit(USER_HISTORY_PAGE_SIZE + 1)
            .offset(page * USER_HISTORY_PAGE_SIZE);

          return {
            user,
            page,
            pageSize: USER_HISTORY_PAGE_SIZE,
            hasMore: history.length > USER_HISTORY_PAGE_SIZE,
            entries: history.slice(0, USER_HISTORY_PAGE_SIZE),
          };
        },
        catch: (error) => error,
      })
    ),
  );
}

async function getPublicUser(db: Database, userId: string) {
  const [user] = await db.select({
    id: users.id,
    name: users.name,
    image: users.image,
    backgroundImage: users.backgroundImage,
    profileColor: users.profileColor,
    profileGradientColor: users.profileGradientColor,
    profileGradientAngle: users.profileGradientAngle,
    countryCode: users.countryCode,
    countryChangedAt: users.countryChangedAt,
    performancePoints: users.performancePoints,
  }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new NotFoundError("user not found");
  return user;
}

/** Rebuilds the persisted PP cache after a formula or data migration. */
export function recalculateAllPerformancePoints(db: Database) {
  return Effect.tryPromise({
    try: async () => {
      const playerRows = await db.selectDistinct({ userId: submissionParticipants.userId })
        .from(submissionParticipants)
        .innerJoin(bestRecords, eq(submissionParticipants.submissionId, bestRecords.submissionId));
      await recalculatePerformancePointsForUsers(
        db,
        playerRows.map((player) => player.userId),
        {
          source: "formula_change",
          formulaVersion: 5,
        },
      );
      await refreshScopedPerformanceForUsers(
        db,
        playerRows.map((player) => player.userId),
      );
      return { recalculatedUsers: playerRows.length };
    },
    catch: (error) => error,
  });
}
