import { assert, assertEquals } from "@std/assert";
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

Deno.test("team leaderboards aggregate exact accepted 2P, 3P and 4P rosters", async () => {
  const { app, db, headers: adminHeaders } = await setup(["ROLE_ADMIN"]);
  const game = await createGame(app, adminHeaders, `teams-${crypto.randomUUID()}`);
  const map = await createMap(app, adminHeaders, game.id, "team-map");
  const category = await createCategory(app, adminHeaders, {
    slug: `team-high-${crypto.randomUUID()}`,
    name: "Team High Round",
    scoreType: "round",
    rankingDirection: "higher_is_better",
  });
  const assignment = await createCategoryAssignment(app, adminHeaders, {
    categoryId: category.id,
    gameId: game.id,
    mapId: map.id,
  });
  const josef = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const marc = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const pascal = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const jean = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const target = { gameId: game.id, mapId: map.id, categoryAssignmentId: assignment.id };

  const josefMarcFirst = await submitAcceptedTeam(
    app,
    adminHeaders,
    josef,
    [josef, marc],
    target,
    100,
  );
  const josefMarcBest = await submitAcceptedTeam(
    app,
    adminHeaders,
    marc,
    [marc, josef],
    target,
    110,
  );
  const josefPascal = await submitAcceptedTeam(
    app,
    adminHeaders,
    josef,
    [josef, pascal],
    target,
    105,
  );
  const josefMarcJean = await submitAcceptedTeam(
    app,
    adminHeaders,
    jean,
    [josef, marc, jean],
    target,
    200,
  );
  assertEquals(josefMarcFirst.competitorKey, josefMarcBest.competitorKey);
  assert(josefMarcBest.competitorKey !== josefPascal.competitorKey);
  assert(josefMarcBest.competitorKey !== josefMarcJean.competitorKey);

  const twoPlayer = await app.request(
    `/teams/leaderboard?player_count=2&game=${game.slug}&categories=${category.slug}`,
  );
  assertEquals(twoPlayer.status, 200);
  const twoPlayerBody = await twoPlayer.json();
  assertEquals(twoPlayerBody.entries.length, 2);
  assertEquals(twoPlayerBody.entries[0].competitorKey, josefMarcBest.competitorKey);
  assertEquals(
    twoPlayerBody.entries[0].members.map((member: { id: string }) => member.id).sort(),
    [josef.userId, marc.userId].sort(),
  );
  assertEquals(twoPlayerBody.entries[0].recordCount, 1);
  assertEquals(twoPlayerBody.entries[0].firstPlaces, 1);

  const mapTwoPlayer = await app.request(
    `/maps/${map.id}/categories/${category.id}/leaderboard?player_count=2`,
  );
  assertEquals(mapTwoPlayer.status, 200);
  const mapTwoPlayerBody = await mapTwoPlayer.json();
  // The PP pool counts competing teams, not every player inside those teams.
  assertEquals(mapTwoPlayerBody.pool, 200);
  assertEquals(mapTwoPlayerBody.entries[0].points, 200);

  const threePlayer = await app.request("/teams/leaderboard?player_count=3");
  assertEquals(threePlayer.status, 200);
  const threePlayerBody = await threePlayer.json();
  assertEquals(threePlayerBody.entries.length, 1);
  assertEquals(threePlayerBody.entries[0].competitorKey, josefMarcJean.competitorKey);
  assertEquals(threePlayerBody.entries[0].performancePoints, 50);

  const mapThreePlayer = await app.request(
    `/maps/${map.id}/categories/${category.id}/leaderboard?player_count=3`,
  );
  assertEquals(mapThreePlayer.status, 200);
  const mapThreePlayerBody = await mapThreePlayer.json();
  assertEquals(mapThreePlayerBody.pool, 50);
  assertEquals(mapThreePlayerBody.entries[0].points, 50);

  const detail = await app.request(`/teams/${encodeURIComponent(josefMarcBest.competitorKey)}`);
  assertEquals(detail.status, 200);
  const detailBody = await detail.json();
  assertEquals(detailBody.playerCount, 2);
  assertEquals(detailBody.recordCount, 1);
  assertEquals(detailBody.firstPlaces, 1);
  const records = await app.request(`/teams/${encodeURIComponent(josefMarcBest.competitorKey)}/records`);
  assertEquals(records.status, 200);
  const recordsBody = await records.json();
  assertEquals(recordsBody.page, 0);
  assertEquals(recordsBody.pageSize, 50);
  assertEquals(recordsBody.hasMore, false);
  assertEquals(recordsBody.entries.length, 1);
  assertEquals(recordsBody.entries[0].submissionId, josefMarcBest.id);
  assertEquals(recordsBody.entries[0].scoreValue, 110);
  assertEquals(recordsBody.entries[0].isWorldRecord, true);

  const socialContext = await app.request(`/users/${josef.userId}/social-context`);
  assertEquals(socialContext.status, 200);
  const socialContextBody = await socialContext.json();
  assertEquals(socialContextBody.clan, null);
  assertEquals(socialContextBody.frequentTeams.length, 3);
  const josefMarcContext = socialContextBody.frequentTeams.find(
    (team: { competitorKey: string }) => team.competitorKey === josefMarcBest.competitorKey,
  );
  assertEquals(josefMarcContext.recordCount, 1);
  assertEquals(
    josefMarcContext.participants.map((member: { id: string }) => member.id).sort(),
    [josef.userId, marc.userId].sort(),
  );

  const missingCount = await app.request("/teams/leaderboard");
  assertEquals(missingCount.status, 400);
  const soloCount = await app.request("/teams/leaderboard?player_count=1");
  assertEquals(soloCount.status, 400);
  const invalidKey = await app.request("/teams/not-a-team");
  assertEquals(invalidKey.status, 400);
  assertEquals(
    (await app.request(`/teams/${encodeURIComponent(josefMarcBest.competitorKey)}/records?page=nope`)).status,
    400,
  );
});

async function submitAcceptedTeam(
  app: App,
  adminHeaders: Headers,
  submitter: { userId: string; headers: Headers },
  participants: Array<{ userId: string; headers: Headers }>,
  target: { gameId: number; mapId: number; categoryAssignmentId: number },
  scoreValue: number,
) {
  const submission = await submitScore(app, submitter.headers, {
    ...target,
    scoreValue,
    participantUserIds: participants.map((participant) => participant.userId),
    proofLevel: "manual_video",
  });
  for (const participant of participants) {
    if (participant.userId === submitter.userId) continue;
    const invitations = await app.request("/me/participation-invitations", {
      headers: participant.headers,
    });
    assertEquals(invitations.status, 200);
    const invitation = (await invitations.json()).find((entry: { group: { submissionGroupId: string } }) =>
      entry.group.submissionGroupId === submission.submissionGroupId
    );
    assert(invitation);
    const accepted = await app.request(`/me/participation-invitations/${invitation.invitation.id}`, {
      method: "PATCH",
      headers: participant.headers,
      body: JSON.stringify({ status: "accepted" }),
    });
    assertEquals(accepted.status, 200);
  }
  await reviewSubmission(app, adminHeaders, submission.id, "verified");
  return submission;
}
