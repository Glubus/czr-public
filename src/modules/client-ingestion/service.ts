import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Effect } from "effect";
import type { Database } from "../../db/client.ts";
import {
  type BlobStore,
  clientChunkStorageKey,
  clientManifestStorageKey,
  clientRunPrefix,
} from "../../infra/blob-store.ts";
import {
  bestRecords,
  categories,
  categoryAssignments,
  clientInstallations,
  clientRunChunks,
  clientRuns,
  clientVersions,
  games,
  maps,
  mods,
  submissions,
  users,
} from "../../db/schema.ts";
import { ConflictError, NotFoundError, RateLimitError, ValidationError } from "../shared/errors.ts";
import { persistSubmissions } from "../submissions/commands.ts";
import { isBetterRecord } from "../submissions/ranking.ts";
import { competitorKeyFor } from "../submissions/validation.ts";
import {
  assertSignature,
  canonicalJson,
  decodeBase64,
  importPublicKey,
  randomBase64Url,
  sha256Hex,
  timingSafeEqual,
  withoutRunToken,
  withoutSignature,
} from "./protocol-crypto.ts";
import {
  assertPositiveInteger,
  assertRunToken,
  assertShortIdentifier,
  assertUuid,
  decompressGzip,
  MAX_COMPRESSED_CHUNK_BYTES,
  validateEventPayload,
} from "./protocol-validation.ts";
import {
  AbandonRun,
  Chunk,
  ChunkUnsigned,
  FinalizeRun,
  Heartbeat,
  HEARTBEAT_GAP_MS,
  PROTOCOL_VERSION,
  RecoverRun,
  RegisterInstallation,
  RegisterVersion,
  RUN_START_LIMIT_PER_HOUR,
  StartRun,
  SubmissionEntry,
  UpdateVersion,
} from "./protocol-contracts.ts";
import {
  assertActive,
  chunkView,
  databaseEffect,
  decode,
  errorMessage,
  installationView,
  isUniqueViolation,
  runView,
  validateChunkEnvelope,
  validateFinalization,
  validateHeartbeat,
  validateStart,
} from "./protocol-domain.ts";

export function registerClientVersion(db: Database, payload: unknown) {
  return decode(RegisterVersion, payload).pipe(Effect.flatMap((value) =>
    databaseEffect(async () => {
      assertShortIdentifier(value.clientName, "clientName");
      assertShortIdentifier(value.version, "version");
      if (value.protocolVersion !== PROTOCOL_VERSION) {
        throw new ValidationError(`protocolVersion must be ${PROTOCOL_VERSION}`);
      }
      try {
        const [created] = await db.insert(clientVersions).values({
          clientName: value.clientName,
          version: value.version,
          protocolVersion: value.protocolVersion,
          releaseNotes: value.releaseNotes?.trim() || null,
        }).returning();
        return created!;
      } catch (error) {
        if (isUniqueViolation(error)) throw new ConflictError("client version already exists");
        throw error;
      }
    })
  ));
}

export function updateClientVersion(db: Database, versionId: number, payload: unknown) {
  return decode(UpdateVersion, payload).pipe(Effect.flatMap((value) =>
    databaseEffect(async () => {
      assertPositiveInteger(versionId, "versionId");
      const [updated] = await db.update(clientVersions).set({ status: value.status, updatedAt: new Date() })
        .where(eq(clientVersions.id, versionId)).returning();
      if (!updated) throw new NotFoundError("client version not found");
      return updated;
    })
  ));
}

export function listClientVersions(db: Database) {
  return databaseEffect(() => db.select().from(clientVersions).orderBy(desc(clientVersions.id)));
}

export function registerInstallation(db: Database, userId: string, payload: unknown) {
  return decode(RegisterInstallation, payload).pipe(Effect.flatMap((value) =>
    databaseEffect(async () => {
      const name = value.name.trim();
      if (name.length < 1 || name.length > 100) {
        throw new ValidationError("name must contain 1 to 100 characters");
      }
      await importPublicKey(value.publicKeySpki);
      const [created] = await db.insert(clientInstallations).values({
        id: crypto.randomUUID(),
        userId,
        name,
        publicKeySpki: value.publicKeySpki,
      }).returning();
      return installationView(created!);
    })
  ));
}

export function listInstallations(db: Database, userId: string) {
  return databaseEffect(async () => {
    const rows = await db.select().from(clientInstallations).where(eq(clientInstallations.userId, userId))
      .orderBy(desc(clientInstallations.createdAt));
    return rows.map(installationView);
  });
}

export function revokeInstallation(db: Database, userId: string, installationId: string) {
  return databaseEffect(async () => {
    const [updated] = await db.update(clientInstallations).set({
      revokedAt: new Date(),
      updatedAt: new Date(),
    })
      .where(and(eq(clientInstallations.id, installationId), eq(clientInstallations.userId, userId)))
      .returning({ id: clientInstallations.id, revokedAt: clientInstallations.revokedAt });
    if (!updated) throw new NotFoundError("client installation not found");
    return updated;
  });
}

export function startClientRun(db: Database, userId: string, payload: unknown) {
  return decode(StartRun, payload).pipe(
    Effect.flatMap((decoded) =>
      databaseEffect(() =>
        db.transaction(async (transaction) => {
          const tx = transaction as unknown as Database;
          validateStart(decoded, userId);
          const unsigned = withoutSignature(decoded);
          const startPayloadSha256 = await sha256Hex(canonicalJson(unsigned));
          const installation = await ownedInstallation(tx, userId, decoded.installationId);
          await assertSignature(
            installation.publicKeySpki,
            decoded.signature,
            clientRunSigningMessage("start", decoded.runId, decoded.runToken, unsigned),
          );
          const [existing] = await tx.select().from(clientRuns).where(eq(clientRuns.id, decoded.runId)).for(
            "update",
          )
            .limit(1);
          if (existing) {
            if (
              existing.userId !== userId || existing.startPayloadSha256 !== startPayloadSha256 ||
              !timingSafeEqual(existing.runTokenHash, await sha256Hex(decoded.runToken))
            ) throw new ConflictError("runId is already bound to another run");
            return { run: runView(existing), idempotentReplay: true };
          }
          if (installation.revokedAt) throw new ConflictError("client installation is revoked");
          const version = await allowedVersion(
            tx,
            decoded.clientName,
            decoded.clientVersion,
            decoded.protocolVersion,
          );
          await enforceRunStartLimit(tx, userId);
          await validateRunTarget(tx, decoded, userId);
          const participantUserIds = [...new Set(decoded.participantUserIds ?? [userId])];
          const [created] = await tx.insert(clientRuns).values({
            id: decoded.runId,
            userId,
            installationId: installation.id,
            clientVersionId: version.id,
            gameId: decoded.gameId,
            mapId: decoded.mapId,
            platform: decoded.platform ?? null,
            gameVersion: decoded.gameVersion ?? null,
            mapVersion: decoded.mapVersion ?? null,
            modId: decoded.modId ?? null,
            modVersion: decoded.modVersion ?? null,
            participantUserIds,
            runTokenHash: await sha256Hex(decoded.runToken),
            startPayloadSha256,
          }).returning();
          await tx.update(clientInstallations).set({ lastUsedAt: new Date(), updatedAt: new Date() }).where(
            eq(clientInstallations.id, installation.id),
          );
          return { run: runView(created!), idempotentReplay: false };
        })
      )
    ),
  );
}

export function heartbeatClientRun(db: Database, userId: string, runId: string, payload: unknown) {
  return decode(Heartbeat, payload).pipe(
    Effect.flatMap((decoded) =>
      databaseEffect(() =>
        db.transaction(async (transaction) => {
          const tx = transaction as unknown as Database;
          validateHeartbeat(decoded);
          const run = await lockedOwnedRun(tx, userId, runId);
          await authorizeRunMessage(
            tx,
            run,
            decoded.runToken,
            decoded.signature,
            "heartbeat",
            withoutSignature(decoded),
          );
          assertActive(run);
          if (decoded.sequence === run.latestHeartbeatSequence) {
            if (decoded.gameElapsedMs !== run.latestGameElapsedMs || decoded.round !== run.latestRound) {
              throw new ConflictError("heartbeat sequence is already bound to another state");
            }
            return { run: runView(run), idempotentReplay: true };
          }
          if (decoded.sequence < run.latestHeartbeatSequence) {
            throw new ConflictError("heartbeat sequence regressed");
          }
          if (decoded.gameElapsedMs < run.latestGameElapsedMs) {
            throw new ConflictError("game duration regressed");
          }
          const now = new Date();
          const gapMs = run.lastHeartbeatAt ? now.getTime() - run.lastHeartbeatAt.getTime() : 0;
          const sequenceGap = Math.max(0, decoded.sequence - run.latestHeartbeatSequence - 1);
          const gameTimeGapMs = decoded.gameElapsedMs - run.latestGameElapsedMs;
          const [updated] = await tx.update(clientRuns).set({
            latestHeartbeatSequence: decoded.sequence,
            latestGameElapsedMs: decoded.gameElapsedMs,
            latestRound: decoded.round ?? null,
            lastHeartbeatAt: now,
            heartbeatGapCount: run.heartbeatGapCount + sequenceGap +
              (sequenceGap === 0 && gapMs > HEARTBEAT_GAP_MS ? 1 : 0),
            maxHeartbeatGapMs: Math.max(
              run.maxHeartbeatGapMs,
              gapMs,
              sequenceGap > 0 ? gameTimeGapMs : 0,
            ),
            updatedAt: now,
          }).where(eq(clientRuns.id, runId)).returning();
          return { run: runView(updated!), idempotentReplay: false };
        })
      )
    ),
  );
}

export function appendClientRunChunk(
  db: Database,
  blobStore: BlobStore,
  userId: string,
  runId: string,
  payload: unknown,
) {
  return decode(Chunk, payload).pipe(Effect.flatMap((decoded) =>
    databaseEffect(async () => {
      validateChunkEnvelope(decoded);
      const compressed = decodeBase64(decoded.compressedDataBase64);
      if (compressed.byteLength > MAX_COMPRESSED_CHUNK_BYTES) {
        throw new ValidationError("compressed chunk exceeds 8 MiB");
      }
      if (!timingSafeEqual(await sha256Hex(compressed), decoded.compressedSha256)) {
        throw new ValidationError("compressed chunk hash does not match its payload");
      }
      const uncompressed = await decompressGzip(compressed);
      if (!timingSafeEqual(await sha256Hex(uncompressed), decoded.uncompressedSha256)) {
        throw new ValidationError("uncompressed chunk hash does not match its payload");
      }
      const eventCount = validateEventPayload(uncompressed);
      return await db.transaction(async (transaction) => {
        const tx = transaction as unknown as Database;
        const run = await lockedOwnedRun(tx, userId, runId);
        await authorizeRunMessage(
          tx,
          run,
          decoded.runToken,
          decoded.signature,
          "chunk",
          chunkSigningFields(decoded),
        );
        assertActive(run);
        const [existing] = await tx.select().from(clientRunChunks).where(and(
          eq(clientRunChunks.runId, runId),
          eq(clientRunChunks.sequence, decoded.sequence),
        )).limit(1);
        if (existing) {
          if (existing.compressedSha256 !== decoded.compressedSha256) {
            throw new ConflictError("chunk sequence is already bound to another payload");
          }
          return { chunk: chunkView(existing), run: runView(run), idempotentReplay: true };
        }
        if (decoded.sequence !== run.latestChunkSequence + 1) {
          throw new ConflictError("chunk sequence must immediately follow the previous chunk");
        }
        if (decoded.startElapsedMs !== run.latestChunkEndElapsedMs) {
          throw new ConflictError("chunk timeline must begin where the previous chunk ended");
        }
        if ((decoded.previousChunkSha256 ?? null) !== run.chunkChainHeadSha256) {
          throw new ConflictError("previous chunk hash does not match the run chain head");
        }
        const storageKey = clientChunkStorageKey(runId, decoded.sequence, decoded.compressedSha256);
        await blobStore.put(storageKey, compressed);
        const [created] = await tx.insert(clientRunChunks).values({
          runId,
          sequence: decoded.sequence,
          startElapsedMs: decoded.startElapsedMs,
          endElapsedMs: decoded.endElapsedMs,
          previousChunkSha256: decoded.previousChunkSha256 ?? null,
          compressedSha256: decoded.compressedSha256,
          uncompressedSha256: decoded.uncompressedSha256,
          compression: decoded.compression,
          payloadFormat: decoded.payloadFormat,
          storageKey,
          uncompressedBytes: uncompressed.byteLength,
          eventCount,
          signature: decoded.signature,
        }).returning();
        const [updatedRun] = await tx.update(clientRuns).set({
          latestChunkSequence: decoded.sequence,
          latestChunkEndElapsedMs: decoded.endElapsedMs,
          chunkChainHeadSha256: decoded.compressedSha256,
          latestGameElapsedMs: Math.max(run.latestGameElapsedMs, decoded.endElapsedMs),
          updatedAt: new Date(),
        }).where(eq(clientRuns.id, runId)).returning();
        return { chunk: chunkView(created!), run: runView(updatedRun!), idempotentReplay: false };
      });
    })
  ));
}

export function recoverClientRun(db: Database, userId: string, runId: string, payload: unknown) {
  return decode(RecoverRun, payload).pipe(
    Effect.flatMap((decoded) =>
      databaseEffect(() =>
        db.transaction(async (transaction) => {
          const tx = transaction as unknown as Database;
          const run = await lockedOwnedRun(tx, userId, runId);
          assertActive(run);
          const installation = await activeRunInstallation(tx, run);
          await assertSignature(
            installation.publicKeySpki,
            decoded.signature,
            clientRunRecoveryMessage(runId),
          );
          const runToken = randomBase64Url(32);
          const [updated] = await tx.update(clientRuns).set({
            runTokenHash: await sha256Hex(runToken),
            updatedAt: new Date(),
          }).where(eq(clientRuns.id, runId)).returning();
          return { run: runView(updated!), runToken };
        })
      )
    ),
  );
}

export function abandonClientRun(
  db: Database,
  blobStore: BlobStore,
  userId: string,
  runId: string,
  payload: unknown,
) {
  return decode(AbandonRun, payload).pipe(
    Effect.flatMap((decoded) =>
      databaseEffect(async () => {
        const abandoned = await db.transaction(async (transaction) => {
          const tx = transaction as unknown as Database;
          const run = await lockedOwnedRun(tx, userId, runId);
          await authorizeRunMessage(tx, run, decoded.runToken, decoded.signature, "abandon", {});
          assertActive(run);
          const now = new Date();
          const [updated] = await tx.update(clientRuns).set({
            status: "abandoned",
            abandonedAt: now,
            updatedAt: now,
          })
            .where(eq(clientRuns.id, runId)).returning();
          return runView(updated!);
        });
        await deleteRunBlobs(db, blobStore, runId);
        return { ...abandoned, blobState: "deleted" as const, blobsDeletedAt: new Date() };
      })
    ),
  );
}

export function finalizeClientRun(
  db: Database,
  blobStore: BlobStore,
  userId: string,
  runId: string,
  payload: unknown,
) {
  return decode(FinalizeRun, payload).pipe(Effect.flatMap((decoded) =>
    databaseEffect(async () => {
      validateFinalization(decoded);
      const unsigned = withoutSignature(decoded);
      const finalizationSha256 = await sha256Hex(canonicalJson(unsigned));
      const reservation = await db.transaction(async (transaction) => {
        const tx = transaction as unknown as Database;
        const run = await lockedOwnedRun(tx, userId, runId);
        await authorizeRunMessage(tx, run, decoded.runToken, decoded.signature, "finalize", unsigned);
        if (run.status === "finalized") {
          if (run.finalizationSha256 !== finalizationSha256) {
            throw new ConflictError("run is already finalized with another payload");
          }
          return { existing: run } as const;
        }
        if (run.status === "abandoned") throw new ConflictError("an abandoned run cannot be finalized");
        if (run.status === "finalizing") throw new ConflictError("run finalization is already processing");
        if (decoded.finalState.gameElapsedMs < run.latestGameElapsedMs) {
          throw new ValidationError("final game duration cannot precede the latest heartbeat or chunk");
        }
        if (decoded.finalState.gameElapsedMs > run.latestGameElapsedMs + 10 * 60 * 1_000) {
          throw new ValidationError("final game duration is too far beyond the latest heartbeat");
        }
        const candidateEntries = await personalBestCandidates(tx, run, decoded.entries);
        if (candidateEntries.length === 0) {
          const [finalized] = await tx.update(clientRuns).set({
            status: "finalized",
            finalizationSha256,
            finalizationPayload: withoutRunToken(unsigned),
            finalizationIssues: ["not_personal_best"],
            finalizedAt: new Date(),
            updatedAt: new Date(),
          }).where(eq(clientRuns.id, runId)).returning();
          return { discarded: finalized! } as const;
        }
        const [reserved] = await tx.update(clientRuns).set({
          status: "finalizing",
          finalizationSha256,
          finalizationPayload: withoutRunToken(unsigned),
          finalizationIssues: [],
          updatedAt: new Date(),
        }).where(eq(clientRuns.id, runId)).returning();
        return { reserved: reserved!, candidateEntries } as const;
      });
      if ("existing" in reservation && reservation.existing) {
        return finalizedRunResult(db, reservation.existing, true);
      }
      if ("discarded" in reservation && reservation.discarded) {
        await deleteRunBlobs(db, blobStore, reservation.discarded.id);
        const [discarded] = await db.select().from(clientRuns).where(eq(clientRuns.id, runId)).limit(1);
        return { run: runView(discarded!), submissions: [], idempotentReplay: false };
      }
      if (!("reserved" in reservation) || !reservation.reserved) {
        throw new ConflictError("run finalization could not be reserved");
      }
      const run = reservation.reserved;
      try {
        const chunkManifest = await db.select().from(clientRunChunks).where(eq(clientRunChunks.runId, run.id))
          .orderBy(clientRunChunks.sequence);
        const manifestStorageKey = clientManifestStorageKey(run.id);
        await blobStore.put(
          manifestStorageKey,
          new TextEncoder().encode(canonicalJson({
            protocolVersion: PROTOCOL_VERSION,
            runId: run.id,
            startPayloadSha256: run.startPayloadSha256,
            finalizationSha256,
            chunkChainHeadSha256: run.chunkChainHeadSha256,
            chunks: chunkManifest.map(chunkView),
          })),
        );
        const groupId = crypto.randomUUID();
        const proofLevel = run.latestChunkSequence > 0
          ? "verified_client_package" as const
          : "client_recorded" as const;
        const proofs = run.chunkChainHeadSha256
          ? [{
            type: "event_log" as const,
            storageKey: manifestStorageKey,
            sha256: run.chunkChainHeadSha256,
            formatVersion: PROTOCOL_VERSION,
            provider: "direct" as const,
            metadata: { chunks: run.latestChunkSequence },
          }]
          : undefined;
        const evidenceTailGapMs = decoded.finalState.gameElapsedMs - run.latestChunkEndElapsedMs;
        const created = await Effect.runPromise(persistSubmissions(
          db,
          {
            gameId: run.gameId,
            mapId: run.mapId,
            platform: run.platform,
            gameVersion: run.gameVersion,
            mapVersion: run.mapVersion,
            modId: run.modId,
            modVersion: run.modVersion,
            participantUserIds: run.participantUserIds,
            proofLevel,
            proofUrl: decoded.proofUrl,
            proofs,
            metadata: decoded.metadata,
          },
          reservation.candidateEntries,
          userId,
          groupId,
          {
            externalIdPrefix: `client-run:${run.id}`,
            metadata: {
              clientRunId: run.id,
              interrupted: decoded.interrupted,
              finalState: decoded.finalState,
              heartbeatSequence: run.latestHeartbeatSequence,
              heartbeatGapCount: run.heartbeatGapCount,
              maxHeartbeatGapMs: run.maxHeartbeatGapMs,
              chunkCount: run.latestChunkSequence,
              chunkChainHeadSha256: run.chunkChainHeadSha256,
              evidenceCoveredUntilMs: run.latestChunkEndElapsedMs,
              evidenceTailGapMs,
            },
          },
        ));
        const [finalized] = await db.update(clientRuns).set({
          status: "finalized",
          submissionGroupId: groupId,
          blobState: "retained",
          finalizedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(clientRuns.id, run.id)).returning();
        return { run: runView(finalized!), submissions: created, idempotentReplay: false };
      } catch (error) {
        await db.update(clientRuns).set({
          status: "active",
          finalizationIssues: [errorMessage(error)],
          updatedAt: new Date(),
        }).where(eq(clientRuns.id, run.id));
        throw error;
      }
    })
  ));
}

export function getClientRun(db: Database, userId: string, runId: string) {
  return databaseEffect(async () => {
    const [run] = await db.select().from(clientRuns).where(
      and(eq(clientRuns.id, runId), eq(clientRuns.userId, userId)),
    )
      .limit(1);
    if (!run) throw new NotFoundError("client run not found");
    const chunks = await db.select().from(clientRunChunks).where(eq(clientRunChunks.runId, runId)).orderBy(
      clientRunChunks.sequence,
    );
    const created = run.submissionGroupId
      ? await db.select().from(submissions).where(eq(submissions.submissionGroupId, run.submissionGroupId))
      : [];
    return { run: runView(run), chunks: chunks.map(chunkView), submissions: created };
  });
}

export function clientRunSigningMessage(action: string, runId: string, runToken: string, payload: unknown) {
  return `zwr-run-${action}-v1\n${runId}\n${runToken}\n${canonicalJson(payload)}`;
}

export function clientRunRecoveryMessage(runId: string) {
  return `zwr-run-recover-v1\n${runId}`;
}

export function clientRunChunkSigningMessage(
  runId: string,
  runToken: string,
  chunk: typeof ChunkUnsigned.Type,
) {
  return clientRunSigningMessage("chunk", runId, runToken, chunkSigningFields(chunk));
}

function chunkSigningFields(value: typeof ChunkUnsigned.Type) {
  return {
    sequence: value.sequence,
    startElapsedMs: value.startElapsedMs,
    endElapsedMs: value.endElapsedMs,
    previousChunkSha256: value.previousChunkSha256 ?? null,
    compression: value.compression,
    payloadFormat: value.payloadFormat,
    compressedSha256: value.compressedSha256,
    uncompressedSha256: value.uncompressedSha256,
  };
}

async function authorizeRunMessage(
  db: Database,
  run: typeof clientRuns.$inferSelect,
  runToken: string,
  signature: string,
  action: string,
  payload: unknown,
) {
  assertRunToken(runToken);
  if (!timingSafeEqual(run.runTokenHash, await sha256Hex(runToken))) {
    throw new ValidationError("invalid run token");
  }
  const installation = await activeRunInstallation(db, run);
  await assertSignature(
    installation.publicKeySpki,
    signature,
    clientRunSigningMessage(action, run.id, runToken, payload),
  );
}

async function activeRunInstallation(db: Database, run: typeof clientRuns.$inferSelect) {
  const [installation] = await db.select().from(clientInstallations).where(
    eq(clientInstallations.id, run.installationId),
  )
    .limit(1);
  if (!installation) throw new ConflictError("client installation no longer exists");
  if (installation.revokedAt) throw new ConflictError("client installation is revoked");
  const [version] = await db.select().from(clientVersions).where(eq(clientVersions.id, run.clientVersionId))
    .limit(1);
  if (!version || version.status !== "allowed") throw new ConflictError("client version is revoked");
  return installation;
}

async function ownedInstallation(db: Database, userId: string, installationId: string) {
  const [installation] = await db.select().from(clientInstallations).where(and(
    eq(clientInstallations.id, installationId),
    eq(clientInstallations.userId, userId),
  )).limit(1);
  if (!installation) throw new NotFoundError("client installation not found");
  return installation;
}

async function allowedVersion(db: Database, clientName: string, version: string, protocolVersion: number) {
  const [row] = await db.select().from(clientVersions).where(and(
    eq(clientVersions.clientName, clientName),
    eq(clientVersions.version, version),
    eq(clientVersions.protocolVersion, protocolVersion),
  )).limit(1);
  if (!row) throw new NotFoundError("client version not found");
  if (row.status !== "allowed") throw new ConflictError("client version is revoked");
  return row;
}

async function validateRunTarget(db: Database, value: typeof StartRun.Type, userId: string) {
  const [game] = await db.select({ id: games.id }).from(games).where(eq(games.id, value.gameId)).limit(1);
  if (!game) throw new NotFoundError("game not found");
  const [map] = await db.select().from(maps).where(eq(maps.id, value.mapId)).limit(1);
  if (!map) throw new NotFoundError("map not found");
  if (map.gameId !== value.gameId) throw new ValidationError("map must belong to the game");
  if (value.modId !== null && value.modId !== undefined) {
    const [mod] = await db.select().from(mods).where(eq(mods.id, value.modId)).limit(1);
    if (!mod || mod.gameId !== value.gameId) throw new ValidationError("mod must belong to the game");
  }
  const participantUserIds = [...new Set(value.participantUserIds ?? [userId])];
  if (!participantUserIds.includes(userId)) throw new ValidationError("the run owner must be a participant");
  if (participantUserIds.length < 1 || participantUserIds.length > 4) {
    throw new ValidationError("a run must contain between one and four participants");
  }
  const found = await db.select({ id: users.id }).from(users).where(inArray(users.id, participantUserIds));
  if (found.length !== participantUserIds.length) throw new ValidationError("every participant must exist");
}

async function enforceRunStartLimit(db: Database, userId: string) {
  await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`client-run-start:${userId}`}))`);
  const [usage] = await db.execute<{ count: number; oldest: Date | null }>(sql`
    SELECT count(*)::int AS count, min(created_at) AS oldest FROM client_runs
    WHERE user_id = ${userId} AND created_at > now() - interval '1 hour'
  `);
  if ((usage?.count ?? 0) < RUN_START_LIMIT_PER_HOUR) return;
  const oldestMs = usage?.oldest ? new Date(usage.oldest).getTime() : Date.now();
  const retryAfterSeconds = Math.max(1, Math.ceil((oldestMs + 3_600_000 - Date.now()) / 1_000));
  throw new RateLimitError("too many new client runs; existing runs remain fully usable", retryAfterSeconds);
}

async function personalBestCandidates(
  db: Database,
  run: typeof clientRuns.$inferSelect,
  entries: ReadonlyArray<typeof SubmissionEntry.Type>,
) {
  const competitorKey = competitorKeyFor(run.participantUserIds);
  const candidates = [];

  for (const entry of entries) {
    const [target] = await db.select({
      assignmentId: categoryAssignments.id,
      gameId: categoryAssignments.gameId,
      mapId: categoryAssignments.mapId,
      categoryId: categories.id,
      scoreType: categories.scoreType,
      rankingDirection: categories.rankingDirection,
    }).from(categoryAssignments).innerJoin(
      categories,
      eq(categoryAssignments.categoryId, categories.id),
    ).where(eq(categoryAssignments.id, entry.categoryAssignmentId)).limit(1);
    if (!target) throw new NotFoundError("category assignment not found");
    if (target.gameId !== run.gameId || (target.mapId !== null && target.mapId !== run.mapId)) {
      throw new ValidationError("category assignment does not belong to the run target");
    }

    const [current] = await db.select({
      scoreValue: submissions.scoreValue,
      runDurationMs: submissions.runDurationMs,
    }).from(bestRecords).innerJoin(
      submissions,
      eq(bestRecords.submissionId, submissions.id),
    ).where(and(
      eq(submissions.competitorKey, competitorKey),
      eq(submissions.mapId, run.mapId),
      eq(submissions.categoryAssignmentId, entry.categoryAssignmentId),
      eq(submissions.playerCount, run.participantUserIds.length),
    )).limit(1);

    if (
      !current || isBetterRecord(
        entry.scoreValue,
        current.scoreValue,
        entry.runDurationMs ?? null,
        current.runDurationMs,
        target.scoreType,
        target.rankingDirection,
      )
    ) candidates.push(entry);
  }

  return candidates;
}

async function deleteRunBlobs(db: Database, blobStore: BlobStore, runId: string) {
  await blobStore.deletePrefix(clientRunPrefix(runId));
  await db.update(clientRuns).set({
    blobState: "deleted",
    blobsDeletedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(clientRuns.id, runId));
}

async function lockedOwnedRun(db: Database, userId: string, runId: string) {
  assertUuid(runId, "runId");
  const [run] = await db.select().from(clientRuns).where(
    and(eq(clientRuns.id, runId), eq(clientRuns.userId, userId)),
  )
    .for("update").limit(1);
  if (!run) throw new NotFoundError("client run not found");
  return run;
}

async function finalizedRunResult(
  db: Database,
  run: typeof clientRuns.$inferSelect,
  idempotentReplay: boolean,
) {
  const created = run.submissionGroupId
    ? await db.select().from(submissions).where(eq(submissions.submissionGroupId, run.submissionGroupId))
    : [];
  return { run: runView(run), submissions: created, idempotentReplay };
}
