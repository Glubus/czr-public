import { and, eq } from "drizzle-orm";
import { Effect, Schema } from "effect";
import type { Database } from "../../db/client.ts";
import { games, mods, submissions } from "../../db/schema.ts";
import { ConflictError, NotFoundError, ValidationError } from "../shared/errors.ts";

const CreateModPayload = Schema.Struct({
  gameId: Schema.Number,
  slug: Schema.String.pipe(Schema.pattern(/^[a-z0-9-]+$/)),
  name: Schema.String.pipe(Schema.minLength(1)),
});
const UpdateModPayload = Schema.Struct({ name: Schema.optional(Schema.String.pipe(Schema.minLength(1))) });

export function createMod(db: Database, payload: unknown) {
  return Schema.decodeUnknown(CreateModPayload)(payload).pipe(
    Effect.mapError((error) => new ValidationError(String(error))),
    Effect.flatMap((mod) =>
      Effect.tryPromise({
        try: async () => {
          const [game] = await db.select({ id: games.id }).from(games).where(eq(games.id, mod.gameId)).limit(
            1,
          );
          if (!game) throw new NotFoundError("game not found");
          const [existing] = await db.select({ id: mods.id }).from(mods).where(
            and(eq(mods.gameId, mod.gameId), eq(mods.slug, mod.slug)),
          ).limit(1);
          if (existing) throw new ConflictError("mod slug already exists for this game");
          const [created] = await db.insert(mods).values(mod).returning();
          return created;
        },
        catch: (error) => error,
      })
    ),
  );
}

export function updateMod(db: Database, modId: number, payload: unknown) {
  return Schema.decodeUnknown(UpdateModPayload)(payload).pipe(
    Effect.mapError((error) => new ValidationError(String(error))),
    Effect.flatMap(({ name }) =>
      Effect.tryPromise({
        try: async () => {
          if (name === undefined) throw new ValidationError("no mod fields provided");
          const [updated] = await db.update(mods).set({ name }).where(eq(mods.id, modId)).returning();
          if (!updated) throw new NotFoundError("mod not found");
          return updated;
        },
        catch: (error) => error,
      })
    ),
  );
}

export function deleteMod(db: Database, modId: number) {
  return Effect.tryPromise({
    try: async () => {
      const [used] = await db.select({ id: submissions.id }).from(submissions).where(
        eq(submissions.modId, modId),
      ).limit(1);
      if (used) throw new ConflictError("a mod referenced by submissions cannot be deleted");
      const [deleted] = await db.delete(mods).where(eq(mods.id, modId)).returning();
      if (!deleted) throw new NotFoundError("mod not found");
      return deleted;
    },
    catch: (error) => error,
  });
}

export function listModsForGame(db: Database, gameSlug: string) {
  return Effect.tryPromise({
    try: async () => {
      const [game] = await db.select({ id: games.id }).from(games).where(eq(games.slug, gameSlug)).limit(1);
      if (!game) throw new NotFoundError("game not found");
      return db.select().from(mods).where(eq(mods.gameId, game.id)).orderBy(mods.name);
    },
    catch: (error) => error,
  });
}
