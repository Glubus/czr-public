import { assert, assertEquals } from "@std/assert";
import { eq } from "drizzle-orm";
import { bestRecords, clanMembers, submissionParticipants, submissions } from "../src/db/schema.ts";
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

Deno.test("clan leaderboard follows current members and counts each top run once per clan", async () => {
  const { app, db, headers: adminHeaders } = await setup(["ROLE_ADMIN"]);
  const game = await createGame(app, adminHeaders, `clan-board-${crypto.randomUUID()}`);
  const map = await createMap(app, adminHeaders, game.id, "clan-board-map");
  const category = await createCategory(app, adminHeaders, {
    slug: `clan-board-high-${crypto.randomUUID()}`,
    name: "Clan Board High Round",
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
  const run = await submitScore(app, josef.headers, {
    gameId: game.id,
    mapId: map.id,
    categoryAssignmentId: assignment.id,
    scoreValue: 200,
    participantUserIds: [josef.userId, marc.userId],
    proofLevel: "manual_video",
  });
  const invitations = await app.request("/me/participation-invitations", { headers: marc.headers });
  const invitation = (await invitations.json())[0];
  assert(invitation);
  assertEquals(
    (await app.request(`/me/participation-invitations/${invitation.invitation.id}`, {
      method: "PATCH",
      headers: marc.headers,
      body: JSON.stringify({ status: "accepted" }),
    })).status,
    200,
  );
  await reviewSubmission(app, adminHeaders, run.id, "verified");

  const clanA = await createClan(app, josef.headers, `alpha-${crypto.randomUUID().slice(0, 12)}`, "Alpha");
  const clanB = await createClan(app, marc.headers, `bravo-${crypto.randomUUID().slice(0, 12)}`, "Bravo");
  const split = await leaderboard(app);
  assertEquals(split.rules, {
    maxCountedRuns: 20,
    membership: "current",
    coopRunAttribution: "every_represented_clan",
    duplicatePolicy: "once_per_clan",
  });
  const alphaBefore = split.entries.find((entry: ClanEntry) => entry.clan.id === clanA.id);
  const bravoBefore = split.entries.find((entry: ClanEntry) => entry.clan.id === clanB.id);
  assert(alphaBefore && bravoBefore);
  assertEquals(alphaBefore.score, bravoBefore.score);
  assertEquals(alphaBefore.countedRuns[0].submissionId, run.id);
  assertEquals(bravoBefore.countedRuns[0].submissionId, run.id);

  // Membership is deliberately current and retroactive: moving Marc transfers his career runs.
  await db.delete(clanMembers).where(eq(clanMembers.userId, marc.userId));
  await db.insert(clanMembers).values({ clanId: clanA.id, userId: marc.userId, role: "member" });
  const together = await leaderboard(app);
  const alphaAfter = together.entries.find((entry: ClanEntry) => entry.clan.id === clanA.id);
  assert(alphaAfter);
  assertEquals(alphaAfter.countedRunCount, 1);
  assertEquals(alphaAfter.eligibleRunCount, 1);
  assertEquals(together.entries.some((entry: ClanEntry) => entry.clan.id === clanB.id), false);

  // More than twenty eligible records are capped after per-clan/per-submission deduplication.
  const seeded = await db.insert(submissions).values(Array.from({ length: 21 }, (_, index) => ({
    externalId: `test:clan-run:${crypto.randomUUID()}`,
    userId: josef.userId,
    submittedBy: josef.userId,
    competitorKey: `solo:${josef.userId}:${index}`,
    gameId: game.id,
    mapId: map.id,
    categoryId: category.id,
    categoryAssignmentId: assignment.id,
    playerCount: 1,
    scoreValue: 300 + index,
    status: "verified" as const,
    proofLevel: "manual_video" as const,
    verifiedAt: new Date(index + 1),
  }))).returning({ id: submissions.id });
  await db.insert(submissionParticipants).values(seeded.map((submission) => ({
    submissionId: submission.id,
    userId: josef.userId,
    role: "primary" as const,
    status: "accepted" as const,
    acceptanceSource: "submitter" as const,
  })));
  await db.insert(bestRecords).values(seeded.map((submission, index) => ({
    submissionId: submission.id,
    points: index + 1,
  })));

  const capped = await leaderboard(app);
  const alphaCapped = capped.entries.find((entry: ClanEntry) => entry.clan.id === clanA.id);
  assert(alphaCapped);
  assertEquals(alphaCapped.eligibleRunCount, 22);
  assertEquals(alphaCapped.countedRunCount, 20);
  assertEquals(
    alphaCapped.score,
    alphaCapped.countedRuns.reduce(
      (total: number, countedRun: { points: number }) => total + countedRun.points,
      0,
    ),
  );
  assertEquals((await app.request("/clans/leaderboard?player_count=5")).status, 400);
});

type ClanEntry = {
  clan: { id: number };
  score: number;
  eligibleRunCount: number;
  countedRunCount: number;
  countedRuns: Array<{ submissionId: number; points: number }>;
};

async function leaderboard(app: Awaited<ReturnType<typeof setup>>["app"]) {
  const response = await app.request("/clans/leaderboard");
  assertEquals(response.status, 200);
  return response.json();
}

async function createClan(
  app: Awaited<ReturnType<typeof setup>>["app"],
  headers: Headers,
  slug: string,
  name: string,
) {
  const response = await app.request("/clans", {
    method: "POST",
    headers,
    body: JSON.stringify({ slug, name }),
  });
  assertEquals(response.status, 201);
  return response.json();
}
