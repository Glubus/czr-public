import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { Effect, Schema } from "effect";
import type { Database } from "../../db/client.ts";
import {
  achievementDefinitions,
  achievementMetricSnapshots,
  bestRecords,
  categories,
  categoryAssignments,
  challenges,
  games,
  maps,
  submissionParticipants,
  submissions,
  userAchievements,
  userGoals,
  users,
} from "../../db/schema.ts";
import { ConflictError, NotFoundError, ValidationError } from "../shared/errors.ts";
import { isBetterRecord } from "../submissions/ranking.ts";
import { getBestGlobalRosterRanksByUser } from "../submissions/roster-queries.ts";
import { parsePage } from "../shared/pagination.ts";
import { achievementQueryRegistry } from "./achievement-query-registry.ts";

const Metric = Schema.Literal(
  "performance_points",
  "verified_submissions",
  "world_records",
  "games_played",
  "team_records",
  "record_points",
  "classic_high_round",
  "bo3_high_round",
  "waw_high_round",
  "speedrun_30",
  "speedrun_50",
  "speedrun_100",
  "other_speedrun_30",
  "other_speedrun_50",
  "other_speedrun_100",
  "no_power_round",
  "maps_played",
  "team_best_rank",
  "map_top15_categories",
  "map_all_categories_top15",
  "world_records_2p",
  "world_records_3p",
  "world_records_4p",
  "team_formats_played",
  "categories_played",
  "game_high_round_top15_complete",
  "game_ee_top20_records",
  "game_all_ee_top20",
  "community_records",
  "community_best_rank",
  "bo3_gum_trio_best_rank",
  "back_from_the_dead",
  "podium_records",
  "jack_of_all_trades_top3",
  "game_specialist_records",
  "map_domination_best_rank",
  "dynamic_duo_records",
  "dynamic_duo_world_records",
  "distinct_top3_duo_partners",
  "distinct_top1_duo_partners",
  "duo_self_snipe",
  "self_wr_improvement",
  "wr_weekend",
  "wr_games",
  "longest_wr_reign_days",
  "record_breaker_days",
  "format_sweep_best_rank",
  "speedrun_ladder_best_rank",
  "no_crutches_best_rank",
  "clean_extraction_best_rank",
  "double_agent_best_rank",
  "restricted_arsenal_best_rank",
  "hardcore_credentials_best_rank",
  "first_room_official_round",
  "flawless_official_round",
  "extinction_protocol_best_rank",
  "endurance_best_rank",
  "bo3_reset_maps",
);
const ChallengeMetric = Schema.Literal("performance_points", "verified_submissions");
const GoalMetric = Schema.Literal("performance_points", "verified_submissions", "round", "time", "rank");
const CreateGoal = Schema.Struct({
  title: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(120)),
  metric: GoalMetric,
  targetValue: Schema.Number.pipe(Schema.positive()),
  dueAt: Schema.optional(Schema.NullOr(Schema.String)),
  gameId: Schema.optional(Schema.Number),
  mapId: Schema.optional(Schema.Number),
  categoryAssignmentId: Schema.optional(Schema.Number),
  playerCount: Schema.optional(Schema.Number),
});
const UpdateGoal = Schema.Struct({ status: Schema.Literal("active", "abandoned") });
const CreateAchievement = Schema.Struct({
  slug: Schema.String.pipe(Schema.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)),
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100)),
  description: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(500)),
  metric: Metric,
  threshold: Schema.Number.pipe(Schema.positive()),
  direction: Schema.optional(Schema.Literal("higher_is_better", "lower_is_better")),
  category: Schema.optional(Schema.String.pipe(Schema.minLength(1), Schema.maxLength(80))),
  series: Schema.optional(Schema.String.pipe(Schema.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))),
  tier: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  points: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
});
const CreateChallenge = Schema.Struct({
  slug: Schema.String.pipe(Schema.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)),
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100)),
  description: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(500)),
  metric: ChallengeMetric,
  targetValue: Schema.Number.pipe(Schema.positive()),
  startsAt: Schema.String,
  endsAt: Schema.String,
});

type MetricName = typeof Metric.Type;

export function createGoal(db: Database, userId: string, payload: unknown) {
  return decode(CreateGoal, payload).pipe(
    Effect.flatMap((value) =>
      databaseEffect(() =>
        db.transaction(async (transaction) => {
          const tx = transaction as unknown as Database;
          const dueAt = value.dueAt ? validDate(value.dueAt, "dueAt") : null;
          const boardMetric = ["round", "time", "rank"].includes(value.metric);
          if (boardMetric) {
            assertId(value.gameId ?? 0);
            assertId(value.mapId ?? 0);
            assertId(value.categoryAssignmentId ?? 0);
            if (![1, 2, 3, 4].includes(value.playerCount ?? 0)) {
              throw new ValidationError("playerCount must be between 1 and 4 for a board goal");
            }
            const board = await loadGoalBoard(
              tx,
              value.gameId!,
              value.mapId!,
              value.categoryAssignmentId!,
            );
            if (value.metric === "round" && board.category.scoreType !== "round") {
              throw new ValidationError("round goals require a round-based category");
            }
            if (value.metric === "time" && board.category.scoreType !== "time") {
              throw new ValidationError("time goals require a time-based category");
            }
          } else if (
            value.gameId !== undefined || value.mapId !== undefined ||
            value.categoryAssignmentId !== undefined ||
            value.playerCount !== undefined
          ) {
            throw new ValidationError("global goals cannot target a board");
          }
          const [created] = await tx.insert(userGoals).values({
            userId,
            title: value.title.trim(),
            metric: value.metric,
            targetValue: value.targetValue,
            dueAt,
            gameId: boardMetric ? value.gameId : null,
            mapId: boardMetric ? value.mapId : null,
            categoryAssignmentId: boardMetric ? value.categoryAssignmentId : null,
            playerCount: boardMetric ? value.playerCount : null,
          }).returning();
          return withProgress(tx, created!, userId);
        })
      )
    ),
  );
}

export function listGoals(db: Database, userId: string) {
  return databaseEffect(async () => {
    const rows = await db.select().from(userGoals).where(eq(userGoals.userId, userId))
      .orderBy(asc(userGoals.status), asc(userGoals.id));
    return await Promise.all(rows.map((goal) => withProgress(db, goal, userId)));
  });
}

export function updateGoal(db: Database, userId: string, goalId: number, payload: unknown) {
  return decode(UpdateGoal, payload).pipe(Effect.flatMap((value) =>
    databaseEffect(async () => {
      assertId(goalId);
      const [updated] = await db.update(userGoals).set({ status: value.status, updatedAt: new Date() }).where(
        and(
          eq(userGoals.id, goalId),
          eq(userGoals.userId, userId),
        ),
      ).returning();
      if (!updated) throw new NotFoundError("goal not found");
      return withProgress(db, updated, userId);
    })
  ));
}

export function createAchievement(db: Database, payload: unknown) {
  return decode(CreateAchievement, payload).pipe(Effect.flatMap((value) =>
    databaseEffect(async () => {
      try {
        const [created] = await db.insert(achievementDefinitions).values({
          ...value,
          name: value.name.trim(),
          description: value.description.trim(),
        }).returning();
        return created!;
      } catch (error) {
        if (isUniqueViolation(error)) throw new ConflictError("achievement slug already exists");
        throw error;
      }
    })
  ));
}

export function listAchievements(db: Database, userId?: string) {
  return databaseEffect(async () => {
    const definitions = await activeAchievementDefinitions(db);
    if (!userId) {
      return definitions.map((achievement) => ({
        ...achievement,
        progress: null,
        unlockedAt: null,
        achievementPoints: 0,
      }));
    }
    return calculateAchievements(db, userId, definitions);
  });
}

const ACHIEVEMENT_LEADERBOARD_PAGE_SIZE = 50;

export function getAchievementLeaderboard(db: Database, pageValue?: string, countryValue?: string) {
  return databaseEffect(async () => {
    const page = parsePage(pageValue);
    const country = countryValue?.trim().toUpperCase() || undefined;
    if (country && !/^[A-Z]{2}$/.test(country)) {
      throw new ValidationError("country must be an ISO 3166-1 alpha-2 code");
    }
    const conditions = [
      isNull(users.deletedAt),
      eq(achievementDefinitions.active, true),
    ];
    if (country) conditions.push(eq(users.countryCode, country));

    const [totalRows, rows] = await Promise.all([
      db.select({
        count: sql<number>`count(distinct ${users.id})::int`,
      }).from(userAchievements)
        .innerJoin(users, eq(userAchievements.userId, users.id))
        .innerJoin(
          achievementDefinitions,
          eq(userAchievements.achievementId, achievementDefinitions.id),
        )
        .where(and(...conditions)),
      db.select({
        user: {
          id: users.id,
          name: users.name,
          image: users.image,
          performancePoints: users.performancePoints,
        },
        achievementPoints: sql<number>`sum(${achievementDefinitions.points})::int`,
        unlockedCount: sql<number>`count(${userAchievements.id})::int`,
      }).from(userAchievements)
        .innerJoin(users, eq(userAchievements.userId, users.id))
        .innerJoin(
          achievementDefinitions,
          eq(userAchievements.achievementId, achievementDefinitions.id),
        )
        .where(and(...conditions))
        .groupBy(users.id)
        .orderBy(
          desc(sql`sum(${achievementDefinitions.points})`),
          desc(sql`count(${userAchievements.id})`),
          asc(users.id),
        )
        .limit(ACHIEVEMENT_LEADERBOARD_PAGE_SIZE)
        .offset(page * ACHIEVEMENT_LEADERBOARD_PAGE_SIZE),
    ]);
    const totalEntries = Number(totalRows[0]?.count ?? 0);
    return {
      filters: { country: country ?? null },
      page,
      pageSize: ACHIEVEMENT_LEADERBOARD_PAGE_SIZE,
      totalEntries,
      totalPages: Math.ceil(totalEntries / ACHIEVEMENT_LEADERBOARD_PAGE_SIZE),
      hasMore: totalEntries > (page + 1) * ACHIEVEMENT_LEADERBOARD_PAGE_SIZE,
      entries: rows.map((entry, index) => ({
        rank: page * ACHIEVEMENT_LEADERBOARD_PAGE_SIZE + index + 1,
        ...entry,
        achievementPoints: Number(entry.achievementPoints),
        unlockedCount: Number(entry.unlockedCount),
      })),
    };
  });
}

export function recalculateAllAchievements(db: Database) {
  return databaseEffect(async () => {
    const definitions = await activeAchievementDefinitions(db);
    const players = await db.select({
      id: users.id,
      performancePoints: users.performancePoints,
    }).from(users).where(isNull(users.deletedAt));
    const [before] = await db.select({ count: sql<number>`count(*)::int` }).from(userAchievements);
    const metrics = await allAchievementMetricValues(db, players);
    const batchSize = 100;
    for (let offset = 0; offset < players.length; offset += batchSize) {
      const batch = players.slice(offset, offset + batchSize);
      const earned = batch.flatMap((player) =>
        definitions
          .filter((definition) =>
            achievementUnlocked(
              metrics.get(player.id)?.[definition.metric] ?? null,
              definition.threshold,
              definition.direction,
            )
          )
          .map((definition) => ({ userId: player.id, achievementId: definition.id }))
      );
      if (earned.length) await db.insert(userAchievements).values(earned).onConflictDoNothing();
      await db.insert(achievementMetricSnapshots).values(batch.map((player) => ({
        userId: player.id,
        values: metrics.get(player.id) ?? emptyAchievementMetricValues(player.performancePoints),
        calculatedAt: new Date(),
      }))).onConflictDoUpdate({
        target: achievementMetricSnapshots.userId,
        set: {
          values: sql`excluded.values`,
          calculatedAt: sql`excluded.calculated_at`,
        },
      });
    }
    const [after] = await db.select({ count: sql<number>`count(*)::int` }).from(userAchievements);
    const totalUnlocks = Number(after?.count ?? 0);
    return {
      playersProcessed: players.length,
      newUnlocks: totalUnlocks - Number(before?.count ?? 0),
      totalUnlocks,
    };
  });
}

type AchievementDefinition = typeof achievementDefinitions.$inferSelect;
type AchievementMetricValues = Record<MetricName, number | null>;

function activeAchievementDefinitions(db: Database) {
  return db.select().from(achievementDefinitions)
    .where(eq(achievementDefinitions.active, true))
    .orderBy(
      asc(achievementDefinitions.category),
      asc(achievementDefinitions.series),
      asc(achievementDefinitions.tier),
    );
}

async function calculateAchievements(
  db: Database,
  userId: string,
  definitions: AchievementDefinition[],
) {
  const [snapshot] = await db.select({ values: achievementMetricSnapshots.values })
    .from(achievementMetricSnapshots)
    .where(eq(achievementMetricSnapshots.userId, userId))
    .limit(1);
  const values = snapshot?.values as AchievementMetricValues | undefined ??
    await metricValues(db, userId);
  if (!snapshot) {
    await db.insert(achievementMetricSnapshots).values({
      userId,
      values,
      calculatedAt: new Date(),
    }).onConflictDoUpdate({
      target: achievementMetricSnapshots.userId,
      set: { values, calculatedAt: new Date() },
    });
  }
  const earned = definitions.filter((definition) =>
    achievementUnlocked(values[definition.metric], definition.threshold, definition.direction)
  );
  if (earned.length) {
    await db.insert(userAchievements).values(earned.map((achievement) => ({
      userId,
      achievementId: achievement.id,
    }))).onConflictDoNothing();
  }
  const unlocks = await db.select().from(userAchievements).where(eq(userAchievements.userId, userId));
  const byAchievement = new Map(unlocks.map((unlock) => [unlock.achievementId, unlock.unlockedAt]));
  const achievementPoints = definitions.reduce(
    (total, achievement) => total + (byAchievement.has(achievement.id) ? achievement.points : 0),
    0,
  );
  return definitions.map((achievement) => ({
    ...achievement,
    progress: values[achievement.metric],
    unlockedAt: byAchievement.get(achievement.id) ?? null,
    achievementPoints,
  }));
}

export function createChallenge(db: Database, payload: unknown) {
  return decode(CreateChallenge, payload).pipe(Effect.flatMap((value) =>
    databaseEffect(async () => {
      const startsAt = validDate(value.startsAt, "startsAt");
      const endsAt = validDate(value.endsAt, "endsAt");
      if (endsAt <= startsAt) throw new ValidationError("endsAt must be after startsAt");
      try {
        const [created] = await db.insert(challenges).values({
          ...value,
          name: value.name.trim(),
          description: value.description.trim(),
          startsAt,
          endsAt,
        }).returning();
        return created!;
      } catch (error) {
        if (isUniqueViolation(error)) throw new ConflictError("challenge slug already exists");
        throw error;
      }
    })
  ));
}

export function listChallenges(db: Database, userId?: string) {
  return databaseEffect(async () => {
    const rows = await db.select().from(challenges).where(eq(challenges.active, true))
      .orderBy(asc(challenges.startsAt), asc(challenges.id));
    return await Promise.all(rows.map(async (challenge) => ({
      ...challenge,
      progress: userId
        ? await metricValue(db, userId, challenge.metric, challenge.startsAt, challenge.endsAt)
        : null,
    })));
  });
}

async function withProgress(db: Database, goal: typeof userGoals.$inferSelect, userId: string) {
  const board = goal.mapId && goal.gameId && goal.categoryAssignmentId
    ? await loadGoalBoard(db, goal.gameId, goal.mapId, goal.categoryAssignmentId)
    : null;
  const progress = board
    ? await boardGoalProgress(db, userId, goal, board.category)
    : await metricValue(db, userId, goal.metric as MetricName);
  const completed = goal.metric === "time" || goal.metric === "rank"
    ? progress > 0 && progress <= goal.targetValue
    : progress >= goal.targetValue;
  if (completed && goal.status === "active") {
    const [updated] = await db.update(userGoals).set({ status: "completed", updatedAt: new Date() })
      .where(eq(userGoals.id, goal.id)).returning();
    return {
      ...(updated ?? goal),
      progress,
      direction: goal.metric === "time" || goal.metric === "rank" ? "lower_is_better" : "higher_is_better",
      board,
    };
  }
  return {
    ...goal,
    progress,
    direction: goal.metric === "time" || goal.metric === "rank" ? "lower_is_better" : "higher_is_better",
    board,
  };
}

async function loadGoalBoard(db: Database, gameId: number, mapId: number, assignmentId: number) {
  const [board] = await db.select({
    game: { id: games.id, slug: games.slug, name: games.name },
    map: { id: maps.id, slug: maps.slug, name: maps.name },
    assignmentId: categoryAssignments.id,
    category: {
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      scoreType: categories.scoreType,
      rankingDirection: categories.rankingDirection,
    },
  }).from(categoryAssignments)
    .innerJoin(games, eq(categoryAssignments.gameId, games.id))
    .innerJoin(maps, eq(maps.id, mapId))
    .innerJoin(categories, eq(categoryAssignments.categoryId, categories.id))
    .where(and(
      eq(categoryAssignments.id, assignmentId),
      eq(categoryAssignments.gameId, gameId),
      eq(maps.gameId, gameId),
      or(eq(categoryAssignments.mapId, mapId), sql`${categoryAssignments.mapId} IS NULL`),
    )).limit(1);
  if (!board) throw new ValidationError("goal board does not exist or the assignment does not apply");
  return board;
}

async function boardGoalProgress(
  db: Database,
  userId: string,
  goal: typeof userGoals.$inferSelect,
  category: { scoreType: string; rankingDirection: "higher_is_better" | "lower_is_better" },
) {
  const records = await db.select({
    submissionId: submissions.id,
    scoreValue: submissions.scoreValue,
    runDurationMs: submissions.runDurationMs,
    verifiedAt: submissions.verifiedAt,
  }).from(bestRecords).innerJoin(submissions, eq(bestRecords.submissionId, submissions.id)).where(and(
    eq(submissions.mapId, goal.mapId!),
    eq(submissions.categoryAssignmentId, goal.categoryAssignmentId!),
    eq(submissions.playerCount, goal.playerCount!),
  ));
  if (!records.length) return 0;
  const participantRows = await db.select({ submissionId: submissionParticipants.submissionId })
    .from(submissionParticipants).where(and(
      eq(submissionParticipants.userId, userId),
      eq(submissionParticipants.isPersonalBest, true),
      inArray(submissionParticipants.submissionId, records.map((record) => record.submissionId)),
    ));
  const ownIds = new Set(participantRows.map((row) => row.submissionId));
  const ranked = records.sort((left, right) => compareBoardRecords(left, right, category));
  const ownIndex = ranked.findIndex((record) => ownIds.has(record.submissionId));
  if (ownIndex < 0) return 0;
  const own = ranked[ownIndex]!;
  if (goal.metric === "rank") return ownIndex + 1;
  return goal.metric === "time" ? own.runDurationMs ?? own.scoreValue : own.scoreValue;
}

function compareBoardRecords(
  left: { scoreValue: number; runDurationMs: number | null; verifiedAt: Date | null; submissionId: number },
  right: { scoreValue: number; runDurationMs: number | null; verifiedAt: Date | null; submissionId: number },
  category: { scoreType: string; rankingDirection: "higher_is_better" | "lower_is_better" },
) {
  if (
    isBetterRecord(
      left.scoreValue,
      right.scoreValue,
      left.runDurationMs,
      right.runDurationMs,
      category.scoreType,
      category.rankingDirection,
    )
  ) return -1;
  if (
    isBetterRecord(
      right.scoreValue,
      left.scoreValue,
      right.runDurationMs,
      left.runDurationMs,
      category.scoreType,
      category.rankingDirection,
    )
  ) return 1;
  return (left.verifiedAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
      (right.verifiedAt?.getTime() ?? Number.MAX_SAFE_INTEGER) || left.submissionId - right.submissionId;
}

async function metricValues(db: Database, userId: string): Promise<Record<MetricName, number | null>> {
  const [
    performancePoints,
    verifiedSubmissions,
    worldRecordMetrics,
    gamesPlayed,
    teamRecords,
    mapsPlayed,
    teamFormatsPlayed,
    categoriesPlayed,
    recordMetrics,
    masteryMetrics,
    gameCompletion,
    eeMetrics,
    communityMetrics,
    bo3GumTrioBestRank,
    competitiveMetrics,
    teamworkMetrics,
    historicalWorldRecordMetrics,
  ] = await Promise.all([
    metricValue(db, userId, "performance_points"),
    metricValue(db, userId, "verified_submissions"),
    worldRecordAchievementValues(db, userId),
    metricValue(db, userId, "games_played"),
    metricValue(db, userId, "team_records"),
    metricValue(db, userId, "maps_played"),
    metricValue(db, userId, "team_formats_played"),
    metricValue(db, userId, "categories_played"),
    recordAchievementValues(db, userId),
    masteryAchievementValues(db, userId),
    gameHighRoundCompletionValue(db, userId),
    gameEeTop20Values(db, userId),
    communityAchievementValues(db, userId),
    bo3GumTrioBestRankValue(db, userId),
    competitiveAchievementValues(db, userId),
    teamworkAchievementValues(db, userId),
    historicalWorldRecordAchievementValues(db, userId),
  ]);
  return {
    performance_points: performancePoints,
    verified_submissions: verifiedSubmissions,
    ...worldRecordMetrics,
    games_played: gamesPlayed,
    team_records: teamRecords,
    maps_played: mapsPlayed,
    team_formats_played: teamFormatsPlayed,
    categories_played: categoriesPlayed,
    ...recordMetrics,
    ...masteryMetrics,
    game_high_round_top15_complete: masteryMetrics.map_all_categories_top15 >= 1 && gameCompletion >= 1
      ? 1
      : 0,
    ...eeMetrics,
    ...communityMetrics,
    bo3_gum_trio_best_rank: bo3GumTrioBestRank,
    ...competitiveMetrics,
    ...teamworkMetrics,
    ...historicalWorldRecordMetrics,
  };
}

async function allAchievementMetricValues(
  db: Database,
  players: Array<{ id: string; performancePoints: number }>,
) {
  const values = new Map<string, AchievementMetricValues>(
    players.map((player) => [player.id, emptyAchievementMetricValues(player.performancePoints)]),
  );
  const [
    submissionRows,
    worldRecordRows,
    recordRows,
    masteryRows,
    gameCompletionRows,
    eeRows,
    globalTeamRanks,
    communityRows,
    bo3GumRows,
    competitiveRows,
    teamworkRows,
    historicalWorldRecordRows,
  ] = await Promise.all([
    db.execute<{
      user_id: string;
      verified_submissions: number;
      games_played: number;
      maps_played: number;
      team_records: number;
      team_formats_played: number;
      categories_played: number;
    }>(sql`
      SELECT participant.user_id,
        count(distinct runs.id)::int AS verified_submissions,
        count(distinct runs.game_id)::int AS games_played,
        count(distinct runs.map_id)::int AS maps_played,
        count(distinct runs.id) FILTER (WHERE runs.player_count > 1)::int AS team_records,
        count(distinct runs.player_count) FILTER (WHERE runs.player_count > 1)::int
          AS team_formats_played,
        count(distinct runs.category_id)::int AS categories_played
      FROM submission_participants participant
      JOIN submissions runs ON runs.id = participant.submission_id
      WHERE runs.status = 'verified' AND participant.status = 'accepted'
      GROUP BY participant.user_id
    `),
    db.execute<{
      user_id: string;
      world_records: number;
      world_records_2p: number;
      world_records_3p: number;
      world_records_4p: number;
    }>(sql`
      WITH ranked_records AS (
        SELECT runs.id AS submission_id,
          runs.player_count,
          row_number() OVER (
            PARTITION BY runs.map_id, runs.category_id, runs.category_assignment_id, runs.player_count
            ORDER BY
              CASE WHEN category.score_type = 'round' OR category.ranking_direction = 'higher_is_better'
                THEN runs.score_value END DESC NULLS LAST,
              CASE WHEN category.score_type <> 'round' AND category.ranking_direction = 'lower_is_better'
                THEN runs.score_value END ASC NULLS LAST,
              CASE WHEN category.score_type = 'round' THEN runs.run_duration_ms END ASC NULLS LAST,
              runs.verified_at ASC, runs.id ASC
          ) AS board_rank
        FROM best_records records
        JOIN submissions runs ON runs.id = records.submission_id
        JOIN categories category ON category.id = runs.category_id
      )
      SELECT participant.user_id,
        count(distinct ranked.submission_id)::int AS world_records,
        count(distinct ranked.submission_id) FILTER (WHERE ranked.player_count = 2)::int
          AS world_records_2p,
        count(distinct ranked.submission_id) FILTER (WHERE ranked.player_count = 3)::int
          AS world_records_3p,
        count(distinct ranked.submission_id) FILTER (WHERE ranked.player_count = 4)::int
          AS world_records_4p
      FROM ranked_records ranked
      JOIN submission_participants participant ON participant.submission_id = ranked.submission_id
      WHERE ranked.board_rank = 1 AND participant.status = 'accepted'
      GROUP BY participant.user_id
    `),
    db.execute<{
      user_id: string;
      record_points: number | null;
      classic_high_round: number | null;
      bo3_high_round: number | null;
      waw_high_round: number | null;
      speedrun_30: number | null;
      speedrun_50: number | null;
      speedrun_100: number | null;
      other_speedrun_30: number | null;
      other_speedrun_50: number | null;
      other_speedrun_100: number | null;
      no_power_round: number | null;
    }>(sql`
      SELECT participant.user_id,
        max(records.points) AS record_points,
        max(CASE WHEN game.slug IN ('bo', 'bo2', 'bo3')
          AND category.slug IN ('high-round', 'high-round-hc', 'high-round-survival')
          THEN runs.score_value END) AS classic_high_round,
        max(CASE WHEN game.slug = 'bo3'
          AND category.slug IN ('high-round', 'high-round-hc', 'high-round-survival')
          THEN runs.score_value END) AS bo3_high_round,
        max(CASE WHEN game.slug = 'waw'
          AND category.slug IN ('high-round', 'high-round-hc', 'high-round-survival')
          THEN runs.score_value END) AS waw_high_round,
        min(CASE WHEN game.slug IN ('bo', 'bo2', 'bo3')
          AND category.slug IN ('30-speedrun', '30-speedrun-survival', 'com-remix-30-speedrun')
          THEN coalesce(runs.run_duration_ms, runs.score_value) END) AS speedrun_30,
        min(CASE WHEN game.slug IN ('bo', 'bo2', 'bo3')
          AND category.slug IN ('50-speedrun', 'com-remix-50-speedrun')
          THEN coalesce(runs.run_duration_ms, runs.score_value) END) AS speedrun_50,
        min(CASE WHEN game.slug IN ('bo', 'bo2', 'bo3') AND category.slug = '100-speedrun'
          THEN coalesce(runs.run_duration_ms, runs.score_value) END) AS speedrun_100,
        min(CASE WHEN game.slug NOT IN ('bo', 'bo2', 'bo3')
          AND category.slug IN ('30-speedrun', '30-speedrun-survival', 'com-remix-30-speedrun')
          THEN coalesce(runs.run_duration_ms, runs.score_value) END) AS other_speedrun_30,
        min(CASE WHEN game.slug NOT IN ('bo', 'bo2', 'bo3')
          AND category.slug IN ('50-speedrun', 'com-remix-50-speedrun')
          THEN coalesce(runs.run_duration_ms, runs.score_value) END) AS other_speedrun_50,
        min(CASE WHEN game.slug NOT IN ('bo', 'bo2', 'bo3') AND category.slug = '100-speedrun'
          THEN coalesce(runs.run_duration_ms, runs.score_value) END) AS other_speedrun_100,
        max(CASE WHEN game.slug IN ('bo', 'bo2', 'bo3', 'bo4')
          AND category.slug = 'no-power'
          THEN runs.score_value END) AS no_power_round
      FROM best_records records
      JOIN submissions runs ON runs.id = records.submission_id
      JOIN submission_participants participant ON participant.submission_id = runs.id
      JOIN games game ON game.id = runs.game_id
      JOIN categories category ON category.id = runs.category_id
      WHERE participant.status = 'accepted' AND runs.status = 'verified'
      GROUP BY participant.user_id
    `),
    db.execute<{
      user_id: string;
      map_top15_categories: number;
      map_all_categories_top15: number;
    }>(sql`
      WITH ranked_records AS (
        SELECT runs.id AS submission_id,
          runs.map_id,
          runs.category_id,
          runs.player_count,
          row_number() OVER (
            PARTITION BY runs.map_id, runs.category_id, runs.category_assignment_id, runs.player_count
            ORDER BY
              CASE WHEN category.score_type = 'round' OR category.ranking_direction = 'higher_is_better'
                THEN runs.score_value END DESC NULLS LAST,
              CASE WHEN category.score_type <> 'round' AND category.ranking_direction = 'lower_is_better'
                THEN runs.score_value END ASC NULLS LAST,
              CASE WHEN category.score_type = 'round' THEN runs.run_duration_ms END ASC NULLS LAST,
              runs.verified_at ASC, runs.id ASC
          ) AS board_rank
        FROM best_records records
        JOIN submissions runs ON runs.id = records.submission_id
        JOIN categories category ON category.id = runs.category_id
      ),
      map_totals AS (
        SELECT assignment.map_id, count(distinct assignment.category_id)::int AS category_count
        FROM category_assignments assignment
        WHERE assignment.map_id IS NOT NULL
        GROUP BY assignment.map_id
        HAVING count(distinct assignment.category_id) >= 5
      ),
      player_map_progress AS (
        SELECT participant.user_id, ranked.map_id,
          count(distinct ranked.category_id) FILTER (WHERE ranked.board_rank <= 15)::int
            AS top15_categories
        FROM ranked_records ranked
        JOIN submission_participants participant ON participant.submission_id = ranked.submission_id
        JOIN map_totals total ON total.map_id = ranked.map_id
        WHERE participant.status = 'accepted'
        GROUP BY participant.user_id, ranked.map_id
      ),
      mastery AS (
        SELECT progress.user_id,
          max(progress.top15_categories)::int AS map_top15_categories,
          max(CASE WHEN progress.top15_categories >= total.category_count THEN 1 ELSE 0 END)::int
            AS map_all_categories_top15
        FROM player_map_progress progress
        JOIN map_totals total ON total.map_id = progress.map_id
        GROUP BY progress.user_id
      )
      SELECT mastery.user_id,
        mastery.map_top15_categories,
        mastery.map_all_categories_top15
      FROM mastery
    `),
    db.execute<{ user_id: string; game_high_round_top15_complete: number }>(sql`
      WITH ranked_records AS (
        SELECT runs.id AS submission_id,
          runs.game_id,
          runs.map_id,
          runs.category_id,
          row_number() OVER (
            PARTITION BY runs.map_id, runs.category_id, runs.category_assignment_id, runs.player_count
            ORDER BY
              CASE WHEN category.score_type = 'round' OR category.ranking_direction = 'higher_is_better'
                THEN runs.score_value END DESC NULLS LAST,
              CASE WHEN category.score_type <> 'round' AND category.ranking_direction = 'lower_is_better'
                THEN runs.score_value END ASC NULLS LAST,
              CASE WHEN category.score_type = 'round' THEN runs.run_duration_ms END ASC NULLS LAST,
              runs.verified_at ASC, runs.id ASC
          ) AS board_rank
        FROM best_records records
        JOIN submissions runs ON runs.id = records.submission_id
        JOIN categories category ON category.id = runs.category_id
      ),
      high_round_maps AS (
        SELECT assignment.game_id, assignment.map_id
        FROM category_assignments assignment
        JOIN categories category ON category.id = assignment.category_id
        WHERE assignment.map_id IS NOT NULL
          AND category.slug IN ('high-round', 'high-round-hc', 'high-round-survival')
        GROUP BY assignment.game_id, assignment.map_id
      ),
      completed_games AS (
        SELECT participant.user_id, ranked.game_id
        FROM ranked_records ranked
        JOIN submission_participants participant ON participant.submission_id = ranked.submission_id
        JOIN high_round_maps eligible
          ON eligible.game_id = ranked.game_id AND eligible.map_id = ranked.map_id
        WHERE participant.status = 'accepted' AND ranked.board_rank <= 15
        GROUP BY participant.user_id, ranked.game_id
        HAVING count(distinct ranked.map_id) = (
          SELECT count(*) FROM high_round_maps total WHERE total.game_id = ranked.game_id
        )
      )
      SELECT user_id, 1::int AS game_high_round_top15_complete
      FROM completed_games
      GROUP BY user_id
    `),
    db.execute<{
      user_id: string;
      game_ee_top20_records: number;
      game_all_ee_top20: number;
    }>(sql`
      WITH ranked_records AS (
        SELECT runs.id AS submission_id,
          runs.game_id,
          runs.category_assignment_id,
          row_number() OVER (
            PARTITION BY runs.map_id, runs.category_id, runs.category_assignment_id, runs.player_count
            ORDER BY
              CASE WHEN category.score_type = 'round' OR category.ranking_direction = 'higher_is_better'
                THEN runs.score_value END DESC NULLS LAST,
              CASE WHEN category.score_type <> 'round' AND category.ranking_direction = 'lower_is_better'
                THEN runs.score_value END ASC NULLS LAST,
              CASE WHEN category.score_type = 'round' THEN runs.run_duration_ms END ASC NULLS LAST,
              runs.verified_at ASC, runs.id ASC
          ) AS board_rank
        FROM best_records records
        JOIN submissions runs ON runs.id = records.submission_id
        JOIN categories category ON category.id = runs.category_id
        WHERE category.slug = 'ee-speedrun'
      ),
      ee_totals AS (
        SELECT assignment.game_id, count(distinct assignment.id)::int AS ee_count
        FROM category_assignments assignment
        JOIN categories category ON category.id = assignment.category_id
        WHERE category.slug = 'ee-speedrun' AND assignment.map_id IS NOT NULL
        GROUP BY assignment.game_id
      ),
      progress AS (
        SELECT participant.user_id, ranked.game_id,
          count(distinct ranked.category_assignment_id)::int AS top20_count
        FROM ranked_records ranked
        JOIN submission_participants participant ON participant.submission_id = ranked.submission_id
        WHERE participant.status = 'accepted' AND ranked.board_rank <= 20
        GROUP BY participant.user_id, ranked.game_id
      )
      SELECT progress.user_id,
        max(progress.top20_count)::int AS game_ee_top20_records,
        max(CASE WHEN progress.top20_count >= total.ee_count THEN 1 ELSE 0 END)::int
          AS game_all_ee_top20
      FROM progress
      JOIN ee_totals total ON total.game_id = progress.game_id
      GROUP BY progress.user_id
    `),
    getBestGlobalRosterRanksByUser(db, true),
    achievementQueryRegistry.community.load(db),
    achievementQueryRegistry.bo3GumTrio.load(db),
    achievementQueryRegistry.competitive.load(db),
    achievementQueryRegistry.teamwork.load(db),
    achievementQueryRegistry.historicalWorldRecords.load(db),
  ]);
  for (const row of submissionRows) {
    const target = values.get(row.user_id);
    if (!target) continue;
    Object.assign(target, {
      verified_submissions: Number(row.verified_submissions),
      games_played: Number(row.games_played),
      maps_played: Number(row.maps_played),
      team_records: Number(row.team_records),
      team_formats_played: Number(row.team_formats_played),
      categories_played: Number(row.categories_played),
    });
  }
  for (const row of worldRecordRows) {
    const target = values.get(row.user_id);
    if (!target) continue;
    Object.assign(target, {
      world_records: Number(row.world_records),
      world_records_2p: Number(row.world_records_2p),
      world_records_3p: Number(row.world_records_3p),
      world_records_4p: Number(row.world_records_4p),
    });
  }
  for (const row of recordRows) {
    const target = values.get(row.user_id);
    if (!target) continue;
    Object.assign(target, {
      record_points: nullableNumber(row.record_points),
      classic_high_round: nullableNumber(row.classic_high_round),
      bo3_high_round: nullableNumber(row.bo3_high_round),
      waw_high_round: nullableNumber(row.waw_high_round),
      speedrun_30: nullableNumber(row.speedrun_30),
      speedrun_50: nullableNumber(row.speedrun_50),
      speedrun_100: nullableNumber(row.speedrun_100),
      other_speedrun_30: nullableNumber(row.other_speedrun_30),
      other_speedrun_50: nullableNumber(row.other_speedrun_50),
      other_speedrun_100: nullableNumber(row.other_speedrun_100),
      no_power_round: nullableNumber(row.no_power_round),
    });
  }
  for (const row of masteryRows) {
    const target = values.get(row.user_id);
    if (!target) continue;
    Object.assign(target, {
      map_top15_categories: Number(row.map_top15_categories),
      map_all_categories_top15: Number(row.map_all_categories_top15),
    });
  }
  for (const row of gameCompletionRows) {
    const target = values.get(row.user_id);
    if (target?.map_all_categories_top15 && target.map_all_categories_top15 >= 1) {
      target.game_high_round_top15_complete = 1;
    }
  }
  for (const row of eeRows) {
    const target = values.get(row.user_id);
    if (!target) continue;
    target.game_ee_top20_records = Number(row.game_ee_top20_records);
    target.game_all_ee_top20 = Number(row.game_all_ee_top20);
  }
  for (const [userId, rank] of globalTeamRanks) {
    const target = values.get(userId);
    if (target) target.team_best_rank = rank;
  }
  for (const row of communityRows) {
    const target = values.get(row.userId);
    if (!target) continue;
    target.community_records = row.communityRecords;
    target.community_best_rank = row.communityBestRank;
  }
  for (const row of bo3GumRows) {
    const target = values.get(row.userId);
    if (target) target.bo3_gum_trio_best_rank = row.bestRank;
  }
  for (const row of competitiveRows) {
    const target = values.get(row.userId);
    if (!target) continue;
    Object.assign(target, {
      podium_records: row.podiumRecords,
      jack_of_all_trades_top3: row.jackOfAllTradesTop3,
      game_specialist_records: row.gameSpecialistRecords,
      map_domination_best_rank: row.mapDominationBestRank,
      wr_games: row.worldRecordGames,
      format_sweep_best_rank: row.formatSweepBestRank,
      speedrun_ladder_best_rank: row.speedrunLadderBestRank,
      no_crutches_best_rank: row.noCrutchesBestRank,
      clean_extraction_best_rank: row.cleanExtractionBestRank,
      double_agent_best_rank: row.doubleAgentBestRank,
      restricted_arsenal_best_rank: row.restrictedArsenalBestRank,
      hardcore_credentials_best_rank: row.hardcoreCredentialsBestRank,
      first_room_official_round: row.firstRoomOfficialRound,
      flawless_official_round: row.flawlessOfficialRound,
      extinction_protocol_best_rank: row.extinctionProtocolBestRank,
      endurance_best_rank: row.enduranceBestRank,
      bo3_reset_maps: row.bo3ResetMaps,
    });
  }
  for (const row of teamworkRows) {
    const target = values.get(row.userId);
    if (!target) continue;
    Object.assign(target, {
      dynamic_duo_records: row.dynamicDuoRecords,
      dynamic_duo_world_records: row.dynamicDuoWorldRecords,
      distinct_top3_duo_partners: row.distinctTop3Partners,
      distinct_top1_duo_partners: row.distinctTop1Partners,
    });
  }
  for (const row of historicalWorldRecordRows) {
    const target = values.get(row.userId);
    if (!target) continue;
    Object.assign(target, {
      back_from_the_dead: row.backFromTheDead,
      duo_self_snipe: row.duoSelfSnipe,
      self_wr_improvement: row.selfWorldRecordImprovement,
      wr_weekend: row.wrWeekend,
      longest_wr_reign_days: row.longestReignDays,
      record_breaker_days: row.recordBreakerDays,
    });
  }
  return values;
}

function emptyAchievementMetricValues(performancePoints: number): AchievementMetricValues {
  return {
    performance_points: performancePoints,
    verified_submissions: 0,
    world_records: 0,
    games_played: 0,
    team_records: 0,
    record_points: null,
    classic_high_round: null,
    bo3_high_round: null,
    waw_high_round: null,
    speedrun_30: null,
    speedrun_50: null,
    speedrun_100: null,
    other_speedrun_30: null,
    other_speedrun_50: null,
    other_speedrun_100: null,
    no_power_round: null,
    maps_played: 0,
    team_best_rank: null,
    map_top15_categories: 0,
    map_all_categories_top15: 0,
    world_records_2p: 0,
    world_records_3p: 0,
    world_records_4p: 0,
    team_formats_played: 0,
    categories_played: 0,
    game_high_round_top15_complete: 0,
    game_ee_top20_records: 0,
    game_all_ee_top20: 0,
    community_records: 0,
    community_best_rank: null,
    bo3_gum_trio_best_rank: null,
    back_from_the_dead: 0,
    podium_records: 0,
    jack_of_all_trades_top3: 0,
    game_specialist_records: 0,
    map_domination_best_rank: null,
    dynamic_duo_records: 0,
    dynamic_duo_world_records: 0,
    distinct_top3_duo_partners: 0,
    distinct_top1_duo_partners: 0,
    duo_self_snipe: 0,
    self_wr_improvement: 0,
    wr_weekend: 0,
    wr_games: 0,
    longest_wr_reign_days: 0,
    record_breaker_days: 0,
    format_sweep_best_rank: null,
    speedrun_ladder_best_rank: null,
    no_crutches_best_rank: null,
    clean_extraction_best_rank: null,
    double_agent_best_rank: null,
    restricted_arsenal_best_rank: null,
    hardcore_credentials_best_rank: null,
    first_room_official_round: null,
    flawless_official_round: null,
    extinction_protocol_best_rank: null,
    endurance_best_rank: null,
    bo3_reset_maps: 0,
  };
}

function achievementUnlocked(
  progress: number | null,
  threshold: number,
  direction: "higher_is_better" | "lower_is_better",
) {
  if (progress === null) return false;
  return direction === "lower_is_better" ? progress <= threshold : progress >= threshold;
}

async function recordAchievementValues(db: Database, userId: string) {
  const rows = await db.execute<{
    record_points: number | null;
    classic_high_round: number | null;
    bo3_high_round: number | null;
    waw_high_round: number | null;
    speedrun_30: number | null;
    speedrun_50: number | null;
    speedrun_100: number | null;
    other_speedrun_30: number | null;
    other_speedrun_50: number | null;
    other_speedrun_100: number | null;
    no_power_round: number | null;
  }>(sql`
    SELECT
      max(records.points) AS record_points,
      max(CASE
        WHEN game.slug IN ('bo', 'bo2', 'bo3')
          AND category.slug IN ('high-round', 'high-round-hc', 'high-round-survival')
        THEN runs.score_value END) AS classic_high_round,
      max(CASE
        WHEN game.slug = 'bo3'
          AND category.slug IN ('high-round', 'high-round-hc', 'high-round-survival')
        THEN runs.score_value END) AS bo3_high_round,
      max(CASE
        WHEN game.slug = 'waw'
          AND category.slug IN ('high-round', 'high-round-hc', 'high-round-survival')
        THEN runs.score_value END) AS waw_high_round,
      min(CASE
        WHEN game.slug IN ('bo', 'bo2', 'bo3')
          AND category.slug IN ('30-speedrun', '30-speedrun-survival', 'com-remix-30-speedrun')
        THEN coalesce(runs.run_duration_ms, runs.score_value) END) AS speedrun_30,
      min(CASE
        WHEN game.slug IN ('bo', 'bo2', 'bo3')
          AND category.slug IN ('50-speedrun', 'com-remix-50-speedrun')
        THEN coalesce(runs.run_duration_ms, runs.score_value) END) AS speedrun_50,
      min(CASE
        WHEN game.slug IN ('bo', 'bo2', 'bo3') AND category.slug = '100-speedrun'
        THEN coalesce(runs.run_duration_ms, runs.score_value) END) AS speedrun_100,
      min(CASE
        WHEN game.slug NOT IN ('bo', 'bo2', 'bo3')
          AND category.slug IN ('30-speedrun', '30-speedrun-survival', 'com-remix-30-speedrun')
        THEN coalesce(runs.run_duration_ms, runs.score_value) END) AS other_speedrun_30,
      min(CASE
        WHEN game.slug NOT IN ('bo', 'bo2', 'bo3')
          AND category.slug IN ('50-speedrun', 'com-remix-50-speedrun')
        THEN coalesce(runs.run_duration_ms, runs.score_value) END) AS other_speedrun_50,
      min(CASE
        WHEN game.slug NOT IN ('bo', 'bo2', 'bo3') AND category.slug = '100-speedrun'
        THEN coalesce(runs.run_duration_ms, runs.score_value) END) AS other_speedrun_100,
      max(CASE
        WHEN game.slug IN ('bo', 'bo2', 'bo3', 'bo4')
          AND category.slug = 'no-power'
        THEN runs.score_value END) AS no_power_round
    FROM best_records records
    JOIN submissions runs ON runs.id = records.submission_id
    JOIN submission_participants participant ON participant.submission_id = runs.id
    JOIN games game ON game.id = runs.game_id
    JOIN categories category ON category.id = runs.category_id
    WHERE participant.user_id = ${userId}
      AND participant.status = 'accepted'
      AND runs.status = 'verified'
  `);
  const row = rows[0];
  return {
    record_points: nullableNumber(row?.record_points),
    classic_high_round: nullableNumber(row?.classic_high_round),
    bo3_high_round: nullableNumber(row?.bo3_high_round),
    waw_high_round: nullableNumber(row?.waw_high_round),
    speedrun_30: nullableNumber(row?.speedrun_30),
    speedrun_50: nullableNumber(row?.speedrun_50),
    speedrun_100: nullableNumber(row?.speedrun_100),
    other_speedrun_30: nullableNumber(row?.other_speedrun_30),
    other_speedrun_50: nullableNumber(row?.other_speedrun_50),
    other_speedrun_100: nullableNumber(row?.other_speedrun_100),
    no_power_round: nullableNumber(row?.no_power_round),
  };
}

async function worldRecordAchievementValues(db: Database, userId: string) {
  const rows = await db.execute<{
    world_records: number;
    world_records_2p: number;
    world_records_3p: number;
    world_records_4p: number;
  }>(sql`
    WITH ranked_records AS (
      SELECT runs.id AS submission_id,
        runs.player_count,
        row_number() OVER (
          PARTITION BY runs.map_id, runs.category_id, runs.category_assignment_id, runs.player_count
          ORDER BY
            CASE WHEN category.score_type = 'round' OR category.ranking_direction = 'higher_is_better'
              THEN runs.score_value END DESC NULLS LAST,
            CASE WHEN category.score_type <> 'round' AND category.ranking_direction = 'lower_is_better'
              THEN runs.score_value END ASC NULLS LAST,
            CASE WHEN category.score_type = 'round' THEN runs.run_duration_ms END ASC NULLS LAST,
            runs.verified_at ASC, runs.id ASC
        ) AS board_rank
      FROM best_records records
      JOIN submissions runs ON runs.id = records.submission_id
      JOIN categories category ON category.id = runs.category_id
    )
    SELECT
      count(distinct ranked.submission_id)::int AS world_records,
      count(distinct ranked.submission_id) FILTER (WHERE ranked.player_count = 2)::int
        AS world_records_2p,
      count(distinct ranked.submission_id) FILTER (WHERE ranked.player_count = 3)::int
        AS world_records_3p,
      count(distinct ranked.submission_id) FILTER (WHERE ranked.player_count = 4)::int
        AS world_records_4p
    FROM ranked_records ranked
    JOIN submission_participants participant ON participant.submission_id = ranked.submission_id
    WHERE ranked.board_rank = 1
      AND participant.user_id = ${userId}
      AND participant.status = 'accepted'
  `);
  const row = rows[0];
  return {
    world_records: Number(row?.world_records ?? 0),
    world_records_2p: Number(row?.world_records_2p ?? 0),
    world_records_3p: Number(row?.world_records_3p ?? 0),
    world_records_4p: Number(row?.world_records_4p ?? 0),
  };
}

async function masteryAchievementValues(db: Database, userId: string) {
  const [rows, globalTeamRanks] = await Promise.all([
    db.execute<{
      map_top15_categories: number;
      map_all_categories_top15: number;
    }>(sql`
    WITH ranked_records AS (
      SELECT runs.id AS submission_id,
        runs.map_id,
        runs.category_id,
        runs.player_count,
        row_number() OVER (
          PARTITION BY runs.map_id, runs.category_id, runs.category_assignment_id, runs.player_count
          ORDER BY
            CASE WHEN category.score_type = 'round' OR category.ranking_direction = 'higher_is_better'
              THEN runs.score_value END DESC NULLS LAST,
            CASE WHEN category.score_type <> 'round' AND category.ranking_direction = 'lower_is_better'
              THEN runs.score_value END ASC NULLS LAST,
            CASE WHEN category.score_type = 'round' THEN runs.run_duration_ms END ASC NULLS LAST,
            runs.verified_at ASC, runs.id ASC
        ) AS board_rank
      FROM best_records records
      JOIN submissions runs ON runs.id = records.submission_id
      JOIN categories category ON category.id = runs.category_id
    ),
    own_records AS (
      SELECT ranked.*
      FROM ranked_records ranked
      JOIN submission_participants participant ON participant.submission_id = ranked.submission_id
      WHERE participant.user_id = ${userId} AND participant.status = 'accepted'
    ),
    map_totals AS (
      SELECT assignment.map_id, count(distinct assignment.category_id)::int AS category_count
      FROM category_assignments assignment
      WHERE assignment.map_id IS NOT NULL
      GROUP BY assignment.map_id
      HAVING count(distinct assignment.category_id) >= 5
    ),
    map_progress AS (
      SELECT own.map_id,
        count(distinct own.category_id) FILTER (WHERE own.board_rank <= 15)::int AS top15_categories
      FROM own_records own
      JOIN map_totals total ON total.map_id = own.map_id
      GROUP BY own.map_id
    )
    SELECT coalesce((SELECT max(top15_categories)::int FROM map_progress), 0)::int
        AS map_top15_categories,
      coalesce((
        SELECT max(CASE WHEN progress.top15_categories >= total.category_count THEN 1 ELSE 0 END)::int
        FROM map_progress progress
        JOIN map_totals total ON total.map_id = progress.map_id
      ), 0)::int AS map_all_categories_top15
    `),
    getBestGlobalRosterRanksByUser(db),
  ]);
  const row = rows[0];
  return {
    team_best_rank: globalTeamRanks.get(userId) ?? null,
    map_top15_categories: Number(row?.map_top15_categories ?? 0),
    map_all_categories_top15: Number(row?.map_all_categories_top15 ?? 0),
  };
}

async function gameHighRoundCompletionValue(db: Database, userId: string) {
  const rows = await db.execute<{ value: number }>(sql`
    WITH ranked_records AS (
      SELECT runs.id AS submission_id,
        runs.game_id,
        runs.map_id,
        row_number() OVER (
          PARTITION BY runs.map_id, runs.category_id, runs.category_assignment_id, runs.player_count
          ORDER BY
            CASE WHEN category.score_type = 'round' OR category.ranking_direction = 'higher_is_better'
              THEN runs.score_value END DESC NULLS LAST,
            CASE WHEN category.score_type <> 'round' AND category.ranking_direction = 'lower_is_better'
              THEN runs.score_value END ASC NULLS LAST,
            CASE WHEN category.score_type = 'round' THEN runs.run_duration_ms END ASC NULLS LAST,
            runs.verified_at ASC, runs.id ASC
        ) AS board_rank
      FROM best_records records
      JOIN submissions runs ON runs.id = records.submission_id
      JOIN categories category ON category.id = runs.category_id
    ),
    high_round_maps AS (
      SELECT assignment.game_id, assignment.map_id
      FROM category_assignments assignment
      JOIN categories category ON category.id = assignment.category_id
      WHERE assignment.map_id IS NOT NULL
        AND category.slug IN ('high-round', 'high-round-hc', 'high-round-survival')
      GROUP BY assignment.game_id, assignment.map_id
    )
    SELECT CASE WHEN EXISTS (
      SELECT 1
      FROM ranked_records ranked
      JOIN submission_participants participant ON participant.submission_id = ranked.submission_id
      JOIN high_round_maps eligible
        ON eligible.game_id = ranked.game_id AND eligible.map_id = ranked.map_id
      WHERE participant.user_id = ${userId}
        AND participant.status = 'accepted'
        AND ranked.board_rank <= 15
      GROUP BY ranked.game_id
      HAVING count(distinct ranked.map_id) = (
        SELECT count(*) FROM high_round_maps total WHERE total.game_id = ranked.game_id
      )
    ) THEN 1 ELSE 0 END::int AS value
  `);
  return Number(rows[0]?.value ?? 0);
}

async function gameEeTop20Values(db: Database, userId: string) {
  const rows = await db.execute<{
    game_ee_top20_records: number;
    game_all_ee_top20: number;
  }>(sql`
    WITH ranked_records AS (
      SELECT runs.id AS submission_id,
        runs.game_id,
        runs.category_assignment_id,
        row_number() OVER (
          PARTITION BY runs.map_id, runs.category_id, runs.category_assignment_id, runs.player_count
          ORDER BY
            CASE WHEN category.score_type = 'round' OR category.ranking_direction = 'higher_is_better'
              THEN runs.score_value END DESC NULLS LAST,
            CASE WHEN category.score_type <> 'round' AND category.ranking_direction = 'lower_is_better'
              THEN runs.score_value END ASC NULLS LAST,
            CASE WHEN category.score_type = 'round' THEN runs.run_duration_ms END ASC NULLS LAST,
            runs.verified_at ASC, runs.id ASC
        ) AS board_rank
      FROM best_records records
      JOIN submissions runs ON runs.id = records.submission_id
      JOIN categories category ON category.id = runs.category_id
      WHERE category.slug = 'ee-speedrun'
    ),
    ee_totals AS (
      SELECT assignment.game_id, count(distinct assignment.id)::int AS ee_count
      FROM category_assignments assignment
      JOIN categories category ON category.id = assignment.category_id
      WHERE category.slug = 'ee-speedrun' AND assignment.map_id IS NOT NULL
      GROUP BY assignment.game_id
    ),
    progress AS (
      SELECT ranked.game_id,
        count(distinct ranked.category_assignment_id)::int AS top20_count
      FROM ranked_records ranked
      JOIN submission_participants participant ON participant.submission_id = ranked.submission_id
      WHERE participant.user_id = ${userId}
        AND participant.status = 'accepted'
        AND ranked.board_rank <= 20
      GROUP BY ranked.game_id
    )
    SELECT
      coalesce(max(progress.top20_count), 0)::int AS game_ee_top20_records,
      coalesce(max(CASE WHEN progress.top20_count >= total.ee_count THEN 1 ELSE 0 END), 0)::int
        AS game_all_ee_top20
    FROM progress
    JOIN ee_totals total ON total.game_id = progress.game_id
  `);
  const row = rows[0];
  return {
    game_ee_top20_records: Number(row?.game_ee_top20_records ?? 0),
    game_all_ee_top20: Number(row?.game_all_ee_top20 ?? 0),
  };
}

async function communityAchievementValues(db: Database, userId: string) {
  const row = (await achievementQueryRegistry.community.load(db, userId))[0];
  return {
    community_records: row?.communityRecords ?? 0,
    community_best_rank: row?.communityBestRank ?? null,
  };
}

async function bo3GumTrioBestRankValue(db: Database, userId: string) {
  return (await achievementQueryRegistry.bo3GumTrio.load(db, userId))[0]?.bestRank ?? null;
}

async function competitiveAchievementValues(db: Database, userId: string) {
  const row = (await achievementQueryRegistry.competitive.load(db, userId))[0];
  return {
    podium_records: row?.podiumRecords ?? 0,
    jack_of_all_trades_top3: row?.jackOfAllTradesTop3 ?? 0,
    game_specialist_records: row?.gameSpecialistRecords ?? 0,
    map_domination_best_rank: row?.mapDominationBestRank ?? null,
    wr_games: row?.worldRecordGames ?? 0,
    format_sweep_best_rank: row?.formatSweepBestRank ?? null,
    speedrun_ladder_best_rank: row?.speedrunLadderBestRank ?? null,
    no_crutches_best_rank: row?.noCrutchesBestRank ?? null,
    clean_extraction_best_rank: row?.cleanExtractionBestRank ?? null,
    double_agent_best_rank: row?.doubleAgentBestRank ?? null,
    restricted_arsenal_best_rank: row?.restrictedArsenalBestRank ?? null,
    hardcore_credentials_best_rank: row?.hardcoreCredentialsBestRank ?? null,
    first_room_official_round: row?.firstRoomOfficialRound ?? null,
    flawless_official_round: row?.flawlessOfficialRound ?? null,
    extinction_protocol_best_rank: row?.extinctionProtocolBestRank ?? null,
    endurance_best_rank: row?.enduranceBestRank ?? null,
    bo3_reset_maps: row?.bo3ResetMaps ?? 0,
  };
}

async function teamworkAchievementValues(db: Database, userId: string) {
  const row = (await achievementQueryRegistry.teamwork.load(db, userId))[0];
  return {
    dynamic_duo_records: row?.dynamicDuoRecords ?? 0,
    dynamic_duo_world_records: row?.dynamicDuoWorldRecords ?? 0,
    distinct_top3_duo_partners: row?.distinctTop3Partners ?? 0,
    distinct_top1_duo_partners: row?.distinctTop1Partners ?? 0,
  };
}

async function historicalWorldRecordAchievementValues(db: Database, userId: string) {
  const row = (await achievementQueryRegistry.historicalWorldRecords.load(db, userId))[0];
  return {
    back_from_the_dead: row?.backFromTheDead ?? 0,
    duo_self_snipe: row?.duoSelfSnipe ?? 0,
    self_wr_improvement: row?.selfWorldRecordImprovement ?? 0,
    wr_weekend: row?.wrWeekend ?? 0,
    longest_wr_reign_days: row?.longestReignDays ?? 0,
    record_breaker_days: row?.recordBreakerDays ?? 0,
  };
}

function nullableNumber(value: number | null | undefined) {
  return value === null || value === undefined ? null : Number(value);
}

async function metricValue(
  db: Database,
  userId: string,
  metric: MetricName,
  startsAt?: Date,
  endsAt?: Date,
) {
  if (metric === "performance_points") {
    const [user] = await db.select({ value: users.performancePoints }).from(users).where(
      eq(users.id, userId),
    );
    if (!user) throw new NotFoundError("user not found");
    return user.value;
  }
  if (metric === "world_records") {
    const rows = await db.execute<{ value: number }>(sql`
      WITH ranked_records AS (
        SELECT runs.id AS submission_id,
          row_number() OVER (
            PARTITION BY runs.map_id, runs.category_id, runs.category_assignment_id, runs.player_count
            ORDER BY
              CASE WHEN category.score_type = 'round' OR category.ranking_direction = 'higher_is_better'
                THEN runs.score_value END DESC NULLS LAST,
              CASE WHEN category.score_type <> 'round' AND category.ranking_direction = 'lower_is_better'
                THEN runs.score_value END ASC NULLS LAST,
              CASE WHEN category.score_type = 'round' THEN runs.run_duration_ms END ASC NULLS LAST,
              runs.verified_at ASC, runs.id ASC
          ) AS board_rank
        FROM best_records records
        JOIN submissions runs ON runs.id = records.submission_id
        JOIN categories category ON category.id = runs.category_id
      )
      SELECT count(distinct ranked.submission_id)::int AS value
      FROM ranked_records ranked
      JOIN submission_participants participant ON participant.submission_id = ranked.submission_id
      WHERE ranked.board_rank = 1 AND participant.user_id = ${userId}
    `);
    return Number(rows[0]?.value ?? 0);
  }
  if (metric === "games_played") {
    const [row] = await db.select({ value: sql<number>`count(distinct ${submissions.gameId})::int` })
      .from(submissionParticipants)
      .innerJoin(submissions, eq(submissionParticipants.submissionId, submissions.id))
      .where(and(
        eq(submissionParticipants.userId, userId),
        eq(submissions.status, "verified"),
      ));
    return row?.value ?? 0;
  }
  if (metric === "maps_played") {
    const [row] = await db.select({ value: sql<number>`count(distinct ${submissions.mapId})::int` })
      .from(submissionParticipants)
      .innerJoin(submissions, eq(submissionParticipants.submissionId, submissions.id))
      .where(and(
        eq(submissionParticipants.userId, userId),
        eq(submissionParticipants.status, "accepted"),
        eq(submissions.status, "verified"),
      ));
    return row?.value ?? 0;
  }
  if (metric === "team_formats_played") {
    const [row] = await db.select({
      value: sql<number>`count(distinct ${submissions.playerCount})::int`,
    })
      .from(submissionParticipants)
      .innerJoin(submissions, eq(submissionParticipants.submissionId, submissions.id))
      .where(and(
        eq(submissionParticipants.userId, userId),
        eq(submissionParticipants.status, "accepted"),
        eq(submissions.status, "verified"),
        sql`${submissions.playerCount} > 1`,
      ));
    return row?.value ?? 0;
  }
  if (metric === "categories_played") {
    const [row] = await db.select({
      value: sql<number>`count(distinct ${submissions.categoryId})::int`,
    })
      .from(submissionParticipants)
      .innerJoin(submissions, eq(submissionParticipants.submissionId, submissions.id))
      .where(and(
        eq(submissionParticipants.userId, userId),
        eq(submissionParticipants.status, "accepted"),
        eq(submissions.status, "verified"),
      ));
    return row?.value ?? 0;
  }
  if (metric === "team_records") {
    const [row] = await db.select({ value: sql<number>`count(distinct ${submissions.id})::int` })
      .from(submissionParticipants)
      .innerJoin(submissions, eq(submissionParticipants.submissionId, submissions.id))
      .where(and(
        eq(submissionParticipants.userId, userId),
        eq(submissions.status, "verified"),
        sql`${submissions.playerCount} > 1`,
      ));
    return row?.value ?? 0;
  }
  const [row] = await db.select({ value: sql<number>`count(distinct ${submissions.id})::int` })
    .from(submissionParticipants)
    .innerJoin(submissions, eq(submissionParticipants.submissionId, submissions.id))
    .where(and(
      eq(submissionParticipants.userId, userId),
      eq(submissions.status, "verified"),
      startsAt ? gte(submissions.verifiedAt, startsAt) : undefined,
      endsAt ? lte(submissions.verifiedAt, endsAt) : undefined,
    ));
  return row?.value ?? 0;
}

function validDate(value: string, name: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new ValidationError(`${name} must be an ISO date-time`);
  return date;
}

function assertId(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new ValidationError("id must be a positive integer");
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

function decode<A, I>(schema: Schema.Schema<A, I>, payload: unknown) {
  return Schema.decodeUnknown(schema)(payload).pipe(
    Effect.mapError((error) => new ValidationError(String(error))),
  );
}

function databaseEffect<A>(run: () => Promise<A>) {
  return Effect.tryPromise({ try: run, catch: (error) => error });
}
