import { eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../../db/client.ts";
import {
  achievementMetricSnapshots,
  bestRecords,
  categories,
  submissionParticipants,
  submissions,
} from "../../db/schema.ts";
import { recalculatePerformancePointsForUsers } from "../submissions/persistence.ts";
import { refreshScopedPerformanceForUsers } from "../users/ranks.ts";

export type ClaimAffectedBoard = {
  mapId: number;
  categoryAssignmentId: number;
  playerCount: number;
};

/**
 * Rebuild only the leaderboards whose competitor identity changed during a
 * profile claim. A full import rebuild touches every record and every player,
 * which is several orders of magnitude more work than a claim requires.
 */
export async function refreshClaimAffectedDerivedData(
  db: Database,
  affectedBoards: readonly ClaimAffectedBoard[],
  claimantUserId: string,
) {
  const boards = deduplicateBoards(affectedBoards);
  if (!boards.length) {
    await recalculatePerformancePointsForUsers(db, [claimantUserId]);
    await refreshScopedPerformanceForUsers(db, [claimantUserId]);
    return;
  }

  const boardValues = sql.join(
    boards.map((board) =>
      sql`(${board.mapId}::integer, ${board.categoryAssignmentId}::integer, ${board.playerCount}::integer)`
    ),
    sql`, `,
  );
  const affectedBoardsSql =
    sql`(VALUES ${boardValues}) AS affected(map_id, category_assignment_id, player_count)`;

  await db.execute(sql`
    DELETE FROM ${bestRecords} record
    USING ${submissions} submission, ${affectedBoardsSql}
    WHERE record.submission_id = submission.id
      AND submission.map_id = affected.map_id
      AND submission.category_assignment_id = affected.category_assignment_id
      AND submission.player_count = affected.player_count
  `);
  await db.execute(sql`
    INSERT INTO ${bestRecords} (submission_id, points)
    SELECT id, 0 FROM (
      SELECT submission.id, row_number() OVER (
        PARTITION BY submission.competitor_key, submission.map_id, submission.category_assignment_id
        ORDER BY
          CASE WHEN category.score_type = 'round' OR category.ranking_direction = 'higher_is_better'
            THEN submission.score_value END DESC,
          CASE WHEN category.score_type <> 'round' AND category.ranking_direction = 'lower_is_better'
            THEN submission.score_value END ASC,
          CASE WHEN category.score_type = 'round' THEN submission.run_duration_ms END ASC NULLS LAST,
          submission.verified_at ASC,
          submission.id ASC
      ) AS position
      FROM ${submissions} submission
      JOIN ${categories} category ON category.id = submission.category_id
      JOIN ${affectedBoardsSql} ON
        submission.map_id = affected.map_id
        AND submission.category_assignment_id = affected.category_assignment_id
        AND submission.player_count = affected.player_count
      WHERE submission.status = 'verified'
    ) ranked
    WHERE position = 1
  `);
  await db.execute(sql`
    WITH competitor_counts AS (
      SELECT submission.map_id, submission.category_assignment_id, submission.player_count,
        count(DISTINCT submission.competitor_key)::double precision AS competitors
      FROM ${submissions} submission
      JOIN ${affectedBoardsSql} ON
        submission.map_id = affected.map_id
        AND submission.category_assignment_id = affected.category_assignment_id
        AND submission.player_count = affected.player_count
      WHERE submission.status = 'verified'
      GROUP BY submission.map_id, submission.category_assignment_id, submission.player_count
    ), ranked AS (
      SELECT record.submission_id, submission.map_id, submission.category_assignment_id,
        submission.player_count, submission.score_value, category.ranking_direction,
        rank() OVER board AS position,
        first_value(submission.score_value) OVER board AS wr_score
      FROM ${bestRecords} record
      JOIN ${submissions} submission ON submission.id = record.submission_id
      JOIN ${categories} category ON category.id = submission.category_id
      JOIN ${affectedBoardsSql} ON
        submission.map_id = affected.map_id
        AND submission.category_assignment_id = affected.category_assignment_id
        AND submission.player_count = affected.player_count
      WINDOW board AS (
        PARTITION BY submission.map_id, submission.category_assignment_id, submission.player_count
        ORDER BY
          CASE WHEN category.score_type = 'round' OR category.ranking_direction = 'higher_is_better'
            THEN submission.score_value END DESC,
          CASE WHEN category.score_type <> 'round' AND category.ranking_direction = 'lower_is_better'
            THEN submission.score_value END ASC,
          CASE WHEN category.score_type = 'round' THEN submission.run_duration_ms END ASC NULLS LAST,
          submission.verified_at ASC,
          submission.id ASC
      )
    )
    UPDATE ${bestRecords} record SET points = round((
      round((50 + 150 * sqrt(greatest(0, counts.competitors - 1)))::numeric, 2)::double precision *
      power(CASE WHEN ranked.ranking_direction = 'higher_is_better'
        THEN ranked.score_value::double precision / greatest(1, ranked.wr_score)::double precision
        ELSE greatest(1, ranked.wr_score)::double precision /
          greatest(1, ranked.score_value)::double precision END, 3) *
      power(ranked.position::double precision, -0.15)
    )::numeric, 2)::double precision
    FROM ranked
    JOIN competitor_counts counts
      ON counts.map_id = ranked.map_id
      AND counts.category_assignment_id = ranked.category_assignment_id
      AND counts.player_count = ranked.player_count
    WHERE record.submission_id = ranked.submission_id
  `);

  await db.execute(sql`
    UPDATE ${submissionParticipants} participant
    SET is_personal_best = false
    FROM ${submissions} submission, ${affectedBoardsSql}
    WHERE participant.submission_id = submission.id
      AND submission.map_id = affected.map_id
      AND submission.category_assignment_id = affected.category_assignment_id
      AND submission.player_count = affected.player_count
  `);
  await db.execute(sql`
    WITH ranked AS (
      SELECT participant.submission_id, participant.user_id, row_number() OVER (
        PARTITION BY participant.user_id, submission.map_id,
          submission.category_assignment_id, submission.player_count
        ORDER BY
          CASE WHEN category.score_type = 'round' OR category.ranking_direction = 'higher_is_better'
            THEN submission.score_value END DESC,
          CASE WHEN category.score_type <> 'round' AND category.ranking_direction = 'lower_is_better'
            THEN submission.score_value END ASC,
          CASE WHEN category.score_type = 'round' THEN submission.run_duration_ms END ASC NULLS LAST,
          submission.verified_at ASC,
          submission.id ASC
      ) AS position
      FROM ${submissionParticipants} participant
      JOIN ${bestRecords} record ON record.submission_id = participant.submission_id
      JOIN ${submissions} submission ON submission.id = record.submission_id
      JOIN ${categories} category ON category.id = submission.category_id
      JOIN ${affectedBoardsSql} ON
        submission.map_id = affected.map_id
        AND submission.category_assignment_id = affected.category_assignment_id
        AND submission.player_count = affected.player_count
    )
    UPDATE ${submissionParticipants} participant SET is_personal_best = true
    FROM ranked
    WHERE participant.submission_id = ranked.submission_id
      AND participant.user_id = ranked.user_id
      AND ranked.position = 1
  `);

  const participantRows = await db.selectDistinct({ userId: submissionParticipants.userId })
    .from(submissionParticipants)
    .innerJoin(submissions, eq(submissionParticipants.submissionId, submissions.id))
    .where(
      sql`(${submissions.mapId}, ${submissions.categoryAssignmentId}, ${submissions.playerCount})
        IN (${
        sql.join(
          boards.map((board) =>
            sql`(${board.mapId}::integer, ${board.categoryAssignmentId}::integer, ${board.playerCount}::integer)`
          ),
          sql`, `,
        )
      })`,
    );
  const affectedUserIds = [
    ...new Set([claimantUserId, ...participantRows.map((participant) => participant.userId)]),
  ];
  for (let offset = 0; offset < affectedUserIds.length; offset += 1_000) {
    await db.delete(achievementMetricSnapshots).where(
      inArray(achievementMetricSnapshots.userId, affectedUserIds.slice(offset, offset + 1_000)),
    );
  }
  await recalculatePerformancePointsForUsers(db, affectedUserIds);
  await refreshScopedPerformanceForUsers(db, affectedUserIds);
}

function deduplicateBoards(boards: readonly ClaimAffectedBoard[]) {
  const unique = new Map<string, ClaimAffectedBoard>();
  for (const board of boards) {
    unique.set(
      `${board.mapId}:${board.categoryAssignmentId}:${board.playerCount}`,
      board,
    );
  }
  return [...unique.values()];
}
