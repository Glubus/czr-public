import { assert, assertEquals } from "@std/assert";
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

Deno.test("launch journey: login, submit, moderate, and rank a verified record", async () => {
  const { app, db, headers: adminHeaders } = await setup(["ROLE_ADMIN"]);
  const suffix = crypto.randomUUID();
  const game = await createGame(app, adminHeaders, `journey-${suffix}`);
  const map = await createMap(app, adminHeaders, game.id, `journey-map-${suffix}`);
  const category = await createCategory(app, adminHeaders, {
    slug: `journey-round-${suffix}`,
    name: "Launch Journey High Round",
    scoreType: "round",
    rankingDirection: "higher_is_better",
  });
  const assignment = await createCategoryAssignment(app, adminHeaders, {
    categoryId: category.id,
    gameId: game.id,
    mapId: map.id,
    specificRules: { gobblegum: "classic" },
  });
  const player = await createAuthenticatedUser(app, db, ["ROLE_USER"]);

  const submission = await submitScore(app, player.headers, {
    gameId: game.id,
    mapId: map.id,
    categoryAssignmentId: assignment.id,
    playerCount: 1,
    scoreValue: 75,
    proofLevel: "manual_video",
    proofs: [{
      type: "video",
      sourceUrl: "https://www.youtube.com/watch?v=launch-journey",
      provider: "youtube",
    }],
  });
  assertEquals(submission.status, "pending");

  const ownSubmissions = await app.request("/me/submissions?page=0", { headers: player.headers });
  assertEquals(ownSubmissions.status, 200);
  assertEquals((await ownSubmissions.json()).entries[0].submission.id, submission.id);

  const moderationQueue = await app.request("/admin/submissions?status=pending&page=0", {
    headers: adminHeaders,
  });
  assertEquals(moderationQueue.status, 200);
  assert(
    (await moderationQueue.json()).entries.some((entry: { submission: { id: number } }) =>
      entry.submission.id === submission.id
    ),
  );
  const moderationDetail = await app.request(`/admin/submissions/${submission.id}`, {
    headers: adminHeaders,
  });
  assertEquals(moderationDetail.status, 200);
  assertEquals((await moderationDetail.json()).proofs[0].provider, "youtube");

  const review = await reviewSubmission(app, adminHeaders, submission.id, "verified", "Journey approved");
  assertEquals(review.submission.status, "verified");
  assertEquals(review.recordUpdated, true);

  const board = await app.request(
    `/maps/${map.id}/categories/${category.id}/leaderboard?assignment_id=${assignment.id}&player_count=1`,
  );
  assertEquals(board.status, 200);
  const boardBody = await board.json();
  assertEquals(boardBody.entries[0].submission.id, submission.id);
  assertEquals(boardBody.entries[0].user.id, player.userId);
  assertEquals(boardBody.entries[0].rank, 1);

  const globalBoard = await app.request(`/leaderboard?game=${game.slug}&categories=${category.slug}`);
  assertEquals(globalBoard.status, 200);
  assertEquals((await globalBoard.json()).entries[0].user.id, player.userId);
});
