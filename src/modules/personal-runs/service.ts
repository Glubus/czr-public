import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { Effect, Schema } from "effect";
import type { Database } from "../../db/client.ts";
import {
  categories,
  categoryAssignments,
  follows,
  games,
  maps,
  personalRuns,
  submissionParticipants,
  submissions,
  users,
} from "../../db/schema.ts";
import { ConflictError, NotFoundError, ValidationError } from "../shared/errors.ts";
import { enqueueOutboxEvent } from "../social/outbox.ts";
import { isBetterRecord } from "../submissions/ranking.ts";
import { assertValidSubmissionValues, competitorKeyFor } from "../submissions/validation.ts";

const ProofLevel = Schema.Literal(
  "manual_video",
  "client_recorded",
  "client_recorded_with_inputs",
  "verified_client_package",
);
const Visibility = Schema.Literal("private", "followers", "public");
const CreatePersonalRun = Schema.Struct({
  gameId: Schema.Number,
  mapId: Schema.Number,
  categoryAssignmentId: Schema.Number,
  playerCount: Schema.optional(Schema.Number),
  scoreValue: Schema.Number,
  runDurationMs: Schema.optional(Schema.NullOr(Schema.Number)),
  proofLevel: Schema.optional(Schema.NullOr(ProofLevel)),
  proofUrl: Schema.optional(Schema.NullOr(Schema.String)),
  visibility: Schema.optional(Visibility),
  notes: Schema.optional(Schema.NullOr(Schema.String)),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
});
const UpdatePersonalRun = Schema.Struct({
  scoreValue: Schema.optional(Schema.Number),
  runDurationMs: Schema.optional(Schema.NullOr(Schema.Number)),
  proofLevel: Schema.optional(Schema.NullOr(ProofLevel)),
  proofUrl: Schema.optional(Schema.NullOr(Schema.String)),
  visibility: Schema.optional(Visibility),
  notes: Schema.optional(Schema.NullOr(Schema.String)),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
});

const PERSONAL_RUN_LIMIT = 1_000;
const PAGE_SIZE = 25;

export function createPersonalRun(db: Database, userId: string, payload: unknown) {
  return decode(CreatePersonalRun, payload).pipe(
    Effect.flatMap((decoded) =>
      databaseEffect(() =>
        db.transaction(async (transaction) => {
          const tx = transaction as unknown as Database;
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`personal-runs:${userId}`}))`);
          const [usage] = await tx.execute<{ count: number }>(sql`
        SELECT count(*)::int AS count FROM personal_runs WHERE user_id = ${userId}
      `);
          if ((usage?.count ?? 0) >= PERSONAL_RUN_LIMIT) {
            throw new ConflictError(`a user cannot store more than ${PERSONAL_RUN_LIMIT} personal runs`);
          }
          const target = await assertTargets(tx, decoded.gameId, decoded.mapId, decoded.categoryAssignmentId);
          const playerCount = decoded.playerCount ?? 1;
          assertPlayerCount(playerCount);
          assertValidSubmissionValues(decoded.scoreValue, decoded.runDurationMs);
          assertOptionalUrl(decoded.proofUrl);
          assertNotes(decoded.notes);
          const [created] = await tx.insert(personalRuns).values({
            userId,
            gameId: decoded.gameId,
            mapId: decoded.mapId,
            categoryAssignmentId: target.assignment.id,
            playerCount,
            scoreValue: decoded.scoreValue,
            runDurationMs: decoded.runDurationMs ?? null,
            proofLevel: decoded.proofLevel ?? null,
            proofUrl: decoded.proofUrl ?? null,
            visibility: decoded.visibility ?? "private",
            notes: decoded.notes?.trim() || null,
            metadata: decoded.metadata ?? {},
          }).returning();
          if (!created) throw new ConflictError("personal run could not be created");
          if (created.visibility !== "private") {
            await enqueueOutboxEvent(tx, {
              eventKey: `personal-run.created:${created.id}`,
              type: "personal_run.created",
              actorUserId: userId,
              subjects: [{ type: "user", id: userId }],
              payload: {
                personalRunId: created.id,
                gameId: created.gameId,
                mapId: created.mapId,
                categoryAssignmentId: created.categoryAssignmentId,
                playerCount: created.playerCount,
                scoreValue: created.scoreValue,
                visibility: created.visibility,
              },
            });
          }
          return (await hydratedRuns(tx, and(eq(personalRuns.id, created.id))))[0]!;
        })
      )
    ),
  );
}

export function updatePersonalRun(db: Database, userId: string, runId: number, payload: unknown) {
  return decode(UpdatePersonalRun, payload).pipe(
    Effect.flatMap((decoded) =>
      databaseEffect(() =>
        db.transaction(async (transaction) => {
          const tx = transaction as unknown as Database;
          assertPositiveId(runId, "runId");
          if (Object.values(decoded).every((value) => value === undefined)) {
            throw new ValidationError("at least one field must be provided");
          }
          const run = await lockOwnedRun(tx, userId, runId);
          if (run.promotedSubmissionId !== null) {
            throw new ConflictError("a promoted personal run is immutable");
          }
          const scoreValue = decoded.scoreValue ?? run.scoreValue;
          const runDurationMs = decoded.runDurationMs === undefined
            ? run.runDurationMs
            : decoded.runDurationMs;
          assertValidSubmissionValues(scoreValue, runDurationMs);
          assertOptionalUrl(decoded.proofUrl);
          assertNotes(decoded.notes);
          const [updated] = await tx.update(personalRuns).set({
            ...(decoded.scoreValue === undefined ? {} : { scoreValue: decoded.scoreValue }),
            ...(decoded.runDurationMs === undefined ? {} : { runDurationMs: decoded.runDurationMs }),
            ...(decoded.proofLevel === undefined ? {} : { proofLevel: decoded.proofLevel }),
            ...(decoded.proofUrl === undefined ? {} : { proofUrl: decoded.proofUrl }),
            ...(decoded.visibility === undefined ? {} : { visibility: decoded.visibility }),
            ...(decoded.notes === undefined ? {} : { notes: decoded.notes?.trim() || null }),
            ...(decoded.metadata === undefined ? {} : { metadata: decoded.metadata }),
            updatedAt: new Date(),
          }).where(eq(personalRuns.id, runId)).returning();
          return (await hydratedRuns(tx, and(eq(personalRuns.id, updated!.id))))[0]!;
        })
      )
    ),
  );
}

export function deletePersonalRun(db: Database, userId: string, runId: number) {
  return databaseEffect(() =>
    db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;
      assertPositiveId(runId, "runId");
      const run = await lockOwnedRun(tx, userId, runId);
      if (run.promotedSubmissionId !== null) throw new ConflictError("a promoted personal run is immutable");
      await tx.delete(personalRuns).where(eq(personalRuns.id, runId));
      return { removed: true };
    })
  );
}

export function listOwnPersonalRuns(db: Database, userId: string, cursor?: string) {
  return listVisiblePersonalRuns(db, userId, userId, cursor);
}

export function listUserPersonalRuns(
  db: Database,
  ownerUserId: string,
  requesterUserId?: string,
  cursor?: string,
) {
  return listVisiblePersonalRuns(db, ownerUserId, requesterUserId, cursor);
}

export function listPersonalBests(db: Database, userId: string) {
  return databaseEffect(async () => {
    const rows = await hydratedRuns(db, and(eq(personalRuns.userId, userId)));
    const bests = new Map<string, (typeof rows)[number]>();
    for (const run of rows) {
      const key = `${run.map.id}:${run.categoryAssignmentId}:${run.playerCount}`;
      const current = bests.get(key);
      if (
        !current || isBetterRecord(
          run.scoreValue,
          current.scoreValue,
          run.runDurationMs,
          current.runDurationMs,
          run.category.scoreType,
          run.category.rankingDirection,
        )
      ) bests.set(key, run);
    }
    return { entries: [...bests.values()].sort((left, right) => right.id - left.id) };
  });
}

export function promotePersonalRun(db: Database, userId: string, runId: number) {
  return databaseEffect(() =>
    db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;
      assertPositiveId(runId, "runId");
      const run = await lockOwnedRun(tx, userId, runId);
      if (run.promotedSubmissionId !== null) {
        throw new ConflictError("personal run has already been promoted");
      }
      if (!run.proofLevel || !run.proofUrl) {
        throw new ValidationError("proofLevel and proofUrl are required before requesting verification");
      }
      assertOptionalUrl(run.proofUrl);
      await assertActiveSubmissionCapacity(tx, userId);
      const target = await assertTargets(tx, run.gameId, run.mapId, run.categoryAssignmentId);
      const [submission] = await tx.insert(submissions).values({
        submissionGroupId: crypto.randomUUID(),
        userId,
        competitorKey: competitorKeyFor([userId]),
        gameId: run.gameId,
        mapId: run.mapId,
        categoryId: target.assignment.categoryId,
        categoryAssignmentId: run.categoryAssignmentId,
        playerCount: run.playerCount,
        scoreValue: run.scoreValue,
        runDurationMs: run.runDurationMs,
        status: "pending",
        proofLevel: run.proofLevel,
        proofUrl: run.proofUrl,
        submittedBy: userId,
        metadata: { ...run.metadata, personalRunId: run.id },
        rulesSnapshot: { global: target.category.rules, specific: target.assignment.specificRules },
      }).returning();
      if (!submission) throw new ConflictError("submission could not be created");
      await tx.insert(submissionParticipants).values({
        submissionId: submission.id,
        userId,
        role: "primary",
        status: "accepted",
        acceptanceSource: "submitter",
        respondedAt: new Date(),
      });
      const [promoted] = await tx.update(personalRuns).set({
        promotedSubmissionId: submission.id,
        promotedAt: new Date(),
        updatedAt: new Date(),
      }).where(and(eq(personalRuns.id, run.id), eq(personalRuns.userId, userId))).returning();
      const hydrated = (await hydratedRuns(tx, and(eq(personalRuns.id, promoted!.id))))[0]!;
      return { personalRun: hydrated, submission };
    })
  );
}

function listVisiblePersonalRuns(
  db: Database,
  ownerUserId: string,
  requesterUserId?: string,
  cursor?: string,
) {
  return databaseEffect(async () => {
    const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.id, ownerUserId)).limit(1);
    if (!owner) throw new NotFoundError("user not found");
    const parsedCursor = parseCursor(cursor);
    const isOwner = requesterUserId === ownerUserId;
    const isFollower = requesterUserId
      ? Boolean(
        (await db.select({ id: follows.id }).from(follows).where(and(
          eq(follows.followerUserId, requesterUserId),
          eq(follows.targetType, "user"),
          eq(follows.targetId, ownerUserId),
        )).limit(1))[0],
      )
      : false;
    const visibility = isOwner
      ? undefined
      : isFollower
      ? or(eq(personalRuns.visibility, "public"), eq(personalRuns.visibility, "followers"))
      : eq(personalRuns.visibility, "public");
    const rows = await hydratedRuns(
      db,
      and(
        eq(personalRuns.userId, ownerUserId),
        parsedCursor ? lt(personalRuns.id, parsedCursor) : undefined,
        visibility,
      ),
      PAGE_SIZE + 1,
    );
    const entries = rows.slice(0, PAGE_SIZE);
    return {
      entries,
      nextCursor: rows.length > PAGE_SIZE ? entries.at(-1)!.id : null,
      hasMore: rows.length > PAGE_SIZE,
    };
  });
}

function hydratedRuns(db: Database, where: ReturnType<typeof and>, limit?: number) {
  const query = db.select({
    id: personalRuns.id,
    userId: personalRuns.userId,
    categoryAssignmentId: personalRuns.categoryAssignmentId,
    playerCount: personalRuns.playerCount,
    scoreValue: personalRuns.scoreValue,
    runDurationMs: personalRuns.runDurationMs,
    proofLevel: personalRuns.proofLevel,
    proofUrl: personalRuns.proofUrl,
    visibility: personalRuns.visibility,
    notes: personalRuns.notes,
    metadata: personalRuns.metadata,
    promotedSubmissionId: personalRuns.promotedSubmissionId,
    promotedAt: personalRuns.promotedAt,
    createdAt: personalRuns.createdAt,
    updatedAt: personalRuns.updatedAt,
    game: { id: games.id, slug: games.slug, name: games.name },
    map: { id: maps.id, slug: maps.slug, name: maps.name, type: maps.type },
    category: {
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      scoreType: categories.scoreType,
      rankingDirection: categories.rankingDirection,
    },
  }).from(personalRuns)
    .innerJoin(games, eq(personalRuns.gameId, games.id))
    .innerJoin(maps, eq(personalRuns.mapId, maps.id))
    .innerJoin(categoryAssignments, eq(personalRuns.categoryAssignmentId, categoryAssignments.id))
    .innerJoin(categories, eq(categoryAssignments.categoryId, categories.id))
    .where(where).orderBy(desc(personalRuns.id));
  return limit === undefined ? query : query.limit(limit);
}

async function assertTargets(db: Database, gameId: number, mapId: number, assignmentId: number) {
  for (
    const [value, field] of [[gameId, "gameId"], [mapId, "mapId"], [
      assignmentId,
      "categoryAssignmentId",
    ]] as const
  ) {
    assertPositiveId(value, field);
  }
  const [map] = await db.select().from(maps).where(eq(maps.id, mapId)).limit(1);
  if (!map) throw new NotFoundError("map not found");
  const [assignment] = await db.select().from(categoryAssignments).where(
    eq(categoryAssignments.id, assignmentId),
  )
    .limit(1);
  if (!assignment) throw new NotFoundError("category assignment not found");
  if (
    map.gameId !== gameId || assignment.gameId !== gameId ||
    (assignment.mapId !== null && assignment.mapId !== mapId)
  ) {
    throw new ValidationError("category assignment does not apply to this game and map");
  }
  const [category] = await db.select().from(categories).where(eq(categories.id, assignment.categoryId)).limit(
    1,
  );
  if (!category) throw new NotFoundError("category not found");
  return { assignment, category };
}

async function lockOwnedRun(db: Database, userId: string, runId: number) {
  const [run] = await db.select().from(personalRuns).where(and(
    eq(personalRuns.id, runId),
    eq(personalRuns.userId, userId),
  )).for("update").limit(1);
  if (!run) throw new NotFoundError("personal run not found");
  return run;
}

async function assertActiveSubmissionCapacity(db: Database, userId: string) {
  await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`manual-submission:${userId}`}))`);
  const [usage] = await db.execute<{ count: number }>(sql`
    SELECT count(*)::int AS count FROM submissions
    WHERE submitted_by = ${userId} AND external_id IS NULL
      AND status IN ('awaiting_participants', 'pending')
  `);
  if ((usage?.count ?? 0) >= 5) {
    throw new ConflictError("a user cannot have more than five active submissions");
  }
}

function assertPlayerCount(value: number) {
  if (value !== 1) {
    throw new ValidationError("personal runs currently support solo play only");
  }
}

function assertOptionalUrl(value: string | null | undefined) {
  if (!value) return;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("unsupported protocol");
  } catch {
    throw new ValidationError("proofUrl must be an absolute HTTP(S) URL");
  }
}

function assertNotes(value: string | null | undefined) {
  if (value !== undefined && value !== null && value.length > 5_000) {
    throw new ValidationError("notes cannot exceed 5000 characters");
  }
}

function parseCursor(value?: string) {
  if (value === undefined) return undefined;
  if (!/^[1-9][0-9]*$/.test(value)) throw new ValidationError("cursor must be a positive integer");
  return Number(value);
}

function assertPositiveId(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ValidationError(`${field} must be a positive integer`);
  }
}

function decode<A, I>(schema: Schema.Schema<A, I>, value: unknown) {
  return Schema.decodeUnknown(schema)(value).pipe(
    Effect.mapError((error) => new ValidationError(String(error))),
  );
}

function databaseEffect<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({ try: operation, catch: (error) => error });
}
