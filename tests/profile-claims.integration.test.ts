import { assert, assertEquals } from "@std/assert";
import { eq } from "drizzle-orm";
import { createTestDatabase } from "../src/db/test-database.ts";
import {
  bestRecords,
  categories,
  categoryAssignments,
  follows,
  games,
  maps,
  personalRuns,
  profileClaims,
  submissionParticipants,
  submissions,
  users,
} from "../src/db/schema.ts";
import { createApp } from "../src/http/app.ts";
import { createAuthenticatedUser, createVersionedTestApp } from "./helpers.ts";

Deno.test("a moderator can atomically merge a claimed imported profile", async () => {
  const { db, ready } = createTestDatabase();
  await ready;
  await seedClaimableProfile(db);
  const app = createVersionedTestApp(createApp({ db }));
  const claimant = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const moderator = await createAuthenticatedUser(app, db, ["ROLE_USER", "ROLE_MODERATOR"]);
  const follower = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const [imported] = await db.select().from(users).where(eq(users.externalId, "zwr:player:42"));
  assert(imported);
  const [importedSubmission] = await db.select().from(submissions).where(
    eq(submissions.externalId, "zwr:submission:99"),
  );
  assert(importedSubmission);
  assert(importedSubmission.categoryAssignmentId);
  const [personalRun] = await db.insert(personalRuns).values({
    userId: imported.id,
    gameId: importedSubmission.gameId,
    mapId: importedSubmission.mapId,
    categoryAssignmentId: importedSubmission.categoryAssignmentId,
    scoreValue: importedSubmission.scoreValue,
  }).returning();
  assert(personalRun);
  const followed = await app.request("/me/follows", {
    method: "POST",
    headers: follower.headers,
    body: JSON.stringify({ targetType: "user", targetId: imported.id }),
  });
  assertEquals(followed.status, 201);

  const created = await app.request("/profile-claims", {
    method: "POST",
    headers: claimant.headers,
    body: JSON.stringify({
      profileUserId: imported.id,
      proofUrl: "https://youtube.example/@imported-player",
      message: "The channel links back to my account.",
    }),
  });
  assertEquals(created.status, 201);
  const claim = await created.json();

  const duplicate = await app.request("/profile-claims", {
    method: "POST",
    headers: moderator.headers,
    body: JSON.stringify({ profileUserId: imported.id, proofUrl: "https://twitch.example/imported-player" }),
  });
  assertEquals(duplicate.status, 409);

  const reviewed = await app.request(`/admin/profile-claims/${claim.id}/status`, {
    method: "PATCH",
    headers: moderator.headers,
    body: JSON.stringify({ status: "approved", reviewNote: null }),
  });
  assertEquals(reviewed.status, 200);

  assertEquals((await db.select().from(users).where(eq(users.id, imported.id))).length, 0);
  const [owner] = await db.select().from(users).where(eq(users.id, claimant.userId));
  assertEquals(owner?.externalId, "zwr:player:42");
  const [submission] = await db.select().from(submissions).where(
    eq(submissions.externalId, "zwr:submission:99"),
  );
  assertEquals(submission?.userId, claimant.userId);
  assertEquals(submission?.competitorKey, `team:${claimant.userId}`);
  const [participant] = await db.select().from(submissionParticipants).where(
    eq(submissionParticipants.submissionId, submission!.id),
  );
  assertEquals(participant?.userId, claimant.userId);
  assertEquals(participant?.isPersonalBest, true);
  const [storedClaim] = await db.select().from(profileClaims).where(eq(profileClaims.id, claim.id));
  assertEquals(storedClaim?.status, "approved");
  assertEquals(storedClaim?.profileUserId, null);
  const [transferredFollow] = await db.select().from(follows).where(
    eq(follows.followerUserId, follower.userId),
  );
  assertEquals(transferredFollow?.targetId, claimant.userId);
  const [transferredPersonalRun] = await db.select().from(personalRuns).where(
    eq(personalRuns.id, personalRun.id),
  );
  assertEquals(transferredPersonalRun?.userId, claimant.userId);

  const records = await app.request(`/users/${claimant.userId}/records`);
  assertEquals(records.status, 200);
  assertEquals((await records.json()).entries.length, 1);

  const secondReview = await app.request(`/admin/profile-claims/${claim.id}/status`, {
    method: "PATCH",
    headers: moderator.headers,
    body: JSON.stringify({ status: "rejected" }),
  });
  assertEquals(secondReview.status, 409);
});

Deno.test("claim routes reject anonymous users and non-moderators", async () => {
  const { db, ready } = createTestDatabase();
  await ready;
  const app = createVersionedTestApp(createApp({ db }));
  const user = await createAuthenticatedUser(app, db, ["ROLE_USER"]);

  assertEquals((await app.request("/profile-claims", { method: "POST", body: "{}" })).status, 401);
  assertEquals((await app.request("/admin/profile-claims", { headers: user.headers })).status, 403);
});

async function seedClaimableProfile(db: ReturnType<typeof createTestDatabase>["db"]) {
  const importedUserId = crypto.randomUUID();
  const [game] = await db.insert(games).values({
    slug: "bo3",
    name: "Black Ops III",
    shortName: "BO3",
  }).returning();
  const [map] = await db.insert(maps).values({
    gameId: game!.id,
    slug: "shadows-of-evil",
    name: "Shadows of Evil",
    type: "official",
    status: "published",
  }).returning();
  const [category] = await db.insert(categories).values({
    slug: "high-round",
    name: "High Round",
    scoreType: "round",
    rankingDirection: "higher_is_better",
  }).returning();
  const [assignment] = await db.insert(categoryAssignments).values({
    gameId: game!.id,
    mapId: map!.id,
    categoryId: category!.id,
    specificRules: { playerCount: 1 },
  }).returning();
  await db.insert(users).values({
    id: importedUserId,
    externalId: "zwr:player:42",
    name: "Imported Player",
    email: "zwr-player-42@import.local",
    roles: ["ROLE_USER"],
  });
  const [submission] = await db.insert(submissions).values({
    externalId: "zwr:submission:99",
    userId: importedUserId,
    competitorKey: `team:${importedUserId}`,
    gameId: game!.id,
    mapId: map!.id,
    categoryId: category!.id,
    categoryAssignmentId: assignment!.id,
    scoreValue: 100,
    platform: "pc",
    status: "verified",
    proofLevel: "manual_video",
    proofUrl: "https://youtube.example/watch/99",
    verifiedAt: new Date("2026-01-02T00:00:00.000Z"),
  }).returning();
  await db.insert(submissionParticipants).values({
    submissionId: submission!.id,
    userId: importedUserId,
    role: "primary",
    status: "accepted",
    acceptanceSource: "imported",
    isPersonalBest: true,
  });
  await db.insert(bestRecords).values({ submissionId: submission!.id, points: 100 });
}
