import { assertEquals, assertMatch } from "@std/assert";
import { eq, sql } from "drizzle-orm";
import { clientRunChunks, clientRuns, submissions } from "../src/db/schema.ts";
import { createFileBlobStore } from "../src/infra/blob-store.ts";
import { runWorkerCycle } from "../src/modules/worker/cycle.ts";
import {
  clientRunChunkSigningMessage,
  clientRunRecoveryMessage,
  clientRunSigningMessage,
} from "../src/modules/client-ingestion/service.ts";
import {
  createAuthenticatedUser,
  createCategory,
  createCategoryAssignment,
  createGame,
  createMap,
  reviewSubmission,
  setup,
  submitScore,
} from "./helpers.ts";

Deno.test("durable client runs survive long games, compressed checkpoints and crashes", async () => {
  const fixture = await clientFixture();
  const { app, db, blobRoot, adminHeaders, player, keys, installation, game, map, assignment } = fixture;
  const runId = crypto.randomUUID();
  let runToken = randomBase64Url(32);
  const start = {
    runId,
    runToken,
    installationId: installation.id,
    clientName: "zwr-windows",
    clientVersion: "0.2.0",
    protocolVersion: 1,
    gameId: game.id,
    mapId: map.id,
    platform: "plutonium",
    participantUserIds: [player.userId],
  };
  const startSignature = await sign(
    keys.privateKey,
    clientRunSigningMessage("start", runId, runToken, start),
  );
  const started = await app.request("/me/client-runs", {
    method: "POST",
    headers: player.headers,
    body: JSON.stringify({ ...start, signature: startSignature }),
  });
  assertEquals(started.status, 201);
  assertEquals((await started.json()).run.status, "active");

  const firstHeartbeat = {
    runToken,
    sequence: 1,
    gameElapsedMs: 30 * 60 * 1_000,
    round: 30,
    observedAt: new Date().toISOString(),
  };
  assertEquals(await heartbeat(app, player.headers, keys.privateKey, runId, firstHeartbeat), 200);

  const eventPayload = new TextEncoder().encode(JSON.stringify({
    events: [{ sequence: 1, type: "round_end", round: 30, gameElapsedMs: firstHeartbeat.gameElapsedMs }],
  }));
  const compressed = await gzip(eventPayload);
  const chunk = {
    runToken,
    sequence: 1,
    startElapsedMs: 0,
    endElapsedMs: firstHeartbeat.gameElapsedMs,
    previousChunkSha256: null,
    compression: "gzip" as const,
    payloadFormat: "events-v1" as const,
    compressedSha256: await sha256Hex(compressed),
    uncompressedSha256: await sha256Hex(eventPayload),
    compressedDataBase64: encodeBase64(compressed),
  };
  const chunkSignature = await sign(keys.privateKey, clientRunChunkSigningMessage(runId, runToken, chunk));
  const chunkResponse = await app.request(`/me/client-runs/${runId}/chunks`, {
    method: "POST",
    headers: player.headers,
    body: JSON.stringify({ ...chunk, signature: chunkSignature }),
  });
  assertEquals(chunkResponse.status, 201);
  assertEquals((await chunkResponse.json()).chunk.eventCount, 1);
  assertEquals((await db.select().from(clientRunChunks)).length, 1);
  const [storedChunk] = await db.select().from(clientRunChunks);
  assertEquals("compressedPayload" in storedChunk!, false);
  assertEquals((await Deno.stat(`${blobRoot}/${storedChunk!.storageKey}`)).isFile, true);

  const monthElapsedMs = 30 * 24 * 60 * 60 * 1_000;
  const longHeartbeat = {
    runToken,
    sequence: 43_200,
    gameElapsedMs: monthElapsedMs,
    round: 129,
    observedAt: new Date().toISOString(),
  };
  assertEquals(await heartbeat(app, player.headers, keys.privateKey, runId, longHeartbeat), 200);

  const recoverySignature = await sign(keys.privateKey, clientRunRecoveryMessage(runId));
  const recovered = await app.request(`/me/client-runs/${runId}/recover`, {
    method: "POST",
    headers: player.headers,
    body: JSON.stringify({ signature: recoverySignature }),
  });
  assertEquals(recovered.status, 200);
  const recovery = await recovered.json();
  runToken = recovery.runToken;
  assertMatch(runToken, /^[A-Za-z0-9_-]{43}$/);

  const finalization = {
    runToken,
    interrupted: true,
    finalState: { gameElapsedMs: monthElapsedMs, round: 129, endedAt: new Date().toISOString() },
    entries: [{
      categoryAssignmentId: assignment.id,
      scoreValue: 129,
      runDurationMs: monthElapsedMs,
    }],
    proofUrl: "https://video.example/month-long-crash",
    metadata: { crash: true },
  };
  const finalSignature = await sign(
    keys.privateKey,
    clientRunSigningMessage("finalize", runId, runToken, finalization),
  );
  const finalized = await app.request(`/me/client-runs/${runId}/finalize`, {
    method: "POST",
    headers: player.headers,
    body: JSON.stringify({ ...finalization, signature: finalSignature }),
  });
  assertEquals(finalized.status, 201);
  const result = await finalized.json();
  assertEquals(result.run.status, "finalized");
  assertEquals(result.submissions.length, 1);
  assertEquals(result.submissions[0].status, "pending");
  assertEquals(result.submissions[0].proofLevel, "verified_client_package");
  assertEquals(result.submissions[0].runDurationMs, monthElapsedMs);
  assertEquals(result.submissions[0].metadata.interrupted, true);
  assertEquals(result.submissions[0].metadata.heartbeatGapCount, 43_198);
  assertEquals(result.submissions[0].metadata.evidenceCoveredUntilMs, 30 * 60 * 1_000);
  assertEquals(result.submissions[0].metadata.evidenceTailGapMs, monthElapsedMs - 30 * 60 * 1_000);
  assertEquals(result.submissions[0].externalId, `client-run:${runId}:1`);

  const replay = await app.request(`/me/client-runs/${runId}/finalize`, {
    method: "POST",
    headers: player.headers,
    body: JSON.stringify({ ...finalization, signature: finalSignature }),
  });
  assertEquals(replay.status, 200);
  assertEquals((await replay.json()).idempotentReplay, true);
  assertEquals(
    (await db.select().from(submissions).where(eq(submissions.externalId, `client-run:${runId}:1`))).length,
    1,
  );

  const status = await app.request(`/me/client-runs/${runId}`, { headers: player.headers });
  assertEquals(status.status, 200);
  const statusBody = await status.json();
  assertEquals(statusBody.chunks.length, 1);
  assertEquals(statusBody.chunks[0].compressedPayload, undefined);
  assertEquals(statusBody.submissions.length, 1);
  const [storedRun] = await db.select().from(clientRuns).where(eq(clientRuns.id, runId));
  assertEquals("runToken" in (storedRun!.finalizationPayload ?? {}), false);
  assertEquals(storedRun!.blobState, "retained");

  await reviewSubmission(app, adminHeaders, result.submissions[0].id, "verified");
  const blobStore = createFileBlobStore(blobRoot);
  assertEquals((await runWorkerCycle(db, blobStore)).deletedClientRunBlobs, 0);
  const replacement = await submitScore(app, player.headers, {
    gameId: game.id,
    mapId: map.id,
    categoryAssignmentId: assignment.id,
    scoreValue: 130,
    proofLevel: "manual_video",
    proofUrl: "https://video.example/replacement",
  });
  await reviewSubmission(app, adminHeaders, replacement.id, "verified");
  assertEquals((await runWorkerCycle(db, blobStore)).deletedClientRunBlobs, 1);
  await Deno.stat(`${blobRoot}/${storedChunk!.storageKey}`).then(
    () => Promise.reject(new Error("replaced client blob still exists")),
    (error) => {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    },
  );
});

Deno.test("new-run spam never blocks an existing run heartbeat", async () => {
  const { app, db, player, keys, installation, version, game, map } = await clientFixture();
  const runId = crypto.randomUUID();
  const runToken = randomBase64Url(32);
  const start = {
    runId,
    runToken,
    installationId: installation.id,
    clientName: "zwr-windows",
    clientVersion: "0.2.0",
    protocolVersion: 1,
    gameId: game.id,
    mapId: map.id,
    participantUserIds: [player.userId],
  };
  const signature = await sign(keys.privateKey, clientRunSigningMessage("start", runId, runToken, start));
  assertEquals(
    (await app.request("/me/client-runs", {
      method: "POST",
      headers: player.headers,
      body: JSON.stringify({ ...start, signature }),
    })).status,
    201,
  );

  await db.execute(sql`
    INSERT INTO client_runs (
      id, user_id, installation_id, client_version_id, game_id, map_id,
      participant_user_ids, run_token_hash, start_payload_sha256, status
    )
    SELECT gen_random_uuid()::text, ${player.userId}, ${installation.id}, ${version.id}, ${game.id}, ${map.id},
      ${JSON.stringify([player.userId])}::jsonb, repeat('a', 64), repeat('b', 64), 'abandoned'
    FROM generate_series(1, 179)
  `);

  const blockedRunId = crypto.randomUUID();
  const blockedToken = randomBase64Url(32);
  const blocked = { ...start, runId: blockedRunId, runToken: blockedToken };
  const blockedSignature = await sign(
    keys.privateKey,
    clientRunSigningMessage("start", blockedRunId, blockedToken, blocked),
  );
  const blockedResponse = await app.request("/me/client-runs", {
    method: "POST",
    headers: player.headers,
    body: JSON.stringify({ ...blocked, signature: blockedSignature }),
  });
  assertEquals(blockedResponse.status, 429);
  assertMatch(blockedResponse.headers.get("retry-after") ?? "", /^[1-9][0-9]*$/);

  assertEquals(
    await heartbeat(app, player.headers, keys.privateKey, runId, {
      runToken,
      sequence: 1,
      gameElapsedMs: 60_000,
      round: 1,
      observedAt: new Date().toISOString(),
    }),
    200,
  );
});

async function clientFixture() {
  const { app, db, headers: adminHeaders, blobRoot } = await setup(["ROLE_ADMIN"]);
  const player = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const game = await createGame(app, adminHeaders, `client-${crypto.randomUUID()}`);
  const map = await createMap(app, adminHeaders, game.id, "durable-map");
  const category = await createCategory(app, adminHeaders, {
    slug: `client-category-${crypto.randomUUID()}`,
    name: "Client category",
    scoreType: "round",
    rankingDirection: "higher_is_better",
  });
  const assignment = await createCategoryAssignment(app, adminHeaders, {
    categoryId: category.id,
    gameId: game.id,
    mapId: map.id,
  });
  const versionResponse = await app.request("/admin/client-versions", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ clientName: "zwr-windows", version: "0.2.0", protocolVersion: 1 }),
  });
  assertEquals(versionResponse.status, 201);
  const version = await versionResponse.json();
  const keys = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]) as CryptoKeyPair;
  const installationResponse = await app.request("/me/client-installations", {
    method: "POST",
    headers: player.headers,
    body: JSON.stringify({
      name: "Gaming PC",
      publicKeySpki: encodeBase64(new Uint8Array(await crypto.subtle.exportKey("spki", keys.publicKey))),
    }),
  });
  assertEquals(installationResponse.status, 201);
  return {
    app,
    db,
    blobRoot,
    adminHeaders,
    player,
    game,
    map,
    assignment,
    version,
    keys,
    installation: await installationResponse.json(),
  };
}

async function heartbeat(
  app: Awaited<ReturnType<typeof clientFixture>>["app"],
  headers: Headers,
  privateKey: CryptoKey,
  runId: string,
  heartbeatPayload: Record<string, unknown> & { runToken: string },
) {
  const signature = await sign(
    privateKey,
    clientRunSigningMessage("heartbeat", runId, heartbeatPayload.runToken, heartbeatPayload),
  );
  return (await app.request(`/me/client-runs/${runId}/heartbeat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...heartbeatPayload, signature }),
  })).status;
}

async function sign(privateKey: CryptoKey, message: string) {
  return encodeBase64(
    new Uint8Array(await crypto.subtle.sign("Ed25519", privateKey, new TextEncoder().encode(message))),
  );
}

async function gzip(value: Uint8Array) {
  const stream = new Blob([Uint8Array.from(value).buffer]).stream().pipeThrough(
    new CompressionStream("gzip"),
  );
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function sha256Hex(value: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function encodeBase64(value: Uint8Array) {
  return btoa(String.fromCharCode(...value));
}

function randomBase64Url(size: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
