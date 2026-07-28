import { and, desc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
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

export function getLatestWorldRecords(db: Database) {
  return Effect.tryPromise({
    try: async () => {
      const rows = await db.execute<{ submissionId: number }>(sql`
        WITH ranked_records AS (
          SELECT records.submission_id AS "submissionId", runs.verified_at,
            row_number() OVER (
              PARTITION BY runs.map_id, runs.category_id, runs.category_assignment_id, runs.player_count
              ORDER BY
                CASE WHEN category.score_type = 'round' OR category.ranking_direction = 'higher_is_better' THEN runs.score_value END DESC NULLS LAST,
                CASE WHEN category.score_type <> 'round' AND category.ranking_direction = 'lower_is_better' THEN runs.score_value END ASC NULLS LAST,
                CASE WHEN category.score_type = 'round' THEN runs.run_duration_ms END ASC NULLS LAST,
                runs.verified_at ASC, runs.id ASC
            ) AS board_rank
          FROM best_records records
          JOIN submissions runs ON runs.id = records.submission_id
          JOIN categories category ON category.id = runs.category_id
          WHERE runs.verified_at <= CURRENT_TIMESTAMP
        )
        SELECT "submissionId" FROM ranked_records WHERE board_rank = 1
        ORDER BY verified_at DESC NULLS LAST, "submissionId" DESC LIMIT 50
      `);
      return {
        limit: 50,
        entries: await loadFeaturedRecords(db, rows.map((row) => Number(row.submissionId))),
      };
    },
    catch: (error) => error,
  });
}

export function getHighestPointRecordsThisWeek(db: Database, now = new Date()) {
  return Effect.tryPromise({
    try: async () => {
      const { startsAt, endsAt } = weeklyWindow(now);
      const rows = await db.select({ submissionId: bestRecords.submissionId }).from(bestRecords)
        .innerJoin(submissions, eq(bestRecords.submissionId, submissions.id))
        .where(and(
          gte(submissions.verifiedAt, startsAt),
          lt(submissions.verifiedAt, endsAt),
          lte(submissions.verifiedAt, now),
        ))
        .orderBy(desc(bestRecords.points), desc(submissions.verifiedAt), desc(submissions.id))
        .limit(50);
      return {
        startsAt,
        endsAt,
        limit: 50,
        entries: await loadFeaturedRecords(db, rows.map((row) => row.submissionId)),
      };
    },
    catch: (error) => error,
  });
}

export function weeklyWindow(now: Date) {
  const startsAt = new Date(now);
  startsAt.setUTCHours(0, 0, 0, 0);
  startsAt.setUTCDate(startsAt.getUTCDate() - ((startsAt.getUTCDay() - 2 + 7) % 7));
  const endsAt = new Date(startsAt);
  endsAt.setUTCDate(endsAt.getUTCDate() + 7);
  return { startsAt, endsAt };
}

async function loadFeaturedRecords(db: Database, submissionIds: number[]) {
  if (!submissionIds.length) return [];
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
    .where(inArray(bestRecords.submissionId, submissionIds));
  const participants = await db.select({
    submissionId: submissionParticipants.submissionId,
    role: submissionParticipants.role,
    user: { id: users.id, name: users.name, image: users.image },
  }).from(submissionParticipants)
    .innerJoin(users, eq(submissionParticipants.userId, users.id))
    .where(inArray(submissionParticipants.submissionId, submissionIds))
    .orderBy(submissionParticipants.submissionId, submissionParticipants.role, users.name);
  const participantMap = new Map<number, typeof participants>();
  for (const participant of participants) {
    const current = participantMap.get(participant.submissionId) ?? [];
    current.push(participant);
    participantMap.set(participant.submissionId, current);
  }
  const worldRecordIds = await findWorldRecordIds(db, submissionIds);
  const byId = new Map(records.map((record) => [record.submissionId, record]));
  return submissionIds.flatMap((submissionId, index) => {
    const record = byId.get(submissionId);
    return record
      ? [{
        rank: index + 1,
        ...record,
        isWorldRecord: worldRecordIds.has(submissionId),
        participants: (participantMap.get(submissionId) ?? []).map(({ role, user }) => ({ role, user })),
      }]
      : [];
  });
}

export async function findWorldRecordIds(db: Database, submissionIds: number[]) {
  if (!submissionIds.length) return new Set<number>();
  const idList = sql.join(submissionIds.map((id) => sql`${id}`), sql`, `);
  const rows = await db.execute<{ submissionId: number }>(sql`
    WITH requested_records AS (
      SELECT records.submission_id AS "submissionId",
        runs.map_id, runs.category_assignment_id, runs.player_count,
        category.score_type, category.ranking_direction
      FROM best_records records
      JOIN submissions runs ON runs.id = records.submission_id
      JOIN categories category ON category.id = runs.category_id
      WHERE records.submission_id IN (${idList})
    )
    SELECT requested."submissionId"
    FROM requested_records requested
    WHERE requested."submissionId" = (
      SELECT competitor.submission_id
      FROM best_records competitor
      JOIN submissions candidate ON candidate.id = competitor.submission_id
      WHERE candidate.map_id = requested.map_id
        AND candidate.category_assignment_id IS NOT DISTINCT FROM requested.category_assignment_id
        AND candidate.player_count = requested.player_count
      ORDER BY
        CASE
          WHEN requested.score_type = 'round'
            OR requested.ranking_direction = 'higher_is_better'
          THEN candidate.score_value
        END DESC NULLS LAST,
        CASE
          WHEN requested.score_type <> 'round'
            AND requested.ranking_direction = 'lower_is_better'
          THEN candidate.score_value
        END ASC NULLS LAST,
        CASE WHEN requested.score_type = 'round' THEN candidate.run_duration_ms END ASC NULLS LAST,
        candidate.verified_at ASC,
        candidate.id ASC
      LIMIT 1
    )
  `);
  return new Set(rows.map((row) => Number(row.submissionId)));
}
