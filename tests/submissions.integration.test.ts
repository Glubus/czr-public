import { assert, assertEquals } from "@std/assert";
import { eq } from "drizzle-orm";
import {
  achievementMetricSnapshots,
  bestRecords,
  submissionParticipants,
  submissionProofs,
  submissions,
} from "../src/db/schema.ts";
import {
  type App,
  createAuthenticatedUser,
  createCategory,
  createCategoryAssignment,
  createGame,
  createMap,
  reviewSubmission,
  setup,
  submitScore,
} from "./helpers.ts";

Deno.test("reviews keep the submission history but only expose a player's best run", async () => {
  const { app, db, headers } = await setup(["ROLE_USER", "ROLE_ADMIN"]);
  const game = await createGame(app, headers, "waw");
  const map = await createMap(app, headers, game.id, "nacht");
  const createdMod = await app.request("/admin/mods", {
    method: "POST",
    headers,
    body: JSON.stringify({ gameId: game.id, slug: "quality-of-life", name: "Quality of Life" }),
  });
  assertEquals(createdMod.status, 201);
  const mod = await createdMod.json();
  const gameMods = await app.request(`/games/${game.slug}/mods`);
  assertEquals(gameMods.status, 200);
  assertEquals((await gameMods.json())[0].id, mod.id);
  const category = await createCategory(app, headers, {
    slug: "high-round",
    name: "High Round",
    scoreType: "round",
    rankingDirection: "higher_is_better",
    rules: { timer: "in-game" },
  });
  const assignment = await createCategoryAssignment(app, headers, {
    categoryId: category.id,
    gameId: game.id,
    mapId: map.id,
    specificRules: { powerups: "banned" },
  });
  const player = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const assignedRoles = await app.request(`/admin/users/${player.userId}/roles`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ roles: ["ROLE_USER", "ROLE_VIP"] }),
  });
  assertEquals(assignedRoles.status, 200);
  assertEquals((await assignedRoles.json()).roles, ["ROLE_USER", "ROLE_VIP"]);
  const invalidScore = await app.request("/submissions", {
    method: "POST",
    headers: player.headers,
    body: JSON.stringify({
      gameId: game.id,
      mapId: map.id,
      categoryAssignmentId: assignment.id,
      scoreValue: 0,
      proofLevel: "manual_video",
    }),
  });
  assertEquals(invalidScore.status, 400);
  const unhashedDemo = await app.request("/submissions", {
    method: "POST",
    headers: player.headers,
    body: JSON.stringify({
      gameId: game.id,
      mapId: map.id,
      categoryAssignmentId: assignment.id,
      scoreValue: 1,
      proofLevel: "client_recorded",
      proofs: [{ type: "demo", sourceUrl: "https://example.test/run.dem" }],
    }),
  });
  assertEquals(unhashedDemo.status, 400);
  const first = await submitScore(app, player.headers, {
    gameId: game.id,
    mapId: map.id,
    categoryAssignmentId: assignment.id,
    scoreValue: 90,
    proofLevel: "client_recorded_with_inputs",
    platform: "pc",
    gameVersion: "1.33",
    mapVersion: "1.2.0",
    modId: mod.id,
    proofs: [{ type: "video", sourceUrl: "https://example.test/run.mp4", mimeType: "video/mp4" }],
  });
  assertEquals(first.status, "pending");
  const [firstParticipant] = await db.select().from(submissionParticipants).where(
    eq(submissionParticipants.submissionId, first.id),
  );
  const [firstProof] = await db.select().from(submissionProofs).where(
    eq(submissionProofs.submissionId, first.id),
  );
  assertEquals(firstParticipant?.userId, player.userId);
  assertEquals(firstParticipant?.role, "primary");
  assertEquals(firstProof?.sourceUrl, "https://example.test/run.mp4");
  await db.insert(achievementMetricSnapshots).values({
    userId: player.userId,
    values: { performance_points: 0 },
  });
  const firstReview = await reviewSubmission(app, headers, first.id, "verified");
  assertEquals(firstReview.recordUpdated, true);
  const [invalidatedSnapshot] = await db.select().from(achievementMetricSnapshots).where(
    eq(achievementMetricSnapshots.userId, player.userId),
  );
  assertEquals(invalidatedSnapshot, undefined);

  const best = await submitScore(app, player.headers, {
    gameId: game.id,
    mapId: map.id,
    categoryAssignmentId: assignment.id,
    scoreValue: 100,
    proofLevel: "manual_video",
  });
  assertEquals((await reviewSubmission(app, headers, best.id, "verified")).recordUpdated, true);

  const anonymousComment = await app.request(`/submissions/${best.id}/comments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ body: "Anonymous comment" }),
  });
  assertEquals(anonymousComment.status, 401);
  const commentResponse = await app.request(`/submissions/${best.id}/comments`, {
    method: "POST",
    headers: player.headers,
    body: JSON.stringify({ body: "  Clean strategy, great record!  " }),
  });
  assertEquals(commentResponse.status, 201);
  const comment = await commentResponse.json();
  assertEquals(comment.body, "Clean strategy, great record!");
  assertEquals(comment.author.id, player.userId);
  const commentsResponse = await app.request(`/submissions/${best.id}/comments`);
  assertEquals(commentsResponse.status, 200);
  assertEquals((await commentsResponse.json()).length, 1);

  const worse = await submitScore(app, player.headers, {
    gameId: game.id,
    mapId: map.id,
    categoryAssignmentId: assignment.id,
    scoreValue: 95,
    proofLevel: "manual_video",
  });
  assertEquals((await reviewSubmission(app, headers, worse.id, "verified")).recordUpdated, false);

  const rejected = await submitScore(app, player.headers, {
    gameId: game.id,
    mapId: map.id,
    categoryAssignmentId: assignment.id,
    scoreValue: 101,
    proofLevel: "manual_video",
  });
  const rejection = await reviewSubmission(app, headers, rejected.id, "rejected", "proof is incomplete");
  assertEquals(rejection.submission.status, "rejected");

  const activeRecords = await db.select().from(bestRecords);
  const allSubmissions = await db.select().from(submissions);
  assertEquals(activeRecords.length, 1);
  assert(activeRecords[0]);
  assertEquals(activeRecords[0].submissionId, best.id);
  assertEquals(allSubmissions.length, 4);
  const playerPointsBeforeBeingOvertaken = activeRecords[0].points;

  const challenger = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const replyResponse = await app.request(`/submissions/${best.id}/comments`, {
    method: "POST",
    headers: challenger.headers,
    body: JSON.stringify({ body: "Thanks - the route was really clean.", parentId: comment.id }),
  });
  assertEquals(replyResponse.status, 201);
  const reply = await replyResponse.json();
  assertEquals(reply.parentId, comment.id);
  const upvote = await app.request(`/submissions/${best.id}/comments/${comment.id}/vote`, {
    method: "PUT",
    headers: challenger.headers,
    body: JSON.stringify({ value: 1 }),
  });
  assertEquals(upvote.status, 200);
  assertEquals((await upvote.json()).score, 1);
  const downvote = await app.request(`/submissions/${best.id}/comments/${comment.id}/vote`, {
    method: "PUT",
    headers: player.headers,
    body: JSON.stringify({ value: -1 }),
  });
  assertEquals(downvote.status, 200);
  assertEquals((await downvote.json()).score, 0);
  const removeVote = await app.request(`/submissions/${best.id}/comments/${comment.id}/vote`, {
    method: "PUT",
    headers: player.headers,
    body: JSON.stringify({ value: 0 }),
  });
  assertEquals(removeVote.status, 200);
  assertEquals((await removeVote.json()).score, 1);
  const threadedComments = await app.request(`/submissions/${best.id}/comments`, {
    headers: challenger.headers,
  });
  const thread = await threadedComments.json();
  assertEquals(thread.length, 2);
  assertEquals(thread[0].score, 1);
  assertEquals(thread[0].viewerVote, 1);
  assertEquals(thread[1].parentId, comment.id);
  const forbiddenCommentDeletion = await app.request(
    `/submissions/${best.id}/comments/${comment.id}`,
    { method: "DELETE", headers: challenger.headers },
  );
  assertEquals(forbiddenCommentDeletion.status, 404);
  const ownCommentDeletion = await app.request(`/submissions/${best.id}/comments/${comment.id}`, {
    method: "DELETE",
    headers: player.headers,
  });
  assertEquals(ownCommentDeletion.status, 200);
  const commentsAfterRootDeletion = await (await app.request(`/submissions/${best.id}/comments`)).json();
  assertEquals(commentsAfterRootDeletion.length, 1);
  assertEquals(commentsAfterRootDeletion[0].id, reply.id);
  assertEquals(commentsAfterRootDeletion[0].parentId, null);
  const challengerRun = await submitScore(app, challenger.headers, {
    gameId: game.id,
    mapId: map.id,
    categoryAssignmentId: assignment.id,
    scoreValue: 100,
    runDurationMs: 120_000,
    proofLevel: "manual_video",
  });
  assertEquals((await reviewSubmission(app, headers, challengerRun.id, "verified")).recordUpdated, true);

  const recalculatedRecords = await db.select().from(bestRecords);
  const playerRecordAfterBeingOvertaken = recalculatedRecords.find((record) =>
    record.submissionId === best.id
  );
  assert(playerRecordAfterBeingOvertaken);
  assert(playerRecordAfterBeingOvertaken.points !== playerPointsBeforeBeingOvertaken);

  const response = await app.request(`/maps/${map.id}/categories/${category.id}/leaderboard`);
  assertEquals(response.status, 200);
  const leaderboard = await response.json();
  assertEquals(leaderboard.category.id, category.id);
  assertEquals(leaderboard.pool, 200);
  assertEquals(leaderboard.page, 0);
  assertEquals(leaderboard.pageSize, 50);
  assertEquals(leaderboard.hasMore, false);
  assertEquals(leaderboard.category.globalRules, { timer: "in-game" });
  assertEquals(leaderboard.category.specificRules, { powerups: "banned" });
  const rows = leaderboard.entries;
  assertEquals(rows.length, 2);
  assertEquals(rows[0].rank, 1);
  assertEquals(rows[0].userId, challenger.userId);
  assertEquals(rows[0].user.id, challenger.userId);
  assertEquals(rows[0].user.name, "Test User");
  assertEquals(rows[0].scoreValue, 100);
  assertEquals(rows[0].submission.id, challengerRun.id);
  assertEquals(rows[0].submission.runDurationMs, 120_000);
  assert(rows[0].points > 0);
  assertEquals(rows[0].points, 200);
  assertEquals(rows[0].participants[0].user.id, challenger.userId);
  assertEquals(rows[0].participants[0].points, rows[0].points);
  assertEquals(rows[1].user.id, player.userId);
  assertEquals(rows[1].submission.id, best.id);
  assertEquals(rows[1].submission.runDurationMs, null);

  const users = await app.request(`/users?search=Test&page=0`);
  assertEquals(users.status, 200);
  const usersBody = await users.json();
  assertEquals(usersBody.search, "Test");
  assert(usersBody.entries.some((entry: { id: string }) => entry.id === player.userId));

  assertEquals((await app.request(`/me/pinned-records/${best.id}`, { method: "PUT" })).status, 401);
  const pinned = await app.request(`/me/pinned-records/${best.id}`, {
    method: "PUT",
    headers: player.headers,
  });
  assertEquals(pinned.status, 200);

  const records = await app.request(`/users/${player.userId}/records`);
  assertEquals(records.status, 200);
  const recordsBody = await records.json();
  assertEquals(recordsBody.user.id, player.userId);
  assertEquals(recordsBody.page, 0);
  assertEquals(recordsBody.pageSize, 50);
  assertEquals(recordsBody.hasMore, false);
  assertEquals(recordsBody.entries[0].submissionId, best.id);
  assertEquals(recordsBody.entries[0].awardedPoints, recordsBody.entries[0].points);
  assertEquals(recordsBody.entries[0].awardPercentage, 100);
  assertEquals(recordsBody.pinnedSubmissionIds, [best.id]);
  assertEquals(
    recordsBody.pinnedEntries.map((entry: { submissionId: number }) => entry.submissionId),
    [best.id],
  );
  assert(recordsBody.user.performancePoints > 0);
  const performanceHistoryResponse = await app.request(`/users/${player.userId}/performance-history`);
  assertEquals(performanceHistoryResponse.status, 200);
  const performanceHistory = await performanceHistoryResponse.json();
  assert(performanceHistory.entries.length > 0);
  assertEquals(performanceHistory.entries.at(-1).points, recordsBody.user.performancePoints);
  assertEquals(performanceHistory.entries.at(-1).source, "submission");
  const scopedRanksResponse = await app.request(`/users/${player.userId}/ranks`);
  assertEquals(scopedRanksResponse.status, 200);
  const scopedRanks = await scopedRanksResponse.json();
  assertEquals(scopedRanks.userId, player.userId);
  assertEquals(scopedRanks.games[0].name, game.name);
  assertEquals(scopedRanks.games[0].rank, 2);
  assertEquals(scopedRanks.categories[0].name, category.name);
  assertEquals(scopedRanks.categories[0].rank, 2);
  assertEquals(recordsBody.mostPlayed.games[0].name, game.name);
  assertEquals(recordsBody.mostPlayed.games[0].playCount, 3);
  assertEquals(recordsBody.mostPlayed.maps[0].name, map.name);
  assertEquals(recordsBody.mostPlayed.maps[0].playCount, 3);
  assertEquals(recordsBody.mostPlayed.categories[0].name, category.name);
  assertEquals(recordsBody.mostPlayed.categories[0].playCount, 3);
  assertEquals((await app.request(`/users/${player.userId}/records?page=invalid`)).status, 400);
  assertEquals(
    (await app.request(`/maps/${map.id}/categories/${category.id}/leaderboard?page=invalid`)).status,
    400,
  );

  const globalLeaderboard = await app.request("/leaderboard");
  assertEquals(globalLeaderboard.status, 200);
  const globalLeaderboardBody = await globalLeaderboard.json();
  assertEquals(globalLeaderboardBody.page, 0);
  assertEquals(globalLeaderboardBody.pageSize, 50);
  assertEquals(globalLeaderboardBody.entries.length, 2);
  assertEquals(globalLeaderboardBody.entries[0].rank, 1);
  assertEquals(globalLeaderboardBody.entries[0].user.id, challenger.userId);
  assert(globalLeaderboardBody.entries[0].user.performancePoints > 0);

  const filteredGlobalLeaderboard = await app.request(
    "/leaderboard?categories=high-round&game=waw&maps_status=community",
  );
  assertEquals(filteredGlobalLeaderboard.status, 200);
  const filteredGlobalLeaderboardBody = await filteredGlobalLeaderboard.json();
  assertEquals(filteredGlobalLeaderboardBody.filters, {
    categories: ["high-round"],
    game: "waw",
    mapsStatus: "community",
    scope: "world",
  });
  assertEquals(filteredGlobalLeaderboardBody.entries.length, 2);

  const officialOnlyLeaderboard = await app.request("/leaderboard?maps_status=official");
  assertEquals(officialOnlyLeaderboard.status, 200);
  assertEquals((await officialOnlyLeaderboard.json()).entries, []);

  const invalidMapFilter = await app.request("/leaderboard?maps_status=invalid");
  assertEquals(invalidMapFilter.status, 400);

  const history = await app.request(`/users/${player.userId}/history?page=0`);
  assertEquals(history.status, 200);
  const historyBody = await history.json();
  assertEquals(historyBody.user.id, player.userId);
  assertEquals(historyBody.page, 0);
  assertEquals(historyBody.pageSize, 25);
  assertEquals(historyBody.entries.length, 3);
  assertEquals(historyBody.entries[0].submissionId, worse.id);
  assertEquals(historyBody.entries[0].isBestRecord, false);
  assertEquals(historyBody.entries[0].points, null);
  const currentPb = historyBody.entries.find(
    (entry: { submissionId: number }) => entry.submissionId === best.id,
  );
  assertEquals(currentPb.isBestRecord, true);
  assert(currentPb.points > 0);

  assertEquals(
    (await app.request(`/me/pinned-records/${best.id}`, {
      method: "DELETE",
      headers: player.headers,
    })).status,
    200,
  );

  const invalidHistoryPage = await app.request(
    `/users/${player.userId}/history?page=invalid`,
  );
  assertEquals(invalidHistoryPage.status, 400);

  const pending = await submitScore(app, player.headers, {
    gameId: game.id,
    mapId: map.id,
    categoryAssignmentId: assignment.id,
    scoreValue: 80,
    proofLevel: "manual_video",
  });
  const moderationQueue = await app.request("/admin/submissions?status=pending", { headers });
  assertEquals(moderationQueue.status, 200);
  const moderationQueueBody = await moderationQueue.json();
  assertEquals(moderationQueueBody.entries.length, 1);
  assertEquals(moderationQueueBody.entries[0].submission.id, pending.id);
  assertEquals(moderationQueueBody.entries[0].participants[0].user.id, player.userId);

  const moderationDetail = await app.request(`/admin/submissions/${pending.id}`, { headers });
  assertEquals(moderationDetail.status, 200);
  assertEquals((await moderationDetail.json()).submission.id, pending.id);

  const mySubmissions = await app.request("/me/submissions?status=pending", { headers: player.headers });
  assertEquals(mySubmissions.status, 200);
  assertEquals((await mySubmissions.json()).entries[0].submission.id, pending.id);

  const teammateA = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const teammateB = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const teamA = await submitScore(app, player.headers, {
    gameId: game.id,
    mapId: map.id,
    categoryAssignmentId: assignment.id,
    scoreValue: 110,
    participantUserIds: [player.userId, teammateA.userId],
    proofLevel: "manual_video",
  });
  await acceptParticipation(app, teammateA.headers);
  await reviewSubmission(app, headers, teamA.id, "verified");
  const teamB = await submitScore(app, player.headers, {
    gameId: game.id,
    mapId: map.id,
    categoryAssignmentId: assignment.id,
    scoreValue: 111,
    participantUserIds: [player.userId, teammateB.userId],
    proofLevel: "manual_video",
  });
  await acceptParticipation(app, teammateB.headers);
  await reviewSubmission(app, headers, teamB.id, "verified");
  const teamRecords = await db.select().from(bestRecords);
  assert(teamRecords.some((record) => record.submissionId === teamA.id));
  assert(teamRecords.some((record) => record.submissionId === teamB.id));
});

async function acceptParticipation(app: App, headers: Headers) {
  const invitations = await app.request("/me/participation-invitations", { headers });
  assertEquals(invitations.status, 200);
  const [invitation] = await invitations.json();
  assert(invitation);
  const accepted = await app.request(`/me/participation-invitations/${invitation.invitation.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ status: "accepted" }),
  });
  assertEquals(accepted.status, 200);
}
