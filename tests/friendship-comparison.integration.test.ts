import { assertEquals } from "@std/assert";
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

Deno.test("mutual follows derive friendship, custom leaderboards and profile comparison", async () => {
  const { app, db, headers: adminHeaders } = await setup(["ROLE_ADMIN"]);
  const alice = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const bob = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const outsider = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const game = await createGame(app, adminHeaders, `friends-${crypto.randomUUID()}`);
  const map = await createMap(app, adminHeaders, game.id, "friends-map");
  const category = await createCategory(app, adminHeaders, {
    slug: `friends-high-${crypto.randomUUID()}`,
    name: "Friends High Round",
    scoreType: "round",
    rankingDirection: "higher_is_better",
  });
  const assignment = await createCategoryAssignment(app, adminHeaders, {
    categoryId: category.id,
    gameId: game.id,
    mapId: map.id,
  });
  for (const [player, scoreValue] of [[alice, 100], [bob, 90], [outsider, 200]] as const) {
    const submission = await submitScore(app, player.headers, {
      gameId: game.id,
      mapId: map.id,
      categoryAssignmentId: assignment.id,
      scoreValue,
      proofLevel: "manual_video",
    });
    await reviewSubmission(app, adminHeaders, submission.id, "verified");
  }

  assertEquals((await follow(app, alice.headers, bob.userId)).status, 201);
  const following = await leaderboard(app, alice.headers, game.slug, "following");
  assertEquals(following.status, 200);
  assertEquals((await following.json()).entries.map(userId), [alice.userId, bob.userId]);

  const friendsBeforeReciprocity = await leaderboard(app, alice.headers, game.slug, "friends");
  assertEquals(friendsBeforeReciprocity.status, 200);
  assertEquals((await friendsBeforeReciprocity.json()).entries.map(userId), [alice.userId]);

  assertEquals((await follow(app, bob.headers, alice.userId)).status, 201);
  const friends = await leaderboard(app, alice.headers, game.slug, "friends");
  assertEquals((await friends.json()).entries.map(userId), [alice.userId, bob.userId]);
  assertEquals((await app.request(`/leaderboard?scope=following&game=${game.slug}`)).status, 401);
  assertEquals((await app.request("/leaderboard?scope=private")).status, 400);

  const comparison = await app.request(`/users/${alice.userId}/compare/${bob.userId}`);
  assertEquals(comparison.status, 200);
  const body = await comparison.json();
  assertEquals(body.friendship, {
    leftFollowsRight: true,
    rightFollowsLeft: true,
    mutual: true,
  });
  assertEquals(body.left.user.id, alice.userId);
  assertEquals(body.right.user.id, bob.userId);
  assertEquals(body.left.recordCount, 1);
  assertEquals(body.right.recordCount, 1);
  assertEquals(body.headToHead, {
    leftWins: 1,
    rightWins: 0,
    ties: 0,
    commonMapCount: 1,
    commonCategoryCount: 1,
  });
  assertEquals(body.commonBoards.length, 1);
  assertEquals(body.commonBoards[0].winnerUserId, alice.userId);
  assertEquals(body.commonBoards[0].left.scoreValue, 100);
  assertEquals(body.commonBoards[0].right.scoreValue, 90);
  assertEquals(body.left.globalRank, 2);
  assertEquals(body.right.globalRank, 3);

  assertEquals((await app.request(`/users/${alice.userId}/compare/${alice.userId}`)).status, 400);
  assertEquals((await app.request(`/users/${alice.userId}/compare/missing-user`)).status, 404);
});

function follow(app: Awaited<ReturnType<typeof setup>>["app"], headers: Headers, userId: string) {
  return app.request("/me/follows", {
    method: "POST",
    headers,
    body: JSON.stringify({ targetType: "user", targetId: userId }),
  });
}

function leaderboard(
  app: Awaited<ReturnType<typeof setup>>["app"],
  headers: Headers,
  game: string,
  scope: string,
) {
  return app.request(`/leaderboard?game=${game}&scope=${scope}`, { headers });
}

function userId(entry: { user: { id: string } }) {
  return entry.user.id;
}
