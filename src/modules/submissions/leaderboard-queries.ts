import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { Effect } from "effect";
import type { Database } from "../../db/client.ts";
import {
  bestRecords,
  categories,
  categoryAssignments,
  maps,
  submissionParticipants,
  submissions,
  users,
} from "../../db/schema.ts";
import { NotFoundError } from "../shared/errors.ts";
import { parsePage } from "../shared/pagination.ts";
import { leaderboardOrderBy } from "./persistence.ts";
import { leaderboardPool, rankLeaderboardRecords } from "./ranking.ts";

export function getMapCategoryLeaderboard(
  db: Database,
  mapId: number,
  categoryId: number,
  playerCount?: number,
  pageValue?: string,
  assignmentId?: number,
) {
  return Effect.tryPromise({
    try: async () => {
      const page = parsePage(pageValue);
      const [map] = await db.select().from(maps).where(eq(maps.id, mapId)).limit(1);
      if (!map) throw new NotFoundError("map not found");

      const assignments = await db.select().from(categoryAssignments).where(and(
        eq(categoryAssignments.categoryId, categoryId),
        eq(categoryAssignments.gameId, map.gameId),
        or(isNull(categoryAssignments.mapId), eq(categoryAssignments.mapId, map.id)),
      ));
      const assignment = assignmentId === undefined
        ? assignments.find((candidate) => candidate.mapId === map.id) ??
          assignments.find((candidate) => candidate.mapId === null)
        : assignments.find((candidate) => candidate.id === assignmentId);
      if (!assignment) throw new NotFoundError("category is not assigned to this map");

      const [category] = await db.select().from(categories).where(eq(categories.id, assignment.categoryId))
        .limit(1);
      if (!category) throw new NotFoundError("category not found");

      const rows = await db.select({
        submissionId: bestRecords.submissionId,
        userId: submissions.userId,
        scoreValue: submissions.scoreValue,
        runDurationMs: submissions.runDurationMs,
        proofLevel: submissions.proofLevel,
        proofUrl: submissions.proofUrl,
        submittedAt: submissions.submittedAt,
        points: bestRecords.points,
        userName: users.name,
        userImage: users.image,
      }).from(bestRecords).innerJoin(submissions, eq(bestRecords.submissionId, submissions.id))
        .innerJoin(users, eq(submissions.userId, users.id)).where(and(
          eq(submissions.mapId, mapId),
          eq(submissions.categoryAssignmentId, assignment.id),
          playerCount === undefined ? undefined : eq(submissions.playerCount, playerCount),
        )).orderBy(...leaderboardOrderBy(category.scoreType, category.rankingDirection));

      const participantRows = rows.length === 0 ? [] : await db.select({
        submissionId: submissionParticipants.submissionId,
        userId: users.id,
        name: users.name,
        image: users.image,
      }).from(submissionParticipants).innerJoin(users, eq(submissionParticipants.userId, users.id))
        .where(inArray(submissionParticipants.submissionId, rows.map((row) => row.submissionId)));
      // A multiplayer team is one leaderboard competitor. Counting its individual
      // participants would inflate the pool by 2x, 3x or 4x depending on format.
      // Keep this in sync with the pool used when records are awarded in commands.ts.
      const verifiedCompetitorRows = await db.selectDistinct({ competitorKey: submissions.competitorKey })
        .from(submissions).where(and(
          eq(submissions.mapId, mapId),
          eq(submissions.categoryAssignmentId, assignment.id),
          playerCount === undefined ? undefined : eq(submissions.playerCount, playerCount),
          eq(submissions.status, "verified"),
        ));
      const pool = leaderboardPool(verifiedCompetitorRows.length);
      const participantsBySubmission = Map.groupBy(
        participantRows,
        (participant) => participant.submissionId,
      );
      const rankedEntries = rankLeaderboardRecords(rows, category.rankingDirection, pool).map((entry) => ({
        ...entry,
        participants: (participantsBySubmission.get(entry.submission.id) ?? []).map((participant) => ({
          user: { id: participant.userId, name: participant.name, image: participant.image },
          points: entry.points,
        })),
      }));
      const pageSize = 50;
      const offset = page * pageSize;

      return {
        category: {
          ...category,
          assignmentId: assignment.id,
          gameId: assignment.gameId,
          mapId: assignment.mapId,
          globalRules: category.rules,
          specificRules: assignment.specificRules,
        },
        pool,
        page,
        pageSize,
        totalEntries: rankedEntries.length,
        totalPages: Math.ceil(rankedEntries.length / pageSize),
        hasMore: rankedEntries.length > offset + pageSize,
        entries: rankedEntries.slice(offset, offset + pageSize),
      };
    },
    catch: (error) => error,
  });
}
