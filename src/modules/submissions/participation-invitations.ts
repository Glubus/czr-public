import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { Effect, Schema } from "effect";
import type { Database } from "../../db/client.ts";
import { participationInvitations, submissionParticipants, submissions, users } from "../../db/schema.ts";
import { ConflictError, NotFoundError, ValidationError } from "../shared/errors.ts";
import { enqueueOutboxEvent } from "../social/outbox.ts";

const ParticipationDecisionPayload = Schema.Struct({
  status: Schema.Literal("accepted", "rejected"),
});

export async function cleanupExpiredParticipationInvitations(db: Database, batchSize = 100) {
  if (!Number.isSafeInteger(batchSize) || batchSize <= 0) {
    throw new ValidationError("batchSize must be a positive integer");
  }
  const candidates = await db.execute<{ submissionGroupId: string }>(sql`
    SELECT DISTINCT submission_group_id AS "submissionGroupId"
    FROM participation_invitations
    WHERE status = 'pending' AND expires_at <= now()
    ORDER BY submission_group_id
    LIMIT ${batchSize}
  `);
  let expiredGroups = 0;
  for (const candidate of candidates) {
    const expired = await db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${`participation-group:${candidate.submissionGroupId}`}))`,
      );
      const pendingInvitations = await tx.select().from(participationInvitations).where(and(
        eq(participationInvitations.submissionGroupId, candidate.submissionGroupId),
        eq(participationInvitations.status, "pending"),
      )).for("update");
      if (!pendingInvitations.some((invitation) => invitation.expiresAt <= new Date())) return false;

      const now = new Date();
      const submissionRows = await tx.select({ id: submissions.id }).from(submissions).where(
        eq(submissions.submissionGroupId, candidate.submissionGroupId),
      );
      const submissionIds = submissionRows.map((submission) => submission.id);
      await tx.update(participationInvitations).set({ status: "expired", respondedAt: now }).where(and(
        eq(participationInvitations.submissionGroupId, candidate.submissionGroupId),
        eq(participationInvitations.status, "pending"),
      ));
      if (submissionIds.length > 0) {
        await tx.update(submissionParticipants).set({ status: "rejected", respondedAt: now }).where(and(
          inArray(submissionParticipants.submissionId, submissionIds),
          eq(submissionParticipants.status, "pending"),
        ));
      }
      await tx.update(submissions).set({
        status: "cancelled",
        reviewNote: "participation invitation expired",
      }).where(and(
        eq(submissions.submissionGroupId, candidate.submissionGroupId),
        eq(submissions.status, "awaiting_participants"),
      ));
      const recipients = pendingInvitations.flatMap((invitation) => [
        invitation.inviteeUserId,
        ...(invitation.invitedBy ? [invitation.invitedBy] : []),
      ]);
      await enqueueOutboxEvent(tx, {
        eventKey: `participation.group_expired:${candidate.submissionGroupId}`,
        type: "participation.expired",
        recipientUserIds: recipients,
        payload: { submissionGroupId: candidate.submissionGroupId },
      });
      return true;
    });
    if (expired) expiredGroups++;
  }
  return expiredGroups;
}

export function listOwnParticipationInvitations(db: Database, userId: string) {
  return databaseEffect(async () => {
    const rows = await db.select({
      invitation: participationInvitations,
      submitter: { id: users.id, name: users.name, image: users.image },
    }).from(participationInvitations)
      .leftJoin(users, eq(participationInvitations.invitedBy, users.id))
      .where(and(
        eq(participationInvitations.inviteeUserId, userId),
        eq(participationInvitations.status, "pending"),
      ))
      .orderBy(desc(participationInvitations.createdAt), desc(participationInvitations.id));
    const groups = await loadGroups(db, rows.map((row) => row.invitation.submissionGroupId));
    return rows.map((row) => ({
      ...row,
      group: groups.get(row.invitation.submissionGroupId)!,
    }));
  });
}

export function respondParticipationInvitation(
  db: Database,
  invitationId: number,
  userId: string,
  payload: unknown,
) {
  if (!Number.isSafeInteger(invitationId) || invitationId <= 0) {
    return Effect.fail(new ValidationError("invitationId must be a positive integer"));
  }
  return Schema.decodeUnknown(ParticipationDecisionPayload)(payload).pipe(
    Effect.mapError((error) => new ValidationError(String(error))),
    Effect.flatMap((decision) =>
      databaseEffect(() =>
        db.transaction(async (transaction) => {
          const tx = transaction as unknown as Database;
          const [candidate] = await tx.select({
            inviteeUserId: participationInvitations.inviteeUserId,
            submissionGroupId: participationInvitations.submissionGroupId,
          }).from(participationInvitations).where(eq(participationInvitations.id, invitationId)).limit(1);
          if (!candidate || candidate.inviteeUserId !== userId) {
            throw new NotFoundError("participation invitation not found");
          }
          await tx.execute(
            sql`SELECT pg_advisory_xact_lock(hashtext(${`participation-group:${candidate.submissionGroupId}`}))`,
          );
          const [invitation] = await tx.select().from(participationInvitations).where(
            eq(participationInvitations.id, invitationId),
          ).for("update").limit(1);
          if (!invitation) throw new NotFoundError("participation invitation not found");
          if (invitation.status !== "pending") {
            throw new ConflictError("participation invitation is no longer pending");
          }

          const submissionRows = await tx.select({ id: submissions.id }).from(submissions).where(
            eq(submissions.submissionGroupId, invitation.submissionGroupId),
          );
          if (submissionRows.length === 0) throw new NotFoundError("submission group not found");
          const submissionIds = submissionRows.map((submission) => submission.id);
          const now = new Date();
          if (invitation.expiresAt <= now) {
            await cancelGroup(
              tx,
              invitation.submissionGroupId,
              submissionIds,
              invitation.id,
              userId,
              "expired",
            );
            await enqueueParticipationResponse(tx, invitation, userId, "expired");
            return { expired: true as const };
          }

          if (decision.status === "rejected") {
            await cancelGroup(
              tx,
              invitation.submissionGroupId,
              submissionIds,
              invitation.id,
              userId,
              "rejected",
            );
            await enqueueParticipationResponse(tx, invitation, userId, "rejected");
            return {
              expired: false as const,
              value: await getGroup(tx, invitation.submissionGroupId),
            };
          }

          await tx.update(participationInvitations).set({ status: "accepted", respondedAt: now }).where(
            eq(participationInvitations.id, invitation.id),
          );
          await tx.update(submissionParticipants).set({
            status: "accepted",
            acceptanceSource: "invitation",
            respondedAt: now,
          }).where(and(
            inArray(submissionParticipants.submissionId, submissionIds),
            eq(submissionParticipants.userId, userId),
          ));
          const [remaining] = await tx.select({ id: participationInvitations.id })
            .from(participationInvitations).where(and(
              eq(participationInvitations.submissionGroupId, invitation.submissionGroupId),
              eq(participationInvitations.status, "pending"),
            )).limit(1);
          if (!remaining) {
            await tx.update(submissions).set({ status: "pending" }).where(and(
              eq(submissions.submissionGroupId, invitation.submissionGroupId),
              eq(submissions.status, "awaiting_participants"),
            ));
          }
          await enqueueParticipationResponse(tx, invitation, userId, "accepted");
          return {
            expired: false as const,
            value: await getGroup(tx, invitation.submissionGroupId),
          };
        })
      ).pipe(
        Effect.flatMap((result) =>
          result.expired
            ? Effect.fail(new ConflictError("participation invitation has expired and the run was cancelled"))
            : Effect.succeed(result.value)
        ),
      )
    ),
  );
}

function enqueueParticipationResponse(
  db: Database,
  invitation: { id: number; submissionGroupId: string; invitedBy: string | null },
  userId: string,
  status: "accepted" | "rejected" | "expired",
) {
  return enqueueOutboxEvent(db, {
    eventKey: `participation.responded:${invitation.id}:${status}`,
    type: `participation.${status}`,
    actorUserId: userId,
    recipientUserIds: invitation.invitedBy ? [invitation.invitedBy] : [],
    payload: { invitationId: invitation.id, submissionGroupId: invitation.submissionGroupId, status },
  });
}

async function cancelGroup(
  db: Database,
  groupId: string,
  submissionIds: number[],
  invitationId: number,
  userId: string,
  reason: "expired" | "rejected",
) {
  const now = new Date();
  await db.update(participationInvitations).set({ status: reason, respondedAt: now }).where(
    eq(participationInvitations.id, invitationId),
  );
  await db.update(participationInvitations).set({ status: "revoked", respondedAt: now }).where(and(
    eq(participationInvitations.submissionGroupId, groupId),
    eq(participationInvitations.status, "pending"),
    ne(participationInvitations.id, invitationId),
  ));
  await db.update(submissionParticipants).set({ status: "rejected", respondedAt: now }).where(and(
    inArray(submissionParticipants.submissionId, submissionIds),
    eq(submissionParticipants.userId, userId),
  ));
  await db.update(submissions).set({
    status: "cancelled",
    reviewNote: reason === "expired"
      ? "participation invitation expired"
      : "participant rejected the run invitation",
  }).where(and(
    eq(submissions.submissionGroupId, groupId),
    eq(submissions.status, "awaiting_participants"),
  ));
}

async function loadGroups(db: Database, groupIds: string[]) {
  const uniqueGroupIds = [...new Set(groupIds)];
  if (uniqueGroupIds.length === 0) return new Map<string, Awaited<ReturnType<typeof getGroup>>>();
  const groups = await Promise.all(uniqueGroupIds.map((groupId) => getGroup(db, groupId)));
  return new Map(groups.map((group) => [group.submissionGroupId, group]));
}

async function getGroup(db: Database, groupId: string) {
  const submissionRows = await db.select().from(submissions).where(eq(submissions.submissionGroupId, groupId))
    .orderBy(submissions.id);
  const submissionIds = submissionRows.map((submission) => submission.id);
  const participants = submissionIds.length === 0 ? [] : await db.select({
    submissionId: submissionParticipants.submissionId,
    userId: submissionParticipants.userId,
    role: submissionParticipants.role,
    status: submissionParticipants.status,
    acceptanceSource: submissionParticipants.acceptanceSource,
    acceptanceClanId: submissionParticipants.acceptanceClanId,
    respondedAt: submissionParticipants.respondedAt,
  }).from(submissionParticipants).where(inArray(submissionParticipants.submissionId, submissionIds));
  return { submissionGroupId: groupId, submissions: submissionRows, participants };
}

function databaseEffect<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({ try: operation, catch: (error) => error });
}
