import { and, eq, isNull, or, sql } from "drizzle-orm";
import type { Database } from "../../db/client.ts";
import { feedEntries, follows, notifications, outboxEvents } from "../../db/schema.ts";

export type SocialSubject = {
  type: "user" | "game" | "map" | "category_assignment" | "map_category" | "team";
  id: string;
};

export type OutboxEvent = {
  eventKey: string;
  type: string;
  actorUserId?: string | null;
  recipientUserIds?: string[];
  subjects?: SocialSubject[];
  payload?: Record<string, unknown>;
  occurredAt?: Date;
};

export async function enqueueOutboxEvent(db: Database, event: OutboxEvent) {
  const recipients = [...new Set(event.recipientUserIds ?? [])];
  const subjects = [...new Map((event.subjects ?? []).map((subject) => [
    `${subject.type}:${subject.id}`,
    subject,
  ])).values()];
  await db.insert(outboxEvents).values({
    eventKey: event.eventKey,
    type: event.type,
    actorUserId: event.actorUserId ?? null,
    recipientUserIds: recipients,
    subjects,
    payload: event.payload ?? {},
    occurredAt: event.occurredAt,
  }).onConflictDoNothing({ target: outboxEvents.eventKey });
}

/**
 * Projects committed outbox rows into user-specific read models. Row locks and
 * unique indexes make concurrent workers and retries safe.
 */
export async function projectPendingOutbox(db: Database, batchSize = 100) {
  let processed = 0;
  while (true) {
    const count = await db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;
      const events = await tx.execute<{
        id: number;
        type: string;
        actorUserId: string | null;
        recipientUserIds: string[];
        subjects: SocialSubject[];
        payload: Record<string, unknown>;
        occurredAt: Date | string;
      }>(sql`
        SELECT id, type, actor_user_id AS "actorUserId",
          recipient_user_ids AS "recipientUserIds", subjects, payload,
          occurred_at AS "occurredAt"
        FROM outbox_events
        WHERE processed_at IS NULL
        ORDER BY id
        FOR UPDATE SKIP LOCKED
        LIMIT ${batchSize}
      `);

      for (const event of events) {
        const occurredAt = event.occurredAt instanceof Date ? event.occurredAt : new Date(event.occurredAt);
        const recipients = [...new Set(event.recipientUserIds)];
        if (recipients.length > 0) {
          await tx.insert(notifications).values(recipients.map((recipientUserId) => ({
            recipientUserId,
            outboxEventId: event.id,
            type: event.type,
            actorUserId: event.actorUserId,
            payload: event.payload,
            createdAt: occurredAt,
          }))).onConflictDoNothing();
        }

        const subjectConditions = event.subjects.map((subject) =>
          and(eq(follows.targetType, subject.type), eq(follows.targetId, subject.id))
        );
        if (subjectConditions.length > 0) {
          const followers = await tx.select({ userId: follows.followerUserId }).from(follows).where(
            subjectConditions.length === 1 ? subjectConditions[0] : or(...subjectConditions),
          );
          const viewers = [...new Set(followers.map((follower) => follower.userId))];
          if (viewers.length > 0) {
            await tx.insert(feedEntries).values(viewers.map((viewerUserId) => ({
              viewerUserId,
              outboxEventId: event.id,
              type: event.type,
              actorUserId: event.actorUserId,
              payload: event.payload,
              createdAt: occurredAt,
            }))).onConflictDoNothing();
          }
        }

        await tx.update(outboxEvents).set({ processedAt: new Date() }).where(and(
          eq(outboxEvents.id, event.id),
          isNull(outboxEvents.processedAt),
        ));
      }
      return events.length;
    });
    processed += count;
    if (count < batchSize) return processed;
  }
}
