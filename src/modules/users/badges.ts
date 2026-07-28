import { and, asc, eq } from "drizzle-orm";
import { Effect, Schema } from "effect";
import type { Database } from "../../db/client.ts";
import { badgeDefinitions, userBadges, users } from "../../db/schema.ts";
import { ConflictError, NotFoundError, ValidationError } from "../shared/errors.ts";

const BadgePayload = Schema.Struct({
  slug: Schema.String.pipe(
    Schema.minLength(2),
    Schema.maxLength(40),
    Schema.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  ),
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(60)),
  description: Schema.optional(Schema.String.pipe(Schema.maxLength(240))),
  color: Schema.optional(Schema.String.pipe(Schema.pattern(/^#[0-9a-fA-F]{6}$/))),
  icon: Schema.optional(Schema.NullOr(Schema.String.pipe(Schema.maxLength(40)))),
});

export function listBadgeDefinitions(db: Database) {
  return Effect.tryPromise({
    try: () => db.select().from(badgeDefinitions).orderBy(asc(badgeDefinitions.name)),
    catch: (error) => error,
  });
}

export function listUserBadges(db: Database, userId: string) {
  return Effect.tryPromise({
    try: async () => {
      const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
      if (!user) throw new NotFoundError("user not found");
      return db.select({
        id: badgeDefinitions.id,
        slug: badgeDefinitions.slug,
        name: badgeDefinitions.name,
        description: badgeDefinitions.description,
        color: badgeDefinitions.color,
        icon: badgeDefinitions.icon,
        system: badgeDefinitions.system,
        awardedAt: userBadges.awardedAt,
      }).from(userBadges).innerJoin(
        badgeDefinitions,
        eq(userBadges.badgeId, badgeDefinitions.id),
      ).where(eq(userBadges.userId, userId)).orderBy(asc(badgeDefinitions.name));
    },
    catch: (error) => error,
  });
}

export function createBadgeDefinition(db: Database, payload: unknown) {
  return Schema.decodeUnknown(BadgePayload)(payload).pipe(
    Effect.mapError((error) => new ValidationError(String(error))),
    Effect.flatMap((decoded) =>
      Effect.tryPromise({
        try: async () => {
          const [created] = await db.insert(badgeDefinitions).values({
            slug: decoded.slug,
            name: decoded.name.trim(),
            description: decoded.description?.trim() ?? "",
            color: decoded.color?.toLowerCase() ?? "#e45735",
            icon: decoded.icon?.trim() || null,
          }).onConflictDoNothing({ target: badgeDefinitions.slug }).returning();
          if (!created) throw new ConflictError("a badge with this slug already exists");
          return created;
        },
        catch: (error) => error,
      })
    ),
  );
}

export function assignUserBadge(
  db: Database,
  userId: string,
  badgeId: number,
  awardedBy: string,
) {
  return Effect.tryPromise({
    try: async () => {
      if (!Number.isSafeInteger(badgeId) || badgeId <= 0) {
        throw new ValidationError("badge id must be a positive integer");
      }
      const [user, badge] = await Promise.all([
        db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1),
        db.select({ id: badgeDefinitions.id }).from(badgeDefinitions)
          .where(eq(badgeDefinitions.id, badgeId)).limit(1),
      ]);
      if (!user[0]) throw new NotFoundError("user not found");
      if (!badge[0]) throw new NotFoundError("badge not found");
      await db.insert(userBadges).values({ userId, badgeId, awardedBy })
        .onConflictDoNothing({ target: [userBadges.userId, userBadges.badgeId] });
      return listUserBadges(db, userId).pipe(Effect.runPromise);
    },
    catch: (error) => error,
  });
}

export function removeUserBadge(db: Database, userId: string, badgeId: number) {
  return Effect.tryPromise({
    try: async () => {
      if (!Number.isSafeInteger(badgeId) || badgeId <= 0) {
        throw new ValidationError("badge id must be a positive integer");
      }
      await db.delete(userBadges).where(and(
        eq(userBadges.userId, userId),
        eq(userBadges.badgeId, badgeId),
      ));
      return { removed: true };
    },
    catch: (error) => error,
  });
}
