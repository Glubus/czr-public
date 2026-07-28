import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { Effect, Schema } from "effect";
import type { Database } from "../../db/client.ts";
import {
  follows,
  participationInvitations,
  personalRuns,
  profileClaims,
  submissionParticipants,
  submissions,
  users,
} from "../../db/schema.ts";
import { type ClaimAffectedBoard, refreshClaimAffectedDerivedData } from "./derived-data.ts";
import { competitorKeyFor } from "../submissions/validation.ts";
import { ConflictError, NotFoundError, ValidationError } from "../shared/errors.ts";
import { enqueueOutboxEvent } from "../social/outbox.ts";

const CreateClaimPayload = Schema.Struct({
  profileUserId: Schema.String.pipe(Schema.minLength(1)),
  proofUrl: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(2_000)),
  message: Schema.optional(Schema.String.pipe(Schema.maxLength(2_000))),
});
const ReviewClaimPayload = Schema.Struct({
  status: Schema.Literal("approved", "rejected"),
  reviewNote: Schema.optional(Schema.NullOr(Schema.String.pipe(Schema.maxLength(2_000)))),
});

export function createProfileClaim(db: Database, claimantUserId: string, payload: unknown) {
  return Schema.decodeUnknown(CreateClaimPayload)(payload).pipe(
    Effect.mapError((error) => new ValidationError(String(error))),
    Effect.flatMap((decoded) =>
      Effect.tryPromise({
        try: async () => {
          if (decoded.profileUserId === claimantUserId) {
            throw new ValidationError("a user cannot claim their own account");
          }
          assertHttpUrl(decoded.proofUrl);
          const [claimant] = await db.select({
            emailVerified: users.emailVerified,
            externalId: users.externalId,
          }).from(users)
            .where(eq(users.id, claimantUserId)).limit(1);
          if (!claimant) throw new NotFoundError("claimant account not found");
          if (!claimant.emailVerified) {
            throw new ConflictError("email must be verified before claiming a profile");
          }
          if (claimant.externalId?.startsWith("zwr:player:")) {
            throw new ConflictError("this account has already claimed a player profile");
          }
          const [activeClaim] = await db.select({ id: profileClaims.id }).from(profileClaims).where(
            and(
              eq(profileClaims.claimantUserId, claimantUserId),
              sql`${profileClaims.status} IN ('pending', 'approved')`,
            ),
          ).limit(1);
          if (activeClaim) {
            throw new ConflictError("this account already has an active player profile claim");
          }
          const [profile] = await db.select({
            id: users.id,
            externalId: users.externalId,
            email: users.email,
            name: users.name,
          }).from(users).where(eq(users.id, decoded.profileUserId)).limit(1);
          if (!profile) throw new NotFoundError("profile not found");
          if (!isImportedProfile(profile)) throw new ConflictError("profile is not claimable");

          const [created] = await db.insert(profileClaims).values({
            claimantUserId,
            profileUserId: profile.id,
            profileExternalId: profile.externalId!,
            proofUrl: decoded.proofUrl,
            message: decoded.message?.trim() || null,
          }).returning();
          return { ...created, profile: { id: profile.id, name: profile.name } };
        },
        catch: normalizeClaimError,
      })
    ),
  );
}

export function listOwnProfileClaims(db: Database, claimantUserId: string) {
  return Effect.tryPromise({
    try: () =>
      db.select().from(profileClaims).where(eq(profileClaims.claimantUserId, claimantUserId))
        .orderBy(desc(profileClaims.createdAt), desc(profileClaims.id)),
    catch: (error) => error,
  });
}

export function listProfileClaims(db: Database, status?: string) {
  return Effect.tryPromise({
    try: async () => {
      if (status !== undefined && !["pending", "approved", "rejected"].includes(status)) {
        throw new ValidationError("status must be pending, approved or rejected");
      }
      return await db.select().from(profileClaims)
        .where(status ? eq(profileClaims.status, status as "pending" | "approved" | "rejected") : undefined)
        .orderBy(asc(profileClaims.createdAt), asc(profileClaims.id));
    },
    catch: (error) => error,
  });
}

export function reviewProfileClaim(db: Database, claimId: number, reviewerUserId: string, payload: unknown) {
  return Schema.decodeUnknown(ReviewClaimPayload)(payload).pipe(
    Effect.mapError((error) => new ValidationError(String(error))),
    Effect.flatMap((decoded) =>
      Effect.tryPromise({
        try: () =>
          db.transaction(async (transaction) => {
            const tx = transaction as unknown as Database;
            const locked = await tx.execute<{
              id: number;
              claimant_user_id: string;
              profile_user_id: string | null;
              profile_external_id: string;
              status: "pending" | "approved" | "rejected";
            }>(sql`
            SELECT id, claimant_user_id, profile_user_id, profile_external_id, status
            FROM profile_claims WHERE id = ${claimId} FOR UPDATE
          `);
            const claim = locked[0];
            if (!claim) throw new NotFoundError("profile claim not found");
            if (claim.status !== "pending") {
              throw new ConflictError("profile claim has already been reviewed");
            }

            if (decoded.status === "approved") {
              await mergeImportedProfile(
                tx,
                claim.claimant_user_id,
                claim.profile_user_id,
                claim.profile_external_id,
              );
            }

            const [updated] = await tx.update(profileClaims).set({
              status: decoded.status,
              reviewedBy: reviewerUserId,
              reviewNote: decoded.reviewNote?.trim() || null,
              reviewedAt: new Date(),
            }).where(and(eq(profileClaims.id, claimId), eq(profileClaims.status, "pending"))).returning();
            if (!updated) throw new ConflictError("profile claim has already been reviewed");
            await enqueueOutboxEvent(tx, {
              eventKey: `profile-claim.reviewed:${claimId}:${decoded.status}`,
              type: `profile_claim.${decoded.status}`,
              actorUserId: reviewerUserId,
              recipientUserIds: [claim.claimant_user_id],
              payload: {
                claimId,
                status: decoded.status,
                reviewNote: decoded.reviewNote?.trim() || null,
              },
            });
            return updated;
          }),
        catch: normalizeClaimError,
      })
    ),
  );
}

async function mergeImportedProfile(
  db: Database,
  claimantUserId: string,
  profileUserId: string | null,
  profileExternalId: string,
) {
  if (!profileUserId) throw new ConflictError("imported profile no longer exists");
  const [claimant] = await db.select({ id: users.id, externalId: users.externalId }).from(users)
    .where(eq(users.id, claimantUserId)).limit(1);
  const [profile] = await db.select({ id: users.id, externalId: users.externalId, email: users.email }).from(
    users,
  )
    .where(eq(users.id, profileUserId)).limit(1);
  if (!claimant) throw new NotFoundError("claimant account not found");
  if (!profile || !isImportedProfile(profile) || profile.externalId !== profileExternalId) {
    throw new ConflictError("imported profile is no longer claimable");
  }
  if (claimant.externalId) throw new ConflictError("claimant already owns an imported profile");

  const affected = await db.selectDistinct({
    submissionId: submissionParticipants.submissionId,
    competitorKey: submissions.competitorKey,
    mapId: submissions.mapId,
    categoryAssignmentId: submissions.categoryAssignmentId,
    playerCount: submissions.playerCount,
  }).from(submissionParticipants).innerJoin(
    submissions,
    eq(submissionParticipants.submissionId, submissions.id),
  ).where(eq(submissionParticipants.userId, profileUserId));

  await db.execute(sql`
    DELETE FROM follows imported USING follows claimant
    WHERE imported.follower_user_id = ${profileUserId}
      AND claimant.follower_user_id = ${claimantUserId}
      AND claimant.target_type = imported.target_type
      AND claimant.target_id = imported.target_id
  `);
  await db.update(follows).set({ followerUserId: claimantUserId }).where(
    eq(follows.followerUserId, profileUserId),
  );
  await db.execute(sql`
    DELETE FROM follows imported USING follows claimant
    WHERE imported.target_type = 'user' AND imported.target_id = ${profileUserId}
      AND claimant.follower_user_id = imported.follower_user_id
      AND claimant.target_type = 'user' AND claimant.target_id = ${claimantUserId}
  `);
  await db.update(follows).set({ targetId: claimantUserId }).where(and(
    eq(follows.targetType, "user"),
    eq(follows.targetId, profileUserId),
  ));

  await db.execute(sql`
    DELETE FROM submission_participants imported
    USING submission_participants claimant
    WHERE imported.user_id = ${profileUserId}
      AND claimant.user_id = ${claimantUserId}
      AND imported.submission_id = claimant.submission_id
  `);
  await db.update(submissionParticipants).set({ userId: claimantUserId })
    .where(eq(submissionParticipants.userId, profileUserId));
  await db.execute(sql`
    DELETE FROM participation_invitations imported
    USING participation_invitations claimant
    WHERE imported.invitee_user_id = ${profileUserId}
      AND claimant.invitee_user_id = ${claimantUserId}
      AND imported.submission_group_id = claimant.submission_group_id
  `);
  await db.update(participationInvitations).set({ inviteeUserId: claimantUserId })
    .where(eq(participationInvitations.inviteeUserId, profileUserId));
  await db.update(participationInvitations).set({ invitedBy: claimantUserId })
    .where(eq(participationInvitations.invitedBy, profileUserId));
  await db.update(submissions).set({ userId: claimantUserId }).where(eq(submissions.userId, profileUserId));
  await db.update(submissions).set({ submittedBy: claimantUserId }).where(
    eq(submissions.submittedBy, profileUserId),
  );
  await db.update(submissions).set({ verifiedBy: claimantUserId }).where(
    eq(submissions.verifiedBy, profileUserId),
  );
  await db.update(personalRuns).set({ userId: claimantUserId }).where(eq(personalRuns.userId, profileUserId));

  const participantIds = new Map<number, string[]>();
  for (let offset = 0; offset < affected.length; offset += 1_000) {
    const submissionIds = affected.slice(offset, offset + 1_000).map((entry) => entry.submissionId);
    const participants = await db.select({
      submissionId: submissionParticipants.submissionId,
      userId: submissionParticipants.userId,
    }).from(submissionParticipants)
      .where(inArray(submissionParticipants.submissionId, submissionIds))
      .orderBy(asc(submissionParticipants.submissionId), asc(submissionParticipants.userId));
    for (const participant of participants) {
      const members = participantIds.get(participant.submissionId) ?? [];
      members.push(participant.userId);
      participantIds.set(participant.submissionId, members);
    }
  }
  const competitorUpdates = affected.map((entry) => {
    const members = participantIds.get(entry.submissionId) ?? [];
    return {
      submissionId: entry.submissionId,
      previousCompetitorKey: entry.competitorKey,
      nextCompetitorKey: competitorKeyFor(members),
      playerCount: members.length,
    };
  });
  for (let offset = 0; offset < competitorUpdates.length; offset += 500) {
    const batch = competitorUpdates.slice(offset, offset + 500);
    const values = sql.join(
      batch.map((entry) =>
        sql`(${entry.submissionId}::integer, ${entry.nextCompetitorKey}::text, ${entry.playerCount}::integer)`
      ),
      sql`, `,
    );
    await db.execute(sql`
      UPDATE ${submissions} submission
      SET competitor_key = payload.competitor_key, player_count = payload.player_count
      FROM (VALUES ${values}) AS payload(submission_id, competitor_key, player_count)
      WHERE submission.id = payload.submission_id
    `);
  }
  const teamKeyChanges = new Map<string, string>();
  for (const { previousCompetitorKey, nextCompetitorKey } of competitorUpdates) {
    if (previousCompetitorKey !== nextCompetitorKey && previousCompetitorKey.startsWith("team:")) {
      teamKeyChanges.set(previousCompetitorKey, nextCompetitorKey);
    }
  }
  for (const [previousCompetitorKey, nextCompetitorKey] of teamKeyChanges) {
    await db.execute(sql`
        DELETE FROM follows previous USING follows next
        WHERE previous.target_type = 'team' AND previous.target_id = ${previousCompetitorKey}
          AND next.follower_user_id = previous.follower_user_id
          AND next.target_type = 'team' AND next.target_id = ${nextCompetitorKey}
      `);
    await db.update(follows).set({ targetId: nextCompetitorKey }).where(and(
      eq(follows.targetType, "team"),
      eq(follows.targetId, previousCompetitorKey),
    ));
  }

  await db.update(users).set({ externalId: null }).where(eq(users.id, profileUserId));
  await db.update(users).set({ externalId: profileExternalId }).where(eq(users.id, claimantUserId));
  await db.delete(users).where(eq(users.id, profileUserId));
  await refreshClaimAffectedDerivedData(
    db,
    affected.flatMap<ClaimAffectedBoard>((entry) =>
      entry.categoryAssignmentId === null ? [] : [{
        mapId: entry.mapId,
        categoryAssignmentId: entry.categoryAssignmentId,
        playerCount: entry.playerCount,
      }]
    ),
    claimantUserId,
  );
}

function assertHttpUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("unsupported protocol");
  } catch {
    throw new ValidationError("proofUrl must be an absolute HTTP(S) URL");
  }
}

function isImportedProfile(profile: { externalId: string | null; email: string }) {
  return profile.externalId?.startsWith("zwr:player:") === true && profile.email.endsWith("@import.local");
}

function normalizeClaimError(error: unknown) {
  if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
    return error;
  }
  if (postgresErrorCode(error) === "23505") {
    return new ConflictError("an active profile claim already exists");
  }
  return error;
}

function postgresErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  if ("code" in error && typeof error.code === "string") return error.code;
  return "cause" in error ? postgresErrorCode(error.cause) : undefined;
}
