import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { Effect, Schema } from "effect";
import type { Database } from "../../db/client.ts";
import {
  bestRecords,
  categoryAssignments,
  feedEntries,
  follows,
  games,
  maps,
  notifications,
  submissions,
  users,
} from "../../db/schema.ts";
import { ConflictError, NotFoundError, ValidationError } from "../shared/errors.ts";
import { projectPendingOutbox } from "./outbox.ts";

const FollowPayload = Schema.Struct({
  targetType: Schema.Literal("user", "game", "map", "category_assignment", "map_category", "team"),
  targetId: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(300)),
});

type FollowType = typeof FollowPayload.Type["targetType"];

export function createFollow(db: Database, followerUserId: string, payload: unknown) {
  return decode(FollowPayload, payload).pipe(
    Effect.flatMap((decoded) =>
      databaseEffect(async () => {
        const targetId = decoded.targetId.trim();
        await assertTargetExists(db, decoded.targetType, targetId);
        if (decoded.targetType === "user" && targetId === followerUserId) {
          throw new ValidationError("a user cannot follow themselves");
        }
        try {
          const [created] = await db.insert(follows).values({
            followerUserId,
            targetType: decoded.targetType,
            targetId,
          }).returning();
          return created!;
        } catch (error) {
          if (postgresErrorCode(error) === "23505") throw new ConflictError("target is already followed");
          throw error;
        }
      })
    ),
  );
}

export function deleteFollow(db: Database, followerUserId: string, targetType: string, targetId: string) {
  return databaseEffect(async () => {
    const type = parseTargetType(targetType);
    if (targetId.length === 0 || targetId.length > 300) throw new ValidationError("targetId is invalid");
    const [removed] = await db.delete(follows).where(and(
      eq(follows.followerUserId, followerUserId),
      eq(follows.targetType, type),
      eq(follows.targetId, targetId),
    )).returning({ id: follows.id });
    if (!removed) throw new NotFoundError("follow not found");
    return { removed: true };
  });
}

export function listFollows(db: Database, followerUserId: string, targetType?: string) {
  return databaseEffect(async () => {
    const type = targetType === undefined ? undefined : parseTargetType(targetType);
    return await db.select().from(follows).where(and(
      eq(follows.followerUserId, followerUserId),
      type ? eq(follows.targetType, type) : undefined,
    )).orderBy(desc(follows.createdAt), desc(follows.id));
  });
}

export function listFeed(db: Database, viewerUserId: string, query: { cursor?: string; type?: string }) {
  return databaseEffect(async () => {
    await projectPendingOutbox(db);
    const cursor = parseCursor(query.cursor);
    assertEventType(query.type);
    const rows = await db.select().from(feedEntries).where(and(
      eq(feedEntries.viewerUserId, viewerUserId),
      cursor ? lt(feedEntries.id, cursor) : undefined,
      query.type ? eq(feedEntries.type, query.type) : undefined,
    )).orderBy(desc(feedEntries.id)).limit(26);
    return cursorPage(rows);
  });
}

export function listNotifications(
  db: Database,
  recipientUserId: string,
  query: { cursor?: string; unread?: string; type?: string },
) {
  return databaseEffect(async () => {
    await projectPendingOutbox(db);
    const cursor = parseCursor(query.cursor);
    const unread = parseUnread(query.unread);
    assertEventType(query.type);
    const rows = await db.select().from(notifications).where(and(
      eq(notifications.recipientUserId, recipientUserId),
      cursor ? lt(notifications.id, cursor) : undefined,
      unread === true ? isNull(notifications.readAt) : undefined,
      query.type ? eq(notifications.type, query.type) : undefined,
    )).orderBy(desc(notifications.id)).limit(26);
    return cursorPage(rows);
  });
}

export function readNotification(db: Database, recipientUserId: string, notificationId: number) {
  return databaseEffect(async () => {
    assertPositiveId(notificationId, "notificationId");
    const [updated] = await db.update(notifications).set({ readAt: new Date() }).where(and(
      eq(notifications.id, notificationId),
      eq(notifications.recipientUserId, recipientUserId),
    )).returning();
    if (!updated) throw new NotFoundError("notification not found");
    return updated;
  });
}

export function readAllNotifications(db: Database, recipientUserId: string) {
  return databaseEffect(async () => {
    const result = await db.execute<{ count: number }>(sql`
      WITH updated AS (
        UPDATE notifications SET read_at = now()
        WHERE recipient_user_id = ${recipientUserId} AND read_at IS NULL
        RETURNING id
      ) SELECT count(*)::int AS count FROM updated
    `);
    return { updated: result[0]?.count ?? 0 };
  });
}

export function unreadNotificationCount(db: Database, recipientUserId: string) {
  return databaseEffect(async () => {
    await projectPendingOutbox(db);
    const result = await db.execute<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM notifications
      WHERE recipient_user_id = ${recipientUserId} AND read_at IS NULL
    `);
    return { count: result[0]?.count ?? 0 };
  });
}

async function assertTargetExists(db: Database, type: FollowType, targetId: string) {
  if (type === "user") {
    const [target] = await db.select({ id: users.id }).from(users).where(and(
      eq(users.id, targetId),
      isNull(users.deletedAt),
    )).limit(1);
    if (!target) throw new NotFoundError("user target not found");
    return;
  }
  if (type === "team") {
    if (!/^team:[^:]+(?::[^:]+){1,3}$/.test(targetId)) throw new ValidationError("team target is invalid");
    const [target] = await db.select({ id: bestRecords.submissionId }).from(bestRecords)
      .innerJoin(submissions, eq(bestRecords.submissionId, submissions.id))
      .where(eq(submissions.competitorKey, targetId)).limit(1);
    if (!target) throw new NotFoundError("team target not found");
    return;
  }
  if (type === "map_category") {
    const match = /^(\d+):(\d+)$/.exec(targetId);
    if (!match) throw new ValidationError("map category target is invalid");
    const mapId = parsePositiveId(match[1]!, "mapId");
    const assignmentId = parsePositiveId(match[2]!, "categoryAssignmentId");
    const [target] = await db.select({ id: categoryAssignments.id }).from(categoryAssignments)
      .innerJoin(maps, eq(maps.gameId, categoryAssignments.gameId))
      .where(and(
        eq(maps.id, mapId),
        eq(categoryAssignments.id, assignmentId),
        or(eq(categoryAssignments.mapId, mapId), isNull(categoryAssignments.mapId)),
      ))
      .limit(1);
    if (!target) throw new NotFoundError("map category target not found");
    return;
  }
  const id = parsePositiveId(targetId, "targetId");
  const table = type === "game" ? games : type === "map" ? maps : categoryAssignments;
  const [target] = await db.select({ id: table.id }).from(table).where(eq(table.id, id)).limit(1);
  if (!target) throw new NotFoundError(`${type} target not found`);
}

function parseTargetType(value: string): FollowType {
  if (["user", "game", "map", "category_assignment", "map_category", "team"].includes(value)) {
    return value as FollowType;
  }
  throw new ValidationError("targetType must be user, game, map, category_assignment, map_category or team");
}

function parseCursor(value?: string) {
  return value === undefined ? undefined : parsePositiveId(value, "cursor");
}

function parseUnread(value?: string) {
  if (value === undefined || value === "false") return false;
  if (value === "true") return true;
  throw new ValidationError("unread must be true or false");
}

function assertEventType(value?: string) {
  if (value !== undefined && !/^[a-z][a-z0-9_.-]{0,79}$/.test(value)) {
    throw new ValidationError("type is invalid");
  }
}

function cursorPage<T extends { id: number }>(rows: T[]) {
  const hasMore = rows.length > 25;
  const entries = rows.slice(0, 25);
  return { entries, nextCursor: hasMore ? entries.at(-1)!.id : null, hasMore };
}

function assertPositiveId(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ValidationError(`${field} must be a positive integer`);
  }
}

function parsePositiveId(value: string, field: string) {
  if (!/^[1-9][0-9]*$/.test(value)) throw new ValidationError(`${field} must be a positive integer`);
  const parsed = Number(value);
  assertPositiveId(parsed, field);
  return parsed;
}

function decode<A, I>(schema: Schema.Schema<A, I>, value: unknown) {
  return Schema.decodeUnknown(schema)(value).pipe(
    Effect.mapError((error) => new ValidationError(String(error))),
  );
}

function databaseEffect<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({ try: operation, catch: (error) => error });
}

function postgresErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  if ("code" in error && typeof error.code === "string") return error.code;
  return "cause" in error ? postgresErrorCode(error.cause) : undefined;
}
