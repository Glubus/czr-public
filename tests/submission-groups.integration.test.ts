import { assert, assertEquals } from "@std/assert";
import { eq } from "drizzle-orm";
import { submissionParticipants, submissionProofs, submissions } from "../src/db/schema.ts";
import {
  createAuthenticatedUser,
  createCategory,
  createCategoryAssignment,
  createGame,
  createMap,
  reviewSubmission,
  setup,
} from "./helpers.ts";

Deno.test("one request atomically creates independently reviewable leaderboard submissions", async () => {
  const fixture = await setupGroupFixture();
  const response = await fixture.app.request("/submission-groups", {
    method: "POST",
    headers: fixture.player.headers,
    body: JSON.stringify({
      gameId: fixture.game.id,
      mapId: fixture.map.id,
      participantUserIds: [fixture.player.userId],
      proofLevel: "manual_video",
      platform: "pc",
      metadata: { source: "shared" },
      proofs: [{ type: "video", sourceUrl: "https://example.test/shared-run.mp4" }],
      entries: [
        { categoryAssignmentId: fixture.highRoundAssignment.id, scoreValue: 82 },
        {
          categoryAssignmentId: fixture.speedrunAssignment.id,
          scoreValue: 5_660_000,
          runDurationMs: 5_660_000,
          metadata: { split: "round-50" },
        },
      ],
    }),
  });
  assertEquals(response.status, 201);
  const group = await response.json();
  assertEquals(typeof group.submissionGroupId, "string");
  assertEquals(group.submissions.length, 2);
  assertEquals(group.submissions.map((submission: { scoreValue: number }) => submission.scoreValue), [
    82,
    5_660_000,
  ]);
  assertEquals(group.submissions[1].runDurationMs, 5_660_000);
  assertEquals(
    group.submissions.every(
      (submission: { submissionGroupId: string }) => submission.submissionGroupId === group.submissionGroupId,
    ),
    true,
  );
  assertEquals(group.submissions[1].metadata, { source: "shared", split: "round-50" });

  const storedParticipants = await fixture.db.select().from(submissionParticipants);
  const storedProofs = await fixture.db.select().from(submissionProofs);
  assertEquals(storedParticipants.length, 2);
  assertEquals(storedProofs.length, 2);
  assertEquals(
    storedProofs.every((proof) => proof.sourceUrl === "https://example.test/shared-run.mp4"),
    true,
  );

  const ownGroup = await fixture.app.request(`/me/submissions?groupId=${group.submissionGroupId}`, {
    headers: fixture.player.headers,
  });
  assertEquals(ownGroup.status, 200);
  assertEquals((await ownGroup.json()).entries.length, 2);

  await reviewSubmission(fixture.app, fixture.adminHeaders, group.submissions[0].id, "verified");
  await reviewSubmission(
    fixture.app,
    fixture.adminHeaders,
    group.submissions[1].id,
    "rejected",
    "speedrun timer is incomplete",
  );
  const stored = await fixture.db.select().from(submissions).where(
    eq(submissions.submissionGroupId, group.submissionGroupId),
  );
  assertEquals(stored.map((submission) => submission.status).sort(), ["rejected", "verified"]);
});

Deno.test("group validation and active capacity roll the complete request back", async () => {
  const fixture = await setupGroupFixture();
  const invalid = await createGroup(fixture, [
    { categoryAssignmentId: fixture.highRoundAssignment.id, scoreValue: 70 },
    { categoryAssignmentId: 999_999, scoreValue: 50, runDurationMs: 1_000 },
  ]);
  assertEquals(invalid.status, 404);
  assertEquals((await fixture.db.select().from(submissions)).length, 0);

  const duplicate = await createGroup(fixture, [
    { categoryAssignmentId: fixture.highRoundAssignment.id, scoreValue: 70 },
    { categoryAssignmentId: fixture.highRoundAssignment.id, scoreValue: 71 },
  ]);
  assertEquals(duplicate.status, 400);
  assertEquals((await fixture.db.select().from(submissions)).length, 0);

  const four = await createGroup(fixture, [
    { categoryAssignmentId: fixture.highRoundAssignment.id, scoreValue: 70 },
    { categoryAssignmentId: fixture.speedrunAssignment.id, scoreValue: 50, runDurationMs: 1_000 },
  ]);
  assertEquals(four.status, 201);
  const secondPair = await createGroup(fixture, [
    { categoryAssignmentId: fixture.highRoundAssignment.id, scoreValue: 71 },
    { categoryAssignmentId: fixture.speedrunAssignment.id, scoreValue: 50, runDurationMs: 900 },
  ]);
  assertEquals(secondPair.status, 201);
  assertEquals((await fixture.db.select().from(submissions)).length, 4);

  const overCapacity = await createGroup(fixture, [
    { categoryAssignmentId: fixture.highRoundAssignment.id, scoreValue: 72 },
    { categoryAssignmentId: fixture.speedrunAssignment.id, scoreValue: 50, runDurationMs: 800 },
  ]);
  assertEquals(overCapacity.status, 409);
  assertEquals((await fixture.db.select().from(submissions)).length, 4);
});

async function setupGroupFixture() {
  const { app, db, headers: adminHeaders } = await setup(["ROLE_ADMIN"]);
  const game = await createGame(app, adminHeaders, `group-${crypto.randomUUID()}`);
  const map = await createMap(app, adminHeaders, game.id, "group-map");
  const highRound = await createCategory(app, adminHeaders, {
    slug: `high-round-${crypto.randomUUID()}`,
    name: "High Round",
    scoreType: "round",
    rankingDirection: "higher_is_better",
  });
  const speedrun = await createCategory(app, adminHeaders, {
    slug: `round-50-${crypto.randomUUID()}`,
    name: "Round 50 speedrun",
    scoreType: "time",
    rankingDirection: "lower_is_better",
  });
  const highRoundAssignment = await createCategoryAssignment(app, adminHeaders, {
    categoryId: highRound.id,
    gameId: game.id,
    mapId: map.id,
  });
  const speedrunAssignment = await createCategoryAssignment(app, adminHeaders, {
    categoryId: speedrun.id,
    gameId: game.id,
    mapId: map.id,
  });
  const player = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  return { app, db, adminHeaders, game, map, highRoundAssignment, speedrunAssignment, player };
}

function createGroup(
  fixture: Awaited<ReturnType<typeof setupGroupFixture>>,
  entries: ReadonlyArray<Record<string, unknown>>,
) {
  assert(entries.length > 0);
  return fixture.app.request("/submission-groups", {
    method: "POST",
    headers: fixture.player.headers,
    body: JSON.stringify({
      gameId: fixture.game.id,
      mapId: fixture.map.id,
      proofLevel: "manual_video",
      entries,
    }),
  });
}
