import { eq, ilike, or } from "drizzle-orm";
import { Effect, Schema } from "effect";
import type { Database } from "../../db/client.ts";
import { games } from "../../db/schema.ts";
import { ConflictError, NotFoundError, ValidationError } from "../shared/errors.ts";
import { parsePage } from "../shared/pagination.ts";

export const CreateGamePayload = Schema.Struct({
  slug: Schema.String.pipe(Schema.pattern(/^[a-z0-9-]+$/)),
  name: Schema.String.pipe(Schema.minLength(1)),
  shortName: Schema.String.pipe(Schema.minLength(1)),
  releaseYear: Schema.optional(Schema.Number),
  gameType: Schema.optional(Schema.Literal("zombies", "non_zombies")),
  studio: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
});

export type CreateGamePayload = typeof CreateGamePayload.Type;

const UpdateGamePayload = Schema.Struct({
  name: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  shortName: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  releaseYear: Schema.optional(Schema.NullOr(Schema.Number)),
  gameType: Schema.optional(Schema.Literal("zombies", "non_zombies")),
  studio: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  isActive: Schema.optional(Schema.Boolean),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
});

const PAGE_SIZE = 50;

export function listGames(db: Database, options: { page?: string; search?: string } = {}) {
  return Effect.tryPromise({
    try: async () => {
      const page = parsePage(options.page);
      const search = options.search?.trim() || undefined;
      const entries = await db.select().from(games).orderBy(games.releaseYear, games.name)
        .where(
          search
            ? or(
              ilike(games.name, `%${search}%`),
              ilike(games.shortName, `%${search}%`),
              ilike(games.slug, `%${search}%`),
            )
            : undefined,
        )
        .limit(PAGE_SIZE + 1).offset(page * PAGE_SIZE);
      return {
        search: search ?? null,
        page,
        pageSize: PAGE_SIZE,
        hasMore: entries.length > PAGE_SIZE,
        entries: entries.slice(0, PAGE_SIZE),
      };
    },
    catch: (error) => error,
  });
}

export function getGameBySlug(db: Database, slug: string) {
  return Effect.tryPromise({
    try: async () => {
      const [game] = await db.select().from(games).where(eq(games.slug, slug)).limit(1);

      if (!game) {
        throw new NotFoundError("game not found");
      }

      return game;
    },
    catch: (error) => error,
  });
}

export function createGame(db: Database, payload: unknown) {
  return Schema.decodeUnknown(CreateGamePayload)(payload).pipe(
    Effect.mapError((error) => new ValidationError(String(error))),
    Effect.flatMap((game) =>
      Effect.tryPromise({
        try: async () => {
          const existing = await db.select().from(games).where(eq(games.slug, game.slug)).limit(1);

          if (existing.length > 0) {
            throw new ConflictError("game slug already exists");
          }

          await db.insert(games).values({
            slug: game.slug,
            name: game.name,
            shortName: game.shortName,
            releaseYear: game.releaseYear,
            gameType: game.gameType ?? "zombies",
            studio: game.studio ?? "Unknown",
            metadata: game.metadata ?? {},
          });

          const [created] = await db.select().from(games).where(eq(games.slug, game.slug)).limit(1);

          return created;
        },
        catch: (error) => error,
      })
    ),
  );
}

export function updateGame(db: Database, gameId: number, payload: unknown) {
  return Schema.decodeUnknown(UpdateGamePayload)(payload).pipe(
    Effect.mapError((error) => new ValidationError(String(error))),
    Effect.flatMap((update) =>
      Effect.tryPromise({
        try: async () => {
          if (Object.values(update).every((value) => value === undefined)) {
            throw new ValidationError("no game fields provided");
          }
          const [game] = await db.update(games).set(update).where(eq(games.id, gameId)).returning();
          if (!game) throw new NotFoundError("game not found");
          return game;
        },
        catch: (error) => error,
      })
    ),
  );
}
