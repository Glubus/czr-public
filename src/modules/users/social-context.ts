import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { Effect } from "effect";
import type { Database } from "../../db/client.ts";
import {
  bestRecords,
  clanMembers,
  clans,
  submissionParticipants,
  submissions,
  users,
} from "../../db/schema.ts";
import { calculatePerformancePoints } from "../submissions/performance-points.ts";
import { NotFoundError } from "../shared/errors.ts";

export function getUserSocialContext(db: Database, userId: string) {
  return Effect.tryPromise({
    try: async () => {
      const [user] = await db.select({ id: users.id }).from(users).where(
        and(eq(users.id, userId), isNull(users.deletedAt)),
      ).limit(1);
      if (!user) throw new NotFoundError("user not found");
      const [membership] = await db.select({
        role: clanMembers.role,
        clan: { id: clans.id, slug: clans.slug, name: clans.name },
      }).from(clanMembers).innerJoin(clans, eq(clanMembers.clanId, clans.id))
        .where(eq(clanMembers.userId, userId)).limit(1);

      const records = await db.select({
        competitorKey: submissions.competitorKey,
        playerCount: submissions.playerCount,
        points: bestRecords.points,
      }).from(bestRecords)
        .innerJoin(submissions, eq(bestRecords.submissionId, submissions.id))
        .innerJoin(submissionParticipants, eq(submissions.id, submissionParticipants.submissionId))
        .where(and(
          eq(submissionParticipants.userId, userId),
          sql`${submissions.playerCount} > 1`,
        ));
      const grouped = new Map<string, { playerCount: number; points: number[] }>();
      for (const record of records) {
        const current = grouped.get(record.competitorKey) ?? { playerCount: record.playerCount, points: [] };
        current.points.push(record.points);
        grouped.set(record.competitorKey, current);
      }
      const top = [...grouped].map(([competitorKey, value]) => ({
        competitorKey,
        playerCount: value.playerCount,
        recordCount: value.points.length,
        performancePoints: calculatePerformancePoints(value.points),
      })).sort((left, right) =>
        right.recordCount - left.recordCount || right.performancePoints - left.performancePoints ||
        left.competitorKey.localeCompare(right.competitorKey)
      ).slice(0, 5);

      const participantRows = top.length
        ? await db.select({
          competitorKey: submissions.competitorKey,
          user: { id: users.id, name: users.name, image: users.image },
        }).from(submissions)
          .innerJoin(submissionParticipants, eq(submissions.id, submissionParticipants.submissionId))
          .innerJoin(users, eq(submissionParticipants.userId, users.id))
          .where(inArray(submissions.competitorKey, top.map((team) => team.competitorKey)))
          .orderBy(desc(submissions.verifiedAt), users.name)
        : [];
      const participants = new Map<string, Map<string, (typeof participantRows)[number]["user"]>>();
      for (const row of participantRows) {
        const roster = participants.get(row.competitorKey) ?? new Map();
        roster.set(row.user.id, row.user);
        participants.set(row.competitorKey, roster);
      }
      return {
        userId,
        clan: membership ? { ...membership.clan, role: membership.role } : null,
        frequentTeams: top.map((team) => ({
          ...team,
          participants: [...(participants.get(team.competitorKey)?.values() ?? [])],
        })),
      };
    },
    catch: (error) => error,
  });
}
