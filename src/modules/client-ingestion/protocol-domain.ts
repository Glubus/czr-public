import { Effect, Schema } from "effect";
import { clientInstallations, clientRunChunks, clientRuns } from "../../db/schema.ts";
import { ConflictError, ValidationError } from "../shared/errors.ts";
import { Chunk, FinalizeRun, Heartbeat, PROTOCOL_VERSION, StartRun } from "./protocol-contracts.ts";
import {
  assertNonNegativeInteger,
  assertPositiveInteger,
  assertRecentDate,
  assertRunToken,
  assertSha256,
  assertShortIdentifier,
  assertUuid,
  MAX_CHUNK_GAME_DURATION_MS,
} from "./protocol-validation.ts";

export function validateStart(value: typeof StartRun.Type, userId: string) {
  assertUuid(value.runId, "runId");
  assertRunToken(value.runToken);
  assertUuid(value.installationId, "installationId");
  assertShortIdentifier(value.clientName, "clientName");
  assertShortIdentifier(value.clientVersion, "clientVersion");
  if (value.protocolVersion !== PROTOCOL_VERSION) {
    throw new ValidationError(`protocolVersion must be ${PROTOCOL_VERSION}`);
  }
  assertPositiveInteger(value.gameId, "gameId");
  assertPositiveInteger(value.mapId, "mapId");
  if (value.participantUserIds && !value.participantUserIds.includes(userId)) {
    throw new ValidationError("the run owner must be a participant");
  }
}

export function validateHeartbeat(value: typeof Heartbeat.Type) {
  assertRunToken(value.runToken);
  assertPositiveInteger(value.sequence, "sequence");
  assertNonNegativeInteger(value.gameElapsedMs, "gameElapsedMs");
  if (value.round !== null && value.round !== undefined) assertPositiveInteger(value.round, "round");
  assertRecentDate(value.observedAt, "observedAt", 24 * 60 * 60 * 1_000);
}

export function validateChunkEnvelope(value: typeof Chunk.Type) {
  assertRunToken(value.runToken);
  assertPositiveInteger(value.sequence, "sequence");
  assertNonNegativeInteger(value.startElapsedMs, "startElapsedMs");
  assertPositiveInteger(value.endElapsedMs, "endElapsedMs");
  if (value.endElapsedMs <= value.startElapsedMs) {
    throw new ValidationError("chunk duration must be positive");
  }
  if (value.endElapsedMs - value.startElapsedMs > MAX_CHUNK_GAME_DURATION_MS) {
    throw new ValidationError("one chunk cannot cover more than 35 minutes of game time");
  }
  assertSha256(value.compressedSha256, "compressedSha256");
  assertSha256(value.uncompressedSha256, "uncompressedSha256");
  if (value.previousChunkSha256) assertSha256(value.previousChunkSha256, "previousChunkSha256");
}

export function validateFinalization(value: typeof FinalizeRun.Type) {
  assertRunToken(value.runToken);
  assertNonNegativeInteger(value.finalState.gameElapsedMs, "finalState.gameElapsedMs");
  if (value.finalState.round !== null && value.finalState.round !== undefined) {
    assertPositiveInteger(value.finalState.round, "finalState.round");
  }
  assertRecentDate(value.finalState.endedAt, "finalState.endedAt", 30 * 24 * 60 * 60 * 1_000);
  if (value.entries.length < 1 || value.entries.length > 5) {
    throw new ValidationError("entries must contain between one and five submissions");
  }
  if (new Set(value.entries.map((entry) => entry.categoryAssignmentId)).size !== value.entries.length) {
    throw new ValidationError("category assignments must be unique within a run");
  }
}

export function assertActive(run: typeof clientRuns.$inferSelect) {
  if (run.status !== "active") throw new ConflictError(`run is ${run.status}`);
}

export function runView(run: typeof clientRuns.$inferSelect) {
  const { runTokenHash: _runTokenHash, finalizationPayload: _finalizationPayload, ...safe } = run;
  return safe;
}

export function installationView(row: typeof clientInstallations.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    revokedAt: row.revokedAt,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
  };
}

export function chunkView(chunk: typeof clientRunChunks.$inferSelect) {
  const { signature: _signature, ...manifest } = chunk;
  return manifest;
}

export function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "run finalization failed";
}

export function decode<A, I>(schema: Schema.Schema<A, I>, value: unknown) {
  return Schema.decodeUnknown(schema)(value).pipe(
    Effect.mapError((error) => new ValidationError(String(error))),
  );
}

export function databaseEffect<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({ try: operation, catch: (error) => error });
}
