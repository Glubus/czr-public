import { assertEquals } from "@std/assert";
import { eq } from "drizzle-orm";
import { bestRecords, personalRuns, submissions } from "../src/db/schema.ts";
import {
  createAuthenticatedUser,
  createCategory,
  createCategoryAssignment,
  createGame,
  createMap,
  setup,
} from "./helpers.ts";

Deno.test("personal runs remain outside official rankings and obey visibility, PB and promotion rules", async () => {
  const { app, db, headers: adminHeaders } = await setup(["ROLE_ADMIN"]);
  const owner = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const follower = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const stranger = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const game = await createGame(app, adminHeaders, `personal-${crypto.randomUUID()}`);
  const map = await createMap(app, adminHeaders, game.id, "personal-map");
  const category = await createCategory(app, adminHeaders, {
    slug: `personal-high-${crypto.randomUUID()}`,
    name: "Personal High Round",
    scoreType: "round",
    rankingDirection: "higher_is_better",
  });
  const assignment = await createCategoryAssignment(app, adminHeaders, {
    categoryId: category.id,
    gameId: game.id,
    mapId: map.id,
  });
  assertEquals(
    (await app.request("/me/follows", {
      method: "POST",
      headers: follower.headers,
      body: JSON.stringify({ targetType: "user", targetId: owner.userId }),
    })).status,
    201,
  );

  const privateRun = await createRun(
    app,
    owner.headers,
    target(game.id, map.id, assignment.id, 10, "private"),
  );
  const followerRun = await createRun(
    app,
    owner.headers,
    target(game.id, map.id, assignment.id, 20, "followers"),
  );
  const publicRun = await createRun(app, owner.headers, target(game.id, map.id, assignment.id, 15, "public"));

  const anonymous = await app.request(`/users/${owner.userId}/personal-runs`);
  assertEquals((await anonymous.json()).entries.map(score), [15]);
  const followerView = await app.request(`/users/${owner.userId}/personal-runs`, {
    headers: follower.headers,
  });
  assertEquals((await followerView.json()).entries.map(score), [15, 20]);
  const strangerView = await app.request(`/users/${owner.userId}/personal-runs`, {
    headers: stranger.headers,
  });
  assertEquals((await strangerView.json()).entries.map(score), [15]);
  const own = await app.request("/me/personal-runs", { headers: owner.headers });
  assertEquals((await own.json()).entries.length, 3);

  const bests = await app.request("/me/personal-runs/bests", { headers: owner.headers });
  assertEquals((await bests.json()).entries.map(score), [20]);
  const updated = await app.request(`/me/personal-runs/${privateRun.id}`, {
    method: "PATCH",
    headers: owner.headers,
    body: JSON.stringify({ scoreValue: 25, visibility: "public" }),
  });
  assertEquals(updated.status, 200);
  assertEquals((await updated.json()).scoreValue, 25);
  assertEquals(
    (await (await app.request("/me/personal-runs/bests", { headers: owner.headers })).json()).entries.map(
      score,
    ),
    [25],
  );

  assertEquals(
    (await app.request(`/me/personal-runs/${followerRun.id}/promote`, {
      method: "POST",
      headers: owner.headers,
    })).status,
    400,
  );
  const withProof = await app.request(`/me/personal-runs/${followerRun.id}`, {
    method: "PATCH",
    headers: owner.headers,
    body: JSON.stringify({
      proofLevel: "manual_video",
      proofUrl: "https://video.example/personal-run",
      notes: "ready for review",
    }),
  });
  assertEquals(withProof.status, 200);

  const promotions = await Promise.all([
    app.request(`/me/personal-runs/${followerRun.id}/promote`, { method: "POST", headers: owner.headers }),
    app.request(`/me/personal-runs/${followerRun.id}/promote`, { method: "POST", headers: owner.headers }),
  ]);
  assertEquals(promotions.map((response) => response.status).sort(), [201, 409]);
  const promotedResponse = promotions.find((response) => response.status === 201)!;
  const promoted = await promotedResponse.json();
  assertEquals(promoted.submission.status, "pending");
  assertEquals(promoted.submission.scoreValue, 20);
  assertEquals(promoted.submission.metadata.personalRunId, followerRun.id);
  assertEquals(
    (await db.select().from(submissions).where(eq(submissions.id, promoted.submission.id))).length,
    1,
  );
  assertEquals((await db.select().from(bestRecords)).length, 0);
  const official = await app.request(`/leaderboard?game=${game.slug}`);
  assertEquals((await official.json()).entries.length, 0);
  assertEquals(
    (await app.request(`/me/personal-runs/${followerRun.id}`, {
      method: "PATCH",
      headers: owner.headers,
      body: JSON.stringify({ scoreValue: 999 }),
    })).status,
    409,
  );
  assertEquals(
    (await app.request(`/me/personal-runs/${followerRun.id}`, {
      method: "DELETE",
      headers: owner.headers,
    })).status,
    409,
  );

  assertEquals(
    (await app.request(`/me/personal-runs/${publicRun.id}`, {
      method: "DELETE",
      headers: owner.headers,
    })).status,
    200,
  );
  assertEquals((await db.select().from(personalRuns).where(eq(personalRuns.id, publicRun.id))).length, 0);
  assertEquals(
    (await app.request("/me/personal-runs", {
      method: "POST",
      headers: owner.headers,
      body: JSON.stringify(target(game.id, map.id, assignment.id + 9999, 1, "private")),
    })).status,
    404,
  );
  assertEquals((await app.request(`/users/${owner.userId}/personal-runs?cursor=nope`)).status, 400);
});

function target(
  gameId: number,
  mapId: number,
  categoryAssignmentId: number,
  scoreValue: number,
  visibility: string,
) {
  return { gameId, mapId, categoryAssignmentId, scoreValue, visibility };
}

async function createRun(
  app: Awaited<ReturnType<typeof setup>>["app"],
  headers: Headers,
  body: Record<string, unknown>,
) {
  const response = await app.request("/me/personal-runs", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  assertEquals(response.status, 201);
  return response.json();
}

function score(run: { scoreValue: number }) {
  return run.scoreValue;
}
