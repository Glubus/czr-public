import { and, eq, inArray, sql } from "drizzle-orm";
import { Effect, Schema } from "effect";
import type { Database } from "../../db/client.ts";
import {
  achievementMetricSnapshots,
  bestRecords,
  categories,
  categoryAssignments,
  clanMembers,
  games,
  maps,
  mods,
  participationInvitations,
  submissionParticipants,
  submissionProofs,
  submissions,
  users,
} from "../../db/schema.ts";
import { ConflictError, NotFoundError, ValidationError } from "../shared/errors.ts";
import { leaderboardOrderBy, recalculatePerformancePointsForUsers } from "./persistence.ts";
import { isBetterRecord, leaderboardPool, rankLeaderboardRecords } from "./ranking.ts";
import { assertValidSubmissionValues, competitorKeyFor, validateProofs } from "./validation.ts";
import { enqueueOutboxEvent } from "../social/outbox.ts";
import { refreshScopedPerformanceForUsers } from "../users/ranks.ts";

const SharedSubmissionFields = {
  gameId: Schema.Number,
  mapId: Schema.Number,
  platform: Schema.optional(Schema.NullOr(Schema.String)),
  gameVersion: Schema.optional(Schema.NullOr(Schema.String)),
  mapVersion: Schema.optional(Schema.NullOr(Schema.String)),
  modId: Schema.optional(Schema.NullOr(Schema.Number)),
  modVersion: Schema.optional(Schema.NullOr(Schema.String)),
  participantUserIds: Schema.optional(Schema.Array(Schema.String)),
  proofLevel: Schema.Literal(
    "manual_video",
    "client_recorded",
    "client_recorded_with_inputs",
    "verified_client_package",
  ),
  proofUrl: Schema.optional(Schema.NullOr(Schema.String)),
  proofs: Schema.optional(Schema.Array(Schema.Struct({
    type: Schema.Literal("demo", "input_log", "event_log", "screenshot", "video", "hash_manifest"),
    sourceUrl: Schema.optional(Schema.NullOr(Schema.String)),
    storageKey: Schema.optional(Schema.NullOr(Schema.String)),
    sha256: Schema.optional(Schema.NullOr(Schema.String)),
    mimeType: Schema.optional(Schema.NullOr(Schema.String)),
    formatVersion: Schema.optional(Schema.Number),
    provider: Schema.optional(Schema.Literal("youtube", "twitch", "steam", "direct", "other")),
    metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  }))),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
};
const SubmissionEntryPayload = Schema.Struct({
  categoryAssignmentId: Schema.Number,
  scoreValue: Schema.Number,
  runDurationMs: Schema.optional(Schema.NullOr(Schema.Number)),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
});
const CreateSubmissionPayload = Schema.Struct({
  ...SharedSubmissionFields,
  categoryAssignmentId: Schema.Number,
  scoreValue: Schema.Number,
  runDurationMs: Schema.optional(Schema.NullOr(Schema.Number)),
});
const CreateSubmissionGroupPayload = Schema.Struct({
  ...SharedSubmissionFields,
  entries: Schema.Array(SubmissionEntryPayload),
});

const ReviewSubmissionPayload = Schema.Struct({
  status: Schema.Literal("verified", "rejected"),
  reviewNote: Schema.optional(Schema.NullOr(Schema.String)),
});

type SqlExecutor = Pick<Database, "execute">;
type SharedSubmission = Omit<
  typeof CreateSubmissionPayload.Type,
  "categoryAssignmentId" | "scoreValue" | "runDurationMs"
>;
type SubmissionEntry = typeof SubmissionEntryPayload.Type;
export type SubmissionPersistenceOptions = {
  externalIdPrefix?: string;
  skipActiveCapacity?: boolean;
  metadata?: Record<string, unknown>;
};

export function createSubmission(db: Database, payload: unknown, userId: string) {
  return Schema.decodeUnknown(CreateSubmissionPayload)(payload).pipe(
    Effect.mapError((error) => new ValidationError(String(error))),
    Effect.flatMap((submission) =>
      persistSubmissions(
        db,
        submission,
        [{
          categoryAssignmentId: submission.categoryAssignmentId,
          scoreValue: submission.scoreValue,
          runDurationMs: submission.runDurationMs,
        }],
        userId,
        crypto.randomUUID(),
      ).pipe(Effect.map((created) => created[0]!))
    ),
  );
}

export function createSubmissionGroup(db: Database, payload: unknown, userId: string) {
  return Schema.decodeUnknown(CreateSubmissionGroupPayload)(payload).pipe(
    Effect.mapError((error) => new ValidationError(String(error))),
    Effect.flatMap((submission) => {
      if (submission.entries.length < 1 || submission.entries.length > 5) {
        return Effect.fail(new ValidationError("entries must contain between one and five submissions"));
      }
      if (
        new Set(submission.entries.map((entry) => entry.categoryAssignmentId)).size !==
          submission.entries.length
      ) {
        return Effect.fail(
          new ValidationError("category assignments must be unique within a submission group"),
        );
      }
      const submissionGroupId = crypto.randomUUID();
      return persistSubmissions(db, submission, submission.entries, userId, submissionGroupId).pipe(
        Effect.map((created) => ({ submissionGroupId, submissions: created })),
      );
    }),
  );
}

export function persistSubmissions(
  db: Database,
  submission: SharedSubmission,
  entries: ReadonlyArray<SubmissionEntry>,
  userId: string,
  submissionGroupId: string,
  options: SubmissionPersistenceOptions = {},
) {
  return Effect.tryPromise({
    try: () =>
      db.transaction(async (transaction) => {
        const tx = transaction as unknown as Database;
        if (!options.skipActiveCapacity) await assertActiveSubmissionCapacity(tx, userId, entries.length);
        const participantUserIds = [...new Set(submission.participantUserIds ?? [userId])];
        if (!participantUserIds.includes(userId)) {
          throw new ValidationError("the submitter must be a participant");
        }
        const participants = await tx.select({
          id: users.id,
          autoAcceptClanRuns: users.autoAcceptClanRuns,
          externalId: users.externalId,
          email: users.email,
        }).from(users).where(
          inArray(users.id, participantUserIds),
        );
        if (participants.length !== participantUserIds.length) {
          throw new ValidationError("every participant must be a registered user");
        }
        if (
          participants.some((participant) =>
            participant.id !== userId &&
            participant.externalId?.startsWith("zwr:player:") === true &&
            participant.email.endsWith("@import.local")
          )
        ) {
          throw new ValidationError("unclaimed imported profiles cannot confirm participation");
        }
        const memberships = await tx.select({
          userId: clanMembers.userId,
          clanId: clanMembers.clanId,
        }).from(clanMembers).where(inArray(clanMembers.userId, participantUserIds));
        const membershipByUser = new Map(memberships.map((membership) => [membership.userId, membership]));
        const participantById = new Map(participants.map((participant) => [participant.id, participant]));
        const submitterClanId = membershipByUser.get(userId)?.clanId;
        const consent = participantUserIds.map((participantUserId) => {
          if (participantUserId === userId) {
            return {
              userId: participantUserId,
              status: "accepted" as const,
              acceptanceSource: "submitter" as const,
              acceptanceClanId: null,
            };
          }
          const participantClanId = membershipByUser.get(participantUserId)?.clanId;
          if (
            submitterClanId !== undefined &&
            participantClanId === submitterClanId &&
            participantById.get(participantUserId)?.autoAcceptClanRuns === true
          ) {
            return {
              userId: participantUserId,
              status: "accepted" as const,
              acceptanceSource: "clan" as const,
              acceptanceClanId: submitterClanId,
            };
          }
          return {
            userId: participantUserId,
            status: "pending" as const,
            acceptanceSource: "invitation" as const,
            acceptanceClanId: null,
          };
        });
        const pendingParticipants = consent.filter((participant) => participant.status === "pending");
        if (submission.modId !== null && submission.modId !== undefined) {
          const [mod] = await tx.select().from(mods).where(eq(mods.id, submission.modId)).limit(1);
          if (!mod || mod.gameId !== submission.gameId) {
            throw new ValidationError("mod must belong to the game");
          }
        }
        validateProofs(submission.proofs);
        const prepared = [];
        for (const entry of entries) {
          assertValidSubmissionValues(entry.scoreValue, entry.runDurationMs);
          const assignment = await assertSubmissionTargetsExist(
            tx,
            submission.gameId,
            submission.mapId,
            entry.categoryAssignmentId,
          );
          const [category] = await tx.select().from(categories).where(
            eq(categories.id, assignment.categoryId),
          ).limit(1);
          if (!category) throw new NotFoundError("category not found");
          prepared.push({ entry, assignment, category });
        }

        const competitorKey = competitorKeyFor(participantUserIds);
        const created = await tx.insert(submissions).values(
          prepared.map(({ entry, assignment, category }, index) => ({
            externalId: options.externalIdPrefix ? `${options.externalIdPrefix}:${index + 1}` : null,
            submissionGroupId,
            userId,
            competitorKey,
            gameId: submission.gameId,
            mapId: submission.mapId,
            categoryId: assignment.categoryId,
            categoryAssignmentId: assignment.id,
            playerCount: participantUserIds.length,
            scoreValue: entry.scoreValue,
            runDurationMs: entry.runDurationMs ?? null,
            platform: submission.platform ?? null,
            gameVersion: submission.gameVersion ?? null,
            mapVersion: submission.mapVersion ?? null,
            modId: submission.modId ?? null,
            modVersion: submission.modVersion ?? null,
            status: pendingParticipants.length > 0 ? "awaiting_participants" as const : "pending" as const,
            proofLevel: submission.proofLevel,
            proofUrl: submission.proofUrl ?? null,
            submittedBy: userId,
            metadata: {
              ...(submission.metadata ?? {}),
              ...(entry.metadata ?? {}),
              ...(options.metadata ?? {}),
            },
            rulesSnapshot: { global: category.rules, specific: assignment.specificRules },
          })),
        ).returning();
        if (created.length !== entries.length) {
          throw new ConflictError("submission group could not be created");
        }

        await tx.insert(submissionParticipants).values(created.flatMap((createdSubmission) =>
          consent.map((participant) => ({
            submissionId: createdSubmission.id,
            userId: participant.userId,
            role: participant.userId === userId ? "primary" as const : "teammate" as const,
            status: participant.status,
            acceptanceSource: participant.acceptanceSource,
            acceptanceClanId: participant.acceptanceClanId,
            respondedAt: participant.status === "accepted" ? new Date() : null,
          }))
        ));
        if (pendingParticipants.length > 0) {
          await tx.insert(participationInvitations).values(pendingParticipants.map((participant) => ({
            submissionGroupId,
            inviteeUserId: participant.userId,
            invitedBy: userId,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000),
          })));
          for (const participant of pendingParticipants) {
            await enqueueOutboxEvent(tx, {
              eventKey: `participation.invited:${submissionGroupId}:${participant.userId}`,
              type: "participation.invited",
              actorUserId: userId,
              recipientUserIds: [participant.userId],
              payload: {
                submissionGroupId,
                submissionIds: created.map((entry) =>
                  entry.id
                ),
              },
            });
          }
        }
        if (submission.proofs && submission.proofs.length > 0) {
          await tx.insert(submissionProofs).values(created.flatMap((createdSubmission) =>
            submission.proofs!.map((proof) => ({
              submissionId: createdSubmission.id,
              ...proof,
              sourceUrl: proof.sourceUrl ?? null,
              storageKey: proof.storageKey ?? null,
              sha256: proof.sha256 ?? null,
              mimeType: proof.mimeType ?? null,
              formatVersion: proof.formatVersion ?? 1,
              provider: proof.provider ?? "other",
              metadata: proof.metadata ?? {},
            }))
          ));
        }
        return created;
      }),
    catch: (error) => error,
  });
}

async function assertActiveSubmissionCapacity(db: Database, userId: string, requested: number) {
  await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`manual-submission:${userId}`}))`);
  const [usage] = await db.execute<{ count: number }>(sql`
    SELECT count(*)::int AS count
    FROM submissions
    WHERE submitted_by = ${userId}
      AND external_id IS NULL
      AND status IN ('awaiting_participants', 'pending')
  `);
  if (usage && usage.count + requested > 5) {
    throw new ConflictError("a user cannot have more than five active submissions");
  }
}

/** Reviews a pending submission and atomically refreshes its player's active record if appropriate. */
export function reviewSubmission(db: Database, submissionId: number, payload: unknown, reviewerId: string) {
  return Schema.decodeUnknown(ReviewSubmissionPayload)(payload).pipe(
    Effect.mapError((error) => new ValidationError(String(error))),
    Effect.flatMap((review) =>
      Effect.tryPromise({
        try: () =>
          db.transaction(async (tx) => {
            const [submission] = await tx.select().from(submissions).where(eq(submissions.id, submissionId))
              .limit(1);
            if (!submission) throw new NotFoundError("submission not found");
            if (submission.status !== "pending") {
              throw new ConflictError("only a pending submission can be reviewed");
            }

            const [updated] = await tx.update(submissions).set({
              status: review.status,
              verifiedBy: reviewerId,
              verifiedAt: new Date(),
              reviewNote: review.reviewNote ?? null,
            }).where(eq(submissions.id, submissionId)).returning();

            const submissionMembers = await tx.select({ userId: submissionParticipants.userId })
              .from(submissionParticipants).where(and(
                eq(submissionParticipants.submissionId, submissionId),
                eq(submissionParticipants.status, "accepted"),
              ));
            const recipientUserIds = [
              ...new Set([
                submission.submittedBy,
                ...submissionMembers.map((member) => member.userId),
              ]),
            ].filter((userId): userId is string => userId !== null && userId !== reviewerId);

            if (review.status === "rejected") {
              await enqueueOutboxEvent(tx as unknown as Database, {
                eventKey: `submission.reviewed:${submissionId}:rejected`,
                type: "submission.rejected",
                actorUserId: reviewerId,
                recipientUserIds,
                payload: {
                  submissionId,
                  submissionGroupId: submission.submissionGroupId,
                  reviewNote: review.reviewNote ?? null,
                },
              });
              return { submission: updated, recordUpdated: false };
            }

            const [category] = await tx.select().from(categories).where(
              eq(categories.id, submission.categoryId),
            ).limit(1);
            if (!category) throw new NotFoundError("category not found");
            if (submission.categoryAssignmentId === null) {
              throw new ValidationError("submission has no category assignment");
            }
            await tx.execute(
              sql`SELECT pg_advisory_xact_lock(${submission.mapId}, ${submission.categoryAssignmentId})`,
            );

            const [currentRecord] = await tx.select({
              submissionId: bestRecords.submissionId,
              scoreValue: submissions.scoreValue,
              runDurationMs: submissions.runDurationMs,
            }).from(bestRecords).innerJoin(submissions, eq(bestRecords.submissionId, submissions.id)).where(
              and(
                eq(submissions.competitorKey, submission.competitorKey),
                eq(submissions.mapId, submission.mapId),
                eq(submissions.categoryAssignmentId, submission.categoryAssignmentId),
                eq(submissions.playerCount, submission.playerCount),
              ),
            ).limit(1);

            const recordUpdated = !currentRecord || isBetterRecord(
              submission.scoreValue,
              currentRecord.scoreValue,
              submission.runDurationMs,
              currentRecord.runDurationMs,
              category.scoreType,
              category.rankingDirection,
            );
            if (recordUpdated) {
              if (currentRecord) {
                await tx.delete(bestRecords).where(eq(bestRecords.submissionId, currentRecord.submissionId));
              }
              await tx.insert(bestRecords).values({ submissionId: submission.id });
            }

            const leaderboardRows = await tx.select({
              submissionId: bestRecords.submissionId,
              userId: submissions.userId,
              userName: users.name,
              userImage: users.image,
              scoreValue: submissions.scoreValue,
              runDurationMs: submissions.runDurationMs,
              proofLevel: submissions.proofLevel,
              proofUrl: submissions.proofUrl,
              submittedAt: submissions.submittedAt,
            }).from(bestRecords).innerJoin(submissions, eq(bestRecords.submissionId, submissions.id))
              .innerJoin(users, eq(submissions.userId, users.id)).where(and(
                eq(submissions.mapId, submission.mapId),
                eq(submissions.categoryAssignmentId, submission.categoryAssignmentId),
                eq(submissions.playerCount, submission.playerCount),
              )).orderBy(...leaderboardOrderBy(category.scoreType, category.rankingDirection));
            const competitorRows = await tx.selectDistinct({ competitorKey: submissions.competitorKey })
              .from(submissions).where(and(
                eq(submissions.mapId, submission.mapId),
                eq(submissions.categoryAssignmentId, submission.categoryAssignmentId),
                eq(submissions.playerCount, submission.playerCount),
                eq(submissions.status, "verified"),
              ));
            const pool = leaderboardPool(competitorRows.length);
            for (
              const entry of rankLeaderboardRecords(
                leaderboardRows,
                category.rankingDirection,
                pool,
              )
            ) {
              await tx.update(bestRecords).set({ points: entry.points }).where(
                eq(bestRecords.submissionId, entry.submission.id),
              );
            }
            await refreshPersonalBestFlags(
              tx,
              submission.mapId,
              submission.categoryAssignmentId,
              category.scoreType,
              category.rankingDirection,
            );
            const participantRows = await tx.selectDistinct({ userId: submissionParticipants.userId })
              .from(submissionParticipants).innerJoin(
                submissions,
                eq(submissionParticipants.submissionId, submissions.id),
              )
              .where(
                and(
                  eq(submissions.mapId, submission.mapId),
                  eq(submissions.categoryAssignmentId, submission.categoryAssignmentId),
                ),
              );
            if (participantRows.length) {
              await tx.delete(achievementMetricSnapshots).where(
                inArray(
                  achievementMetricSnapshots.userId,
                  participantRows.map((participant) => participant.userId),
                ),
              );
            }
            await recalculatePerformancePointsForUsers(
              tx,
              participantRows.map((participant) => participant.userId),
              {
                source: "submission",
                sourceSubmissionId: submissionId,
                formulaVersion: 5,
                metadata: { mapId: submission.mapId, categoryAssignmentId: submission.categoryAssignmentId },
              },
            );
            await refreshScopedPerformanceForUsers(
              tx as unknown as Database,
              participantRows.map((participant) => participant.userId),
            );
            await enqueueOutboxEvent(tx as unknown as Database, {
              eventKey: `submission.reviewed:${submissionId}:verified`,
              type: "submission.verified",
              actorUserId: reviewerId,
              recipientUserIds,
              subjects: [
                ...submissionMembers.map((member) => ({ type: "user" as const, id: member.userId })),
                { type: "game", id: String(submission.gameId) },
                { type: "map", id: String(submission.mapId) },
                { type: "category_assignment", id: String(submission.categoryAssignmentId) },
                {
                  type: "map_category",
                  id: `${submission.mapId}:${submission.categoryAssignmentId}`,
                },
                ...(submission.playerCount > 1
                  ? [{ type: "team" as const, id: submission.competitorKey }]
                  : []),
              ],
              payload: {
                submissionId,
                submissionGroupId: submission.submissionGroupId,
                competitorKey: submission.competitorKey,
                gameId: submission.gameId,
                mapId: submission.mapId,
                categoryAssignmentId: submission.categoryAssignmentId,
                playerCount: submission.playerCount,
                scoreValue: submission.scoreValue,
                recordUpdated,
              },
            });
            return { submission: updated, recordUpdated, leaderboardRecalculated: true };
          }),
        catch: (error) => error,
      })
    ),
  );
}

async function refreshPersonalBestFlags(
  db: SqlExecutor,
  mapId: number,
  assignmentId: number,
  scoreType: string,
  direction: "higher_is_better" | "lower_is_better",
) {
  await db.execute(sql`
    UPDATE submission_participants sp SET is_personal_best = false
    FROM submissions s WHERE s.id = sp.submission_id
      AND s.map_id = ${mapId} AND s.category_assignment_id = ${assignmentId}
  `);
  const scoreOrder = scoreType === "round" || direction === "higher_is_better" ? sql`DESC` : sql`ASC`;
  await db.execute(sql`
    WITH ranked AS (
      SELECT sp.submission_id, sp.user_id, row_number() OVER (
        PARTITION BY sp.user_id, s.player_count ORDER BY s.score_value ${scoreOrder}, s.run_duration_ms ASC NULLS LAST, s.id ASC
      ) AS position
      FROM submission_participants sp JOIN best_records b ON b.submission_id = sp.submission_id
        JOIN submissions s ON s.id = sp.submission_id
      WHERE s.map_id = ${mapId} AND s.category_assignment_id = ${assignmentId}
    )
    UPDATE submission_participants sp SET is_personal_best = true
    FROM ranked r WHERE sp.submission_id = r.submission_id AND sp.user_id = r.user_id AND r.position = 1
  `);
}

async function assertSubmissionTargetsExist(
  db: Database,
  gameId: number,
  mapId: number,
  categoryAssignmentId: number,
) {
  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!game) throw new NotFoundError("game not found");
  const [map] = await db.select().from(maps).where(eq(maps.id, mapId)).limit(1);
  if (!map) throw new NotFoundError("map not found");
  if (map.gameId !== gameId) throw new ValidationError("map must belong to the submission game");
  const [assignment] = await db.select().from(categoryAssignments).where(
    eq(categoryAssignments.id, categoryAssignmentId),
  ).limit(1);
  if (!assignment) throw new NotFoundError("category assignment not found");
  if (assignment.gameId !== gameId || (assignment.mapId !== null && assignment.mapId !== mapId)) {
    throw new ValidationError("category assignment does not apply to this map");
  }
  return assignment;
}
