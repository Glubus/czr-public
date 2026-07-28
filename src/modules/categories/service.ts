import { and, eq, isNull, or } from "drizzle-orm";
import { Effect, Schema } from "effect";
import type { Database } from "../../db/client.ts";
import { categories, categoryAssignments, games, maps, submissions } from "../../db/schema.ts";
import { ConflictError, NotFoundError, ValidationError } from "../shared/errors.ts";
import { parsePage } from "../shared/pagination.ts";

const ASSIGNMENT_PAGE_SIZE = 50;

const CreateCategoryPayload = Schema.Struct({
  slug: Schema.String.pipe(Schema.pattern(/^[a-z0-9-]+$/)),
  name: Schema.String.pipe(Schema.minLength(1)),
  scoreType: Schema.Literal("round", "time", "kills", "points", "custom"),
  rankingDirection: Schema.Literal("higher_is_better", "lower_is_better"),
  rules: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
});

const CreateCategoryAssignmentPayload = Schema.Struct({
  categoryId: Schema.Number,
  gameId: Schema.Number,
  mapId: Schema.optional(Schema.NullOr(Schema.Number)),
  specificRules: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
});

const UpdateCategoryPayload = Schema.Struct({
  name: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  rules: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
});

const UpdateCategoryAssignmentPayload = Schema.Struct({
  specificRules: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
});

export function createCategory(db: Database, payload: unknown) {
  return Schema.decodeUnknown(CreateCategoryPayload)(payload).pipe(
    Effect.mapError((error) => new ValidationError(String(error))),
    Effect.flatMap((category) =>
      Effect.tryPromise({
        try: async () => {
          const [existing] = await db.select().from(categories).where(eq(categories.slug, category.slug))
            .limit(1);
          if (existing) {
            throw new ConflictError("category slug already exists");
          }

          const [created] = await db.insert(categories).values({
            slug: category.slug,
            name: category.name,
            scoreType: category.scoreType,
            rankingDirection: category.rankingDirection,
            rules: category.rules ?? {},
          }).returning();

          return created;
        },
        catch: (error) => error,
      })
    ),
  );
}

export function createCategoryAssignment(db: Database, payload: unknown) {
  return Schema.decodeUnknown(CreateCategoryAssignmentPayload)(payload).pipe(
    Effect.mapError((error) => new ValidationError(String(error))),
    Effect.flatMap((assignment) =>
      Effect.tryPromise({
        try: async () => {
          const [category] = await db.select().from(categories).where(
            eq(categories.id, assignment.categoryId),
          ).limit(1);
          if (!category) {
            throw new NotFoundError("category not found");
          }

          const [game] = await db.select().from(games).where(eq(games.id, assignment.gameId)).limit(1);
          if (!game) {
            throw new NotFoundError("game not found");
          }

          if (assignment.mapId !== undefined && assignment.mapId !== null) {
            const [map] = await db.select().from(maps).where(eq(maps.id, assignment.mapId)).limit(1);
            if (!map) {
              throw new NotFoundError("map not found");
            }
            if (map.gameId !== assignment.gameId) {
              throw new ValidationError("map must belong to the assigned game");
            }
          }

          const existing = await db
            .select()
            .from(categoryAssignments)
            .where(
              and(
                eq(categoryAssignments.categoryId, assignment.categoryId),
                eq(categoryAssignments.gameId, assignment.gameId),
                assignment.mapId === undefined || assignment.mapId === null
                  ? isNull(categoryAssignments.mapId)
                  : eq(categoryAssignments.mapId, assignment.mapId),
              ),
            );
          if (
            existing.some((candidate) => sameJson(candidate.specificRules, assignment.specificRules ?? {}))
          ) {
            throw new ConflictError("category is already assigned to this target");
          }

          const [created] = await db.insert(categoryAssignments).values({
            categoryId: assignment.categoryId,
            gameId: assignment.gameId,
            mapId: assignment.mapId ?? null,
            specificRules: assignment.specificRules ?? {},
          }).returning();

          return { ...created, category };
        },
        catch: (error) => error,
      })
    ),
  );
}

export function listCategoryAssignments(
  db: Database,
  options: { page?: string; gameId?: string; mapId?: string } = {},
) {
  return Effect.tryPromise({
    try: async () => {
      const page = parsePage(options.page);
      const gameId = parseOptionalId(options.gameId, "gameId");
      const mapId = parseOptionalId(options.mapId, "mapId");
      const rows = await db
        .select({
          assignment: categoryAssignments,
          category: categories,
          game: { id: games.id, slug: games.slug, name: games.name },
          map: { id: maps.id, slug: maps.slug, name: maps.name },
        })
        .from(categoryAssignments)
        .innerJoin(categories, eq(categoryAssignments.categoryId, categories.id))
        .innerJoin(games, eq(categoryAssignments.gameId, games.id))
        .leftJoin(maps, eq(categoryAssignments.mapId, maps.id))
        .where(and(
          gameId === undefined ? undefined : eq(categoryAssignments.gameId, gameId),
          mapId === undefined ? undefined : eq(categoryAssignments.mapId, mapId),
        ))
        .orderBy(games.name, maps.name, categories.name, categoryAssignments.id)
        .limit(ASSIGNMENT_PAGE_SIZE + 1)
        .offset(page * ASSIGNMENT_PAGE_SIZE);

      return {
        page,
        pageSize: ASSIGNMENT_PAGE_SIZE,
        hasMore: rows.length > ASSIGNMENT_PAGE_SIZE,
        entries: rows.slice(0, ASSIGNMENT_PAGE_SIZE).map(({ assignment, category, game, map }) => ({
          ...assignment,
          category,
          game,
          map: assignment.mapId === null ? null : map,
        })),
      };
    },
    catch: (error) => error,
  });
}

export function updateCategory(db: Database, categoryId: number, payload: unknown) {
  return Schema.decodeUnknown(UpdateCategoryPayload)(payload).pipe(
    Effect.mapError((error) => new ValidationError(String(error))),
    Effect.flatMap((update) =>
      Effect.tryPromise({
        try: async () => {
          if (update.name === undefined && update.rules === undefined) {
            throw new ValidationError("at least one category field must be provided");
          }
          const [updated] = await db.update(categories).set({
            ...(update.name === undefined ? {} : { name: update.name }),
            ...(update.rules === undefined ? {} : { rules: update.rules }),
          }).where(eq(categories.id, categoryId)).returning();
          if (!updated) throw new NotFoundError("category not found");
          return updated;
        },
        catch: (error) => error,
      })
    ),
  );
}

export function updateCategoryAssignment(db: Database, assignmentId: number, payload: unknown) {
  return Schema.decodeUnknown(UpdateCategoryAssignmentPayload)(payload).pipe(
    Effect.mapError((error) => new ValidationError(String(error))),
    Effect.flatMap(({ specificRules }) =>
      Effect.tryPromise({
        try: async () => {
          const [updated] = await db.update(categoryAssignments).set({ specificRules }).where(
            eq(categoryAssignments.id, assignmentId),
          ).returning();
          if (!updated) throw new NotFoundError("category assignment not found");
          return updated;
        },
        catch: (error) => error,
      })
    ),
  );
}

export function deleteCategoryAssignment(db: Database, assignmentId: number) {
  return Effect.tryPromise({
    try: async () => {
      const [used] = await db.select({ id: submissions.id }).from(submissions).where(
        eq(submissions.categoryAssignmentId, assignmentId),
      ).limit(1);
      if (used) throw new ConflictError("an assignment referenced by submissions cannot be deleted");
      const [deleted] = await db.delete(categoryAssignments).where(eq(categoryAssignments.id, assignmentId))
        .returning();
      if (!deleted) throw new NotFoundError("category assignment not found");
      return deleted;
    },
    catch: (error) => error,
  });
}

export function deleteCategory(db: Database, categoryId: number) {
  return Effect.tryPromise({
    try: async () => {
      const [used] = await db.select({ id: submissions.id }).from(submissions).where(
        eq(submissions.categoryId, categoryId),
      ).limit(1);
      if (used) throw new ConflictError("a category referenced by submissions cannot be deleted");
      const [assignment] = await db.select({ id: categoryAssignments.id }).from(categoryAssignments).where(
        eq(categoryAssignments.categoryId, categoryId),
      ).limit(1);
      if (assignment) throw new ConflictError("delete category assignments before deleting the category");
      const [deleted] = await db.delete(categories).where(eq(categories.id, categoryId)).returning();
      if (!deleted) throw new NotFoundError("category not found");
      return deleted;
    },
    catch: (error) => error,
  });
}

export function listCategoriesForMap(db: Database, mapId: number) {
  return Effect.tryPromise({
    try: async () => {
      const [map] = await db.select().from(maps).where(eq(maps.id, mapId)).limit(1);
      if (!map) {
        throw new NotFoundError("map not found");
      }

      const rows = await db
        .select({ category: categories, assignment: categoryAssignments })
        .from(categoryAssignments)
        .innerJoin(categories, eq(categoryAssignments.categoryId, categories.id))
        .where(
          and(
            eq(categoryAssignments.gameId, map.gameId),
            or(isNull(categoryAssignments.mapId), eq(categoryAssignments.mapId, map.id)),
          ),
        )
        .orderBy(categories.name);

      const resolved = new Map<number, (typeof rows)[number][]>();
      for (const row of rows) {
        const current = resolved.get(row.category.id) ?? [];
        resolved.set(row.category.id, [...current, row]);
      }

      return [...resolved.values()].flatMap((assignments) => {
        const mapSpecific = assignments.filter((entry) => entry.assignment.mapId === map.id);
        return mapSpecific.length > 0 ? mapSpecific : assignments;
      })
        .map(({ category, assignment }) => ({
          ...category,
          assignmentId: assignment.id,
          globalRules: category.rules,
          specificRules: assignment.specificRules,
        }))
        .sort((left, right) => left.name.localeCompare(right.name));
    },
    catch: (error) => error,
  });
}

export function listCategories(db: Database) {
  return Effect.tryPromise({
    try: () =>
      db.select({
        id: categories.id,
        slug: categories.slug,
        name: categories.name,
        scoreType: categories.scoreType,
        rankingDirection: categories.rankingDirection,
      }).from(categories).orderBy(categories.name),
    catch: (error) => error,
  });
}

export function listCategoryDefinitions(db: Database) {
  return Effect.tryPromise({
    try: () => db.select().from(categories).orderBy(categories.name),
    catch: (error) => error,
  });
}

function sameJson(left: Record<string, unknown>, right: Record<string, unknown>) {
  return stableJson(left) === stableJson(right);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
        .join(",")
    }}`;
  }
  return JSON.stringify(value);
}

function parseOptionalId(value: string | undefined, name: string) {
  if (value === undefined || value === "") return undefined;
  if (!/^[1-9][0-9]*$/.test(value)) throw new ValidationError(`${name} must be a positive integer`);
  const id = Number(value);
  if (!Number.isSafeInteger(id)) throw new ValidationError(`${name} must be a positive integer`);
  return id;
}
