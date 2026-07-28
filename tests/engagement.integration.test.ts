import { assert, assertEquals } from "@std/assert";
import { eq } from "drizzle-orm";
import { submissions } from "../src/db/schema.ts";
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

Deno.test("goals, achievements, challenges and moderation overview share verified progress", async () => {
  const { app, db, headers: adminHeaders } = await setup(["ROLE_ADMIN"]);
  const player = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const now = Date.now();

  const achievementResponse = await app.request("/admin/achievements", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      slug: "first-verified-run",
      name: "First verified run",
      description: "Verify one run",
      metric: "verified_submissions",
      threshold: 1,
    }),
  });
  assertEquals(achievementResponse.status, 201);

  const challengeResponse = await app.request("/admin/challenges", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      slug: "launch-run",
      name: "Launch run",
      description: "Verify one run during launch week",
      metric: "verified_submissions",
      targetValue: 1,
      startsAt: new Date(now - 60_000).toISOString(),
      endsAt: new Date(now + 60_000).toISOString(),
    }),
  });
  assertEquals(challengeResponse.status, 201);

  const goalResponse = await app.request("/me/goals", {
    method: "POST",
    headers: player.headers,
    body: JSON.stringify({ title: "Verify a run", metric: "verified_submissions", targetValue: 1 }),
  });
  assertEquals(goalResponse.status, 201);
  assertEquals((await goalResponse.json()).progress, 0);

  const game = await createGame(app, adminHeaders, `engagement-${crypto.randomUUID()}`);
  const map = await createMap(app, adminHeaders, game.id, "engagement-map");
  const category = await createCategory(app, adminHeaders, {
    slug: `engagement-${crypto.randomUUID()}`,
    name: "Engagement",
    scoreType: "round",
    rankingDirection: "higher_is_better",
  });
  const assignment = await createCategoryAssignment(app, adminHeaders, {
    gameId: game.id,
    mapId: map.id,
    categoryId: category.id,
  });
  const roundGoalResponse = await app.request("/me/goals", {
    method: "POST",
    headers: player.headers,
    body: JSON.stringify({
      title: "Reach round 10",
      metric: "round",
      targetValue: 10,
      gameId: game.id,
      mapId: map.id,
      categoryAssignmentId: assignment.id,
      playerCount: 1,
    }),
  });
  assertEquals(roundGoalResponse.status, 201);
  assertEquals((await roundGoalResponse.json()).progress, 0);
  const rankGoalResponse = await app.request("/me/goals", {
    method: "POST",
    headers: player.headers,
    body: JSON.stringify({
      title: "Take first place",
      metric: "rank",
      targetValue: 1,
      gameId: game.id,
      mapId: map.id,
      categoryAssignmentId: assignment.id,
      playerCount: 1,
    }),
  });
  assertEquals(rankGoalResponse.status, 201);
  assertEquals(
    (await app.request("/me/goals", {
      method: "POST",
      headers: player.headers,
      body: JSON.stringify({
        title: "Invalid time goal",
        metric: "time",
        targetValue: 60_000,
        gameId: game.id,
        mapId: map.id,
        categoryAssignmentId: assignment.id,
        playerCount: 1,
      }),
    })).status,
    400,
  );
  const verified = await submitScore(app, player.headers, {
    gameId: game.id,
    mapId: map.id,
    categoryAssignmentId: assignment.id,
    scoreValue: 10,
    proofLevel: "manual_video",
  });
  await reviewSubmission(app, adminHeaders, verified.id, "verified");

  const goals = await (await app.request("/me/goals", { headers: player.headers })).json();
  const submissionGoal = goals.find((goal: { metric: string }) => goal.metric === "verified_submissions");
  const roundGoal = goals.find((goal: { metric: string }) => goal.metric === "round");
  const rankGoal = goals.find((goal: { metric: string }) => goal.metric === "rank");
  assertEquals(submissionGoal.progress, 1);
  assertEquals(submissionGoal.status, "completed");
  assertEquals(roundGoal.progress, 10);
  assertEquals(roundGoal.status, "completed");
  assertEquals(roundGoal.board.map.id, map.id);
  assertEquals(rankGoal.progress, 1);
  assertEquals(rankGoal.status, "completed");

  const achievements = await (await app.request("/achievements", { headers: player.headers })).json();
  assertEquals(achievements[0].progress, 1);
  assert(achievements[0].unlockedAt);
  const anonymousAchievements = await (await app.request("/achievements")).json();
  assertEquals(anonymousAchievements[0].progress, null);

  const challenges = await (await app.request("/challenges", { headers: player.headers })).json();
  assertEquals(challenges[0].progress, 1);

  await submitScore(app, player.headers, {
    gameId: game.id,
    mapId: map.id,
    categoryAssignmentId: assignment.id,
    scoreValue: 11,
    proofLevel: "manual_video",
  });
  const overview = await app.request("/admin/moderation/overview", { headers: adminHeaders });
  assertEquals(overview.status, 200);
  const overviewBody = await overview.json();
  assertEquals(overviewBody.submissions.pending, 1);
  assert(overviewBody.oldestPendingSubmission);
  assertEquals(
    (await app.request("/admin/moderation/overview", { headers: player.headers })).status,
    403,
  );
});

Deno.test("historical WR achievements reconstruct reigns, comebacks and self improvements", async () => {
  const { app, db, headers: adminHeaders } = await setup(["ROLE_ADMIN"]);
  const player = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const rival = await createAuthenticatedUser(app, db, ["ROLE_USER"]);

  for (
    const definition of [
      {
        slug: "history-back-from-dead-test",
        name: "Back From the Dead",
        metric: "back_from_the_dead",
        threshold: 1,
      },
      {
        slug: "history-self-wr-test",
        name: "Raising the Bar",
        metric: "self_wr_improvement",
        threshold: 1,
      },
      {
        slug: "history-weekend-test",
        name: "WR Weekend",
        metric: "wr_weekend",
        threshold: 1,
      },
      {
        slug: "history-record-breaker-test",
        name: "Record Breaker",
        metric: "record_breaker_days",
        threshold: 365,
      },
      {
        slug: "history-untouchable-test",
        name: "Untouchable",
        metric: "longest_wr_reign_days",
        threshold: 365,
      },
    ]
  ) {
    const response = await app.request("/admin/achievements", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        ...definition,
        description: definition.name,
        direction: "higher_is_better",
        category: "World Records",
        series: definition.slug,
        tier: 1,
        points: 10,
      }),
    });
    assertEquals(response.status, 201);
  }

  const game = await createGame(app, adminHeaders, `history-${crypto.randomUUID()}`);
  const map = await createMap(app, adminHeaders, game.id, "historical-wr-map");
  const category = await createCategory(app, adminHeaders, {
    slug: `history-round-${crypto.randomUUID()}`,
    name: "Historical High Round",
    scoreType: "round",
    rankingDirection: "higher_is_better",
  });
  const assignment = await createCategoryAssignment(app, adminHeaders, {
    gameId: game.id,
    mapId: map.id,
    categoryId: category.id,
  });

  const verifyAt = async (
    user: typeof player,
    scoreValue: number,
    verifiedAt: string,
  ) => {
    const run = await submitScore(app, user.headers, {
      gameId: game.id,
      mapId: map.id,
      categoryAssignmentId: assignment.id,
      scoreValue,
      proofLevel: "manual_video",
    });
    await reviewSubmission(app, adminHeaders, run.id, "verified");
    await db.update(submissions).set({ verifiedAt: new Date(verifiedAt) }).where(
      eq(submissions.id, run.id),
    );
    return run;
  };

  await verifyAt(player, 10, "2024-01-01T00:00:00.000Z");
  await verifyAt(player, 20, "2024-01-02T00:00:00.000Z");
  await verifyAt(rival, 30, "2024-01-03T00:00:00.000Z");
  await verifyAt(player, 40, "2025-02-04T00:00:00.000Z");

  const recalculation = await app.request("/admin/achievements/recalculate", {
    method: "POST",
    headers: adminHeaders,
  });
  assertEquals(recalculation.status, 200);

  const achievements = await (
    await app.request(`/users/${player.userId}/achievements`)
  ).json();
  for (
    const slug of [
      "history-back-from-dead-test",
      "history-self-wr-test",
      "history-weekend-test",
      "history-record-breaker-test",
      "history-untouchable-test",
    ]
  ) {
    const achievement = achievements.find((entry: { slug: string }) => entry.slug === slug);
    assert(achievement?.unlockedAt, `${slug} should be unlocked`);
  }
  const reign = achievements.find((entry: { slug: string }) => entry.slug === "history-untouchable-test");
  assert(reign.progress >= 365);
});

Deno.test("achievement API evaluates record rules, evolving tiers and global recalculation", async () => {
  const { app, db, headers: adminHeaders } = await setup(["ROLE_ADMIN"]);
  const player = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const teammate = await createAuthenticatedUser(app, db, ["ROLE_USER"]);

  for (
    const definition of [
      {
        slug: "classic-200-test",
        name: "Old School Survivor",
        description: "Reach round 200",
        metric: "classic_high_round",
        threshold: 200,
        direction: "higher_is_better",
        category: "Game Mastery",
        series: "classic-test",
        tier: 1,
        points: 100,
      },
      {
        slug: "classic-300-test",
        name: "Old School Immortal",
        description: "Reach round 300",
        metric: "classic_high_round",
        threshold: 300,
        direction: "higher_is_better",
        category: "Game Mastery",
        series: "classic-test",
        tier: 2,
        points: 200,
      },
      {
        slug: "30sr-test",
        name: "Thirty Under Thirty",
        description: "Finish under 30 minutes",
        metric: "speedrun_30",
        threshold: 1_799_999,
        direction: "lower_is_better",
        category: "Speedruns",
        series: "30sr-test",
        tier: 1,
        points: 125,
      },
      {
        slug: "lights-out-test",
        name: "Lights Out",
        description: "Reach round 200 in No Power on BO1 through BO4",
        metric: "no_power_round",
        threshold: 200,
        direction: "higher_is_better",
        category: "Challenges",
        series: "lights-out-test",
        tier: 1,
        points: 125,
      },
      {
        slug: "map-explorer-test",
        name: "First Steps",
        description: "Play one map",
        metric: "maps_played",
        threshold: 1,
        direction: "higher_is_better",
        category: "Exploration",
        series: "map-explorer-test",
        tier: 1,
        points: 5,
      },
      {
        slug: "map-completionist-test",
        name: "Category Curious",
        description: "Top 15 in two categories on an eligible map",
        metric: "map_top15_categories",
        threshold: 2,
        direction: "higher_is_better",
        category: "Game Mastery",
        series: "map-completionist-test",
        tier: 1,
        points: 20,
      },
      {
        slug: "tour-of-duty-test",
        name: "Tour of Duty",
        description: "Complete a game's High Round tour after mastering one map",
        metric: "game_high_round_top15_complete",
        threshold: 1,
        direction: "higher_is_better",
        category: "Game Mastery",
        series: "map-completionist-test",
        tier: 2,
        points: 150,
      },
      {
        slug: "global-team-rank-test",
        name: "Dream Team",
        description: "Reach #1 on a global team leaderboard",
        metric: "team_best_rank",
        threshold: 1,
        direction: "lower_is_better",
        category: "Teamwork",
        series: "global-team-rank-test",
        tier: 1,
        points: 20,
      },
      {
        slug: "wr-2p-test",
        name: "Double Trouble",
        description: "Hold a 2P world record",
        metric: "world_records_2p",
        threshold: 1,
        direction: "higher_is_better",
        category: "World Records",
        series: "wr-2p-test",
        tier: 1,
        points: 50,
      },
      {
        slug: "team-format-test",
        name: "Party Starter",
        description: "Play one co-op format",
        metric: "team_formats_played",
        threshold: 1,
        direction: "higher_is_better",
        category: "Teamwork",
        series: "team-format-test",
        tier: 1,
        points: 10,
      },
    ]
  ) {
    const response = await app.request("/admin/achievements", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify(definition),
    });
    assertEquals(response.status, 201);
  }

  const game = await createGame(app, adminHeaders, "bo3");
  const map = await createMap(app, adminHeaders, game.id, "achievement-map");
  const highRound = await createCategory(app, adminHeaders, {
    slug: "high-round",
    name: "High Rounds",
    scoreType: "round",
    rankingDirection: "higher_is_better",
  });
  const highRoundAssignment = await createCategoryAssignment(app, adminHeaders, {
    gameId: game.id,
    mapId: map.id,
    categoryId: highRound.id,
  });
  const roundRun = await submitScore(app, player.headers, {
    gameId: game.id,
    mapId: map.id,
    categoryAssignmentId: highRoundAssignment.id,
    scoreValue: 255,
    proofLevel: "manual_video",
  });
  await reviewSubmission(app, adminHeaders, roundRun.id, "verified");

  const speedrun = await createCategory(app, adminHeaders, {
    slug: "30-speedrun",
    name: "30 Speedrun",
    scoreType: "time",
    rankingDirection: "lower_is_better",
  });
  const speedrunAssignment = await createCategoryAssignment(app, adminHeaders, {
    gameId: game.id,
    mapId: map.id,
    categoryId: speedrun.id,
  });
  const speedRun = await submitScore(app, player.headers, {
    gameId: game.id,
    mapId: map.id,
    categoryAssignmentId: speedrunAssignment.id,
    scoreValue: 1_700_000,
    runDurationMs: 1_700_000,
    proofLevel: "manual_video",
  });
  await reviewSubmission(app, adminHeaders, speedRun.id, "verified");

  const noPower = await createCategory(app, adminHeaders, {
    slug: "no-power",
    name: "No Power",
    scoreType: "round",
    rankingDirection: "higher_is_better",
  });
  const noPowerAssignment = await createCategoryAssignment(app, adminHeaders, {
    gameId: game.id,
    mapId: map.id,
    categoryId: noPower.id,
  });
  const lightsOutRun = await submitScore(app, player.headers, {
    gameId: game.id,
    mapId: map.id,
    categoryAssignmentId: noPowerAssignment.id,
    scoreValue: 200,
    proofLevel: "manual_video",
  });
  await reviewSubmission(app, adminHeaders, lightsOutRun.id, "verified");

  for (
    const [slug, name] of [
      ["first-room", "First Room"],
      ["no-jug", "No Jug"],
    ]
  ) {
    const extraCategory = await createCategory(app, adminHeaders, {
      slug,
      name,
      scoreType: "round",
      rankingDirection: "higher_is_better",
    });
    await createCategoryAssignment(app, adminHeaders, {
      gameId: game.id,
      mapId: map.id,
      categoryId: extraCategory.id,
    });
  }

  const excludedGame = await createGame(app, adminHeaders, "waw");
  const excludedMap = await createMap(app, adminHeaders, excludedGame.id, "excluded-lights-out-map");
  const excludedAssignment = await createCategoryAssignment(app, adminHeaders, {
    gameId: excludedGame.id,
    mapId: excludedMap.id,
    categoryId: noPower.id,
  });
  const excludedRun = await submitScore(app, player.headers, {
    gameId: excludedGame.id,
    mapId: excludedMap.id,
    categoryAssignmentId: excludedAssignment.id,
    scoreValue: 1_000,
    proofLevel: "manual_video",
  });
  await reviewSubmission(app, adminHeaders, excludedRun.id, "verified");

  const teamRun = await submitScore(app, player.headers, {
    gameId: game.id,
    mapId: map.id,
    categoryAssignmentId: highRoundAssignment.id,
    scoreValue: 300,
    participantUserIds: [player.userId, teammate.userId],
    proofLevel: "manual_video",
  });
  const invitations = await app.request("/me/participation-invitations", {
    headers: teammate.headers,
  });
  const invitation = (await invitations.json())[0].invitation;
  const acceptance = await app.request(`/me/participation-invitations/${invitation.id}`, {
    method: "PATCH",
    headers: teammate.headers,
    body: JSON.stringify({ status: "accepted" }),
  });
  assertEquals(acceptance.status, 200);
  await reviewSubmission(app, adminHeaders, teamRun.id, "verified");

  const recalculation = await app.request("/admin/achievements/recalculate", {
    method: "POST",
    headers: adminHeaders,
  });
  assertEquals(recalculation.status, 200);
  const recalculationBody = await recalculation.json();
  assert(recalculationBody.playersProcessed >= 2);
  assertEquals(recalculationBody.newUnlocks, 15);

  const achievements = await (
    await app.request(`/users/${player.userId}/achievements`)
  ).json();
  const firstTier = achievements.find((entry: { slug: string }) => entry.slug === "classic-200-test");
  const nextTier = achievements.find((entry: { slug: string }) => entry.slug === "classic-300-test");
  const timed = achievements.find((entry: { slug: string }) => entry.slug === "30sr-test");
  const lightsOut = achievements.find((entry: { slug: string }) => entry.slug === "lights-out-test");
  const mapExplorer = achievements.find((entry: { slug: string }) => entry.slug === "map-explorer-test");
  const mapCompletionist = achievements.find((entry: { slug: string }) =>
    entry.slug === "map-completionist-test"
  );
  const tourOfDuty = achievements.find((entry: { slug: string }) => entry.slug === "tour-of-duty-test");
  const globalTeamRank = achievements.find((entry: { slug: string }) =>
    entry.slug === "global-team-rank-test"
  );
  const twoPlayerWr = achievements.find((entry: { slug: string }) => entry.slug === "wr-2p-test");
  const teamFormat = achievements.find((entry: { slug: string }) => entry.slug === "team-format-test");
  assertEquals(firstTier.progress, 300);
  assert(firstTier.unlockedAt);
  assertEquals(firstTier.points, 100);
  assertEquals(firstTier.achievementPoints, 655);
  assertEquals(nextTier.progress, 300);
  assert(nextTier.unlockedAt);
  assertEquals(timed.progress, 1_700_000);
  assert(timed.unlockedAt);
  assertEquals(timed.direction, "lower_is_better");
  assertEquals(lightsOut.progress, 200);
  assert(lightsOut.unlockedAt);
  assertEquals(mapExplorer.progress, 2);
  assert(mapExplorer.unlockedAt);
  assertEquals(mapCompletionist.progress, 3);
  assert(mapCompletionist.unlockedAt);
  assertEquals(tourOfDuty.progress, 0);
  assertEquals(tourOfDuty.unlockedAt, null);
  assertEquals(globalTeamRank.progress, 1);
  assert(globalTeamRank.unlockedAt);
  assertEquals(twoPlayerWr.progress, 1);
  assert(twoPlayerWr.unlockedAt);
  assertEquals(teamFormat.progress, 1);
  assert(teamFormat.unlockedAt);

  const apLeaderboardResponse = await app.request("/leaderboard/achievements");
  assertEquals(apLeaderboardResponse.status, 200);
  const apLeaderboard = await apLeaderboardResponse.json();
  assertEquals(apLeaderboard.entries[0].user.id, player.userId);
  assertEquals(apLeaderboard.entries[0].achievementPoints, 655);
  assertEquals(apLeaderboard.entries[0].unlockedCount, 9);
});
