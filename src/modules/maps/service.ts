import { and, eq, ilike, sql } from "drizzle-orm";
import { Effect, Schema } from "effect";
import type { Database } from "../../db/client.ts";
import { games, maps, mapSources } from "../../db/schema.ts";
import { ConflictError, NotFoundError, ValidationError } from "../shared/errors.ts";
import { parsePage } from "../shared/pagination.ts";

const SourcePayload = Schema.Struct({
  source: Schema.Literal("steam", "ugx", "manual", "other"),
  sourceUrl: Schema.String.pipe(Schema.minLength(1)),
  externalId: Schema.optional(Schema.NullOr(Schema.String)),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
});

const CreateMapPayload = Schema.Struct({
  gameId: Schema.Number,
  slug: Schema.String.pipe(Schema.pattern(/^[a-z0-9-]+$/)),
  name: Schema.String.pipe(Schema.minLength(1)),
  type: Schema.Literal("official", "custom", "uem"),
  status: Schema.optional(Schema.Literal("draft", "published", "archived")),
  thumbnailUrl: Schema.optional(Schema.NullOr(Schema.String)),
  description: Schema.optional(Schema.NullOr(Schema.String)),
  authors: Schema.optional(Schema.Array(Schema.String)),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  sources: Schema.optional(Schema.Array(SourcePayload)),
});

const UpdateMapStatusPayload = Schema.Struct({
  status: Schema.Literal("draft", "published", "archived"),
});
const UpdateMapPayload = Schema.Struct({
  name: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  description: Schema.optional(Schema.NullOr(Schema.String)),
  thumbnailUrl: Schema.optional(Schema.NullOr(Schema.String)),
  authors: Schema.optional(Schema.Array(Schema.String)),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  status: Schema.optional(Schema.Literal("draft", "published", "archived")),
  sources: Schema.optional(Schema.Array(SourcePayload)),
});

export function createMap(db: Database, payload: unknown) {
  return Schema.decodeUnknown(CreateMapPayload)(payload).pipe(
    Effect.mapError((error) => new ValidationError(String(error))),
    Effect.flatMap((map) =>
      Effect.tryPromise({
        try: async () => {
          const [game] = await db.select().from(games).where(eq(games.id, map.gameId)).limit(1);

          if (!game) {
            throw new NotFoundError("game not found");
          }

          const existing = await db
            .select()
            .from(maps)
            .where(and(eq(maps.gameId, map.gameId), eq(maps.slug, map.slug)))
            .limit(1);

          if (existing.length > 0) {
            throw new ConflictError("map slug already exists for this game");
          }

          await db.execute(sql`
            INSERT INTO maps (
              game_id,
              slug,
              name,
              type,
              status,
              thumbnail_url,
              description,
              authors,
              metadata
            ) VALUES (
              ${map.gameId},
              ${map.slug},
              ${map.name},
              ${map.type},
              ${map.status ?? "draft"},
              ${map.thumbnailUrl ?? null},
              ${map.description ?? null},
              ${JSON.stringify(map.authors ?? [])},
              ${JSON.stringify(map.metadata ?? {})}
            )
          `);

          const [created] = await db
            .select()
            .from(maps)
            .where(and(eq(maps.gameId, map.gameId), eq(maps.slug, map.slug)))
            .limit(1);

          if (!created) {
            throw new Error("created map could not be loaded");
          }

          if (map.sources && map.sources.length > 0) {
            for (const source of map.sources) {
              await db.execute(sql`
                INSERT INTO map_sources (map_id, source, source_url, external_id, metadata)
                VALUES (
                  ${created.id},
                  ${source.source},
                  ${source.sourceUrl},
                  ${source.externalId ?? null},
                  ${JSON.stringify(source.metadata ?? {})}
                )
              `);
            }
          }

          return getMapWithSources(db, created.id);
        },
        catch: (error) => error,
      })
    ),
  );
}

export function listMaps(
  db: Database,
  options: { name?: string; search?: string; game?: string; page?: string } = {},
) {
  return Effect.tryPromise({
    try: async () => {
      const page = parsePage(options.page);
      const name = options.name?.trim();
      const search = options.search?.trim();
      const game = options.game?.trim();
      const filters = [
        name ? ilike(maps.name, `%${name}%`) : undefined,
        search
          ? sql`(${maps.name} ILIKE ${`%${search}%`} OR ${maps.slug} ILIKE ${`%${search}%`} OR ${games.name} ILIKE ${`%${search}%`} OR ${games.slug} ILIKE ${`%${search}%`})`
          : undefined,
        game ? eq(games.slug, game) : undefined,
      ];

      const rows = await db
        .select({ map: maps, game: { id: games.id, slug: games.slug, name: games.name } })
        .from(maps)
        .innerJoin(games, eq(maps.gameId, games.id))
        .where(and(...filters))
        .orderBy(maps.name)
        .limit(51)
        .offset(page * 50);
      const entries = rows.map(({ map, game: mapGame }) => ({ ...map, game: mapGame }));
      return {
        search: search ?? name ?? null,
        game: game ?? null,
        page,
        pageSize: 50,
        hasMore: entries.length > 50,
        entries: entries.slice(0, 50),
      };
    },
    catch: (error) => error,
  });
}

export function getMapById(db: Database, mapId: number) {
  return Effect.tryPromise({
    try: () => getMapWithSources(db, mapId),
    catch: (error) => error,
  });
}

export function updateMapStatus(db: Database, mapId: number, payload: unknown) {
  return Schema.decodeUnknown(UpdateMapStatusPayload)(payload).pipe(
    Effect.mapError((error) => new ValidationError(String(error))),
    Effect.flatMap(({ status }) =>
      Effect.tryPromise({
        try: async () => {
          const [updated] = await db.update(maps).set({ status }).where(eq(maps.id, mapId)).returning();
          if (!updated) throw new NotFoundError("map not found");
          return getMapWithSources(db, updated.id);
        },
        catch: (error) => error,
      })
    ),
  );
}

export function updateMap(db: Database, mapId: number, payload: unknown) {
  return Schema.decodeUnknown(UpdateMapPayload)(payload).pipe(
    Effect.mapError((error) => new ValidationError(String(error))),
    Effect.flatMap((update) =>
      Effect.tryPromise({
        try: async () => {
          const { sources, authors, ...fields } = update;
          if (Object.values(fields).every((value) => value === undefined) && sources === undefined) {
            throw new ValidationError("no map fields provided");
          }
          const [map] = await db.update(maps).set({
            ...fields,
            ...(authors === undefined ? {} : { authors: [...authors] }),
          }).where(eq(maps.id, mapId)).returning();
          if (!map) throw new NotFoundError("map not found");
          if (sources !== undefined) {
            await db.delete(mapSources).where(eq(mapSources.mapId, mapId));
            if (sources.length > 0) {
              await db.insert(mapSources).values(sources.map((source) => ({
                mapId,
                source: source.source,
                sourceUrl: source.sourceUrl,
                externalId: source.externalId ?? null,
                metadata: source.metadata ?? {},
              })));
            }
          }
          return getMapWithSources(db, mapId);
        },
        catch: (error) => error,
      })
    ),
  );
}

async function getMapWithSources(db: Database, mapId: number) {
  const [map] = await db.select().from(maps).where(eq(maps.id, mapId)).limit(1);

  if (!map) {
    throw new NotFoundError("map not found");
  }

  const sources = await db.select().from(mapSources).where(eq(mapSources.mapId, mapId));

  return {
    ...map,
    sources,
  };
}
