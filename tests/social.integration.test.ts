import { assert, assertEquals } from "@std/assert";
import { and, eq } from "drizzle-orm";
import { feedEntries, notifications, outboxEvents } from "../src/db/schema.ts";
import { projectPendingOutbox } from "../src/modules/social/outbox.ts";
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

Deno.test("follows project verified runs into a deduplicated feed and personal notifications", async () => {
  const { app, db, headers: adminHeaders } = await setup(["ROLE_ADMIN"]);
  const runner = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const follower = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const game = await createGame(app, adminHeaders, `social-${crypto.randomUUID()}`);
  const map = await createMap(app, adminHeaders, game.id, "social-map");
  const category = await createCategory(app, adminHeaders, {
    slug: `social-high-${crypto.randomUUID()}`,
    name: "Social High Round",
    scoreType: "round",
    rankingDirection: "higher_is_better",
  });
  const assignment = await createCategoryAssignment(app, adminHeaders, {
    categoryId: category.id,
    gameId: game.id,
    mapId: map.id,
  });

  const playerFollow = await follow(app, follower.headers, "user", runner.userId);
  assertEquals(playerFollow.status, 201);
  const mapFollow = await follow(app, follower.headers, "map", String(map.id));
  assertEquals(mapFollow.status, 201);
  const exactCategoryFollow = await follow(
    app,
    follower.headers,
    "map_category",
    `${map.id}:${assignment.id}`,
  );
  assertEquals(exactCategoryFollow.status, 201);
  assertEquals((await follow(app, follower.headers, "map_category", `${map.id}:999999999`)).status, 404);
  assertEquals((await follow(app, follower.headers, "user", runner.userId)).status, 409);
  assertEquals((await follow(app, follower.headers, "user", follower.userId)).status, 400);
  assertEquals((await follow(app, follower.headers, "map", "999999999")).status, 404);

  const listed = await app.request("/me/follows", { headers: follower.headers });
  assertEquals(listed.status, 200);
  assertEquals((await listed.json()).length, 3);

  const submission = await submitScore(app, runner.headers, {
    gameId: game.id,
    mapId: map.id,
    categoryAssignmentId: assignment.id,
    scoreValue: 100,
    proofLevel: "manual_video",
  });
  await reviewSubmission(app, adminHeaders, submission.id, "verified");

  // Simulate concurrent workers retrying the same committed event.
  await Promise.all([projectPendingOutbox(db), projectPendingOutbox(db)]);
  const event = await db.select().from(outboxEvents).where(
    eq(outboxEvents.eventKey, `submission.reviewed:${submission.id}:verified`),
  );
  assertEquals(event.length, 1);
  const projectedFeed = await db.select().from(feedEntries).where(and(
    eq(feedEntries.viewerUserId, follower.userId),
    eq(feedEntries.outboxEventId, event[0]!.id),
  ));
  assertEquals(projectedFeed.length, 1);

  const feed = await app.request("/me/feed", { headers: follower.headers });
  assertEquals(feed.status, 200);
  const feedBody = await feed.json();
  assertEquals(feedBody.entries.length, 1);
  assertEquals(feedBody.entries[0].type, "submission.verified");
  assertEquals(feedBody.entries[0].payload.submissionId, submission.id);
  assertEquals(feedBody.hasMore, false);

  const runnerNotifications = await app.request("/me/notifications?unread=true", {
    headers: runner.headers,
  });
  assertEquals(runnerNotifications.status, 200);
  const notificationBody = await runnerNotifications.json();
  assertEquals(notificationBody.entries.length, 1);
  assertEquals(notificationBody.entries[0].type, "submission.verified");
  const notificationId = notificationBody.entries[0].id;

  const unread = await app.request("/me/notifications/unread-count", { headers: runner.headers });
  assertEquals(await unread.json(), { count: 1 });
  const read = await app.request(`/me/notifications/${notificationId}/read`, {
    method: "PATCH",
    headers: runner.headers,
  });
  assertEquals(read.status, 200);
  assert((await read.json()).readAt);
  const readAgain = await app.request(`/me/notifications/${notificationId}/read`, {
    method: "PATCH",
    headers: follower.headers,
  });
  assertEquals(readAgain.status, 404);
  const readAll = await app.request("/me/notifications/read-all", {
    method: "POST",
    headers: runner.headers,
  });
  assertEquals(await readAll.json(), { updated: 0 });

  const removed = await app.request(`/me/follows/user/${runner.userId}`, {
    method: "DELETE",
    headers: follower.headers,
  });
  assertEquals(removed.status, 200);
  assertEquals(
    (await db.select().from(notifications).where(eq(notifications.recipientUserId, runner.userId))).length,
    1,
  );
  assertEquals(
    (await app.request(`/me/follows/user/${runner.userId}`, {
      method: "DELETE",
      headers: follower.headers,
    })).status,
    404,
  );
});

Deno.test("participation invitations and responses notify their exact recipients", async () => {
  const { app, db } = await setup();
  const submitter = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const teammate = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const admin = await createAuthenticatedUser(app, db, ["ROLE_ADMIN"]);
  const game = await createGame(app, admin.headers, `invite-social-${crypto.randomUUID()}`);
  const map = await createMap(app, admin.headers, game.id, "invite-map");
  const category = await createCategory(app, admin.headers, {
    slug: `invite-social-${crypto.randomUUID()}`,
    name: "Invite Category",
    scoreType: "round",
    rankingDirection: "higher_is_better",
  });
  const assignment = await createCategoryAssignment(app, admin.headers, {
    categoryId: category.id,
    gameId: game.id,
    mapId: map.id,
  });
  const submission = await submitScore(app, submitter.headers, {
    gameId: game.id,
    mapId: map.id,
    categoryAssignmentId: assignment.id,
    scoreValue: 20,
    participantUserIds: [submitter.userId, teammate.userId],
    proofLevel: "manual_video",
  });

  const teammateNotifications = await app.request("/me/notifications", { headers: teammate.headers });
  const inviteNotice = (await teammateNotifications.json()).entries;
  assertEquals(inviteNotice.length, 1);
  assertEquals(inviteNotice[0].type, "participation.invited");

  const invitations = await app.request("/me/participation-invitations", { headers: teammate.headers });
  const invitation = (await invitations.json())[0].invitation;
  const response = await app.request(`/me/participation-invitations/${invitation.id}`, {
    method: "PATCH",
    headers: teammate.headers,
    body: JSON.stringify({ status: "accepted" }),
  });
  assertEquals(response.status, 200);
  const submitterNotifications = await app.request("/me/notifications", { headers: submitter.headers });
  const responseNotice = (await submitterNotifications.json()).entries;
  assertEquals(responseNotice.length, 1);
  assertEquals(responseNotice[0].type, "participation.accepted");
  assertEquals(responseNotice[0].payload.submissionGroupId, submission.submissionGroupId);
});

function follow(
  app: Awaited<ReturnType<typeof setup>>["app"],
  headers: Headers,
  targetType: string,
  targetId: string,
) {
  return app.request("/me/follows", {
    method: "POST",
    headers,
    body: JSON.stringify({ targetType, targetId }),
  });
}
