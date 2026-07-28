import { assert, assertEquals } from "@std/assert";
import { eq } from "drizzle-orm";
import {
  notifications,
  participationInvitations,
  submissionParticipants,
  submissions,
  users,
} from "../src/db/schema.ts";
import { runWorkerCycle } from "../src/modules/worker/cycle.ts";
import { createFileBlobStore } from "../src/infra/blob-store.ts";
import {
  createAuthenticatedUser,
  createCategory,
  createCategoryAssignment,
  createGame,
  createMap,
  reviewSubmissionResponse,
  setup,
  submitScore,
} from "./helpers.ts";

Deno.test("external teammates must accept before a submission can be moderated", async () => {
  const fixture = await setupSubmissionFixture();
  const submitter = await createAuthenticatedUser(fixture.app, fixture.db, ["ROLE_USER"]);
  const teammate = await createAuthenticatedUser(fixture.app, fixture.db, ["ROLE_USER"]);
  const submission = await submitScore(fixture.app, submitter.headers, {
    ...fixture.target,
    scoreValue: 80,
    participantUserIds: [submitter.userId, teammate.userId],
    proofLevel: "manual_video",
  });
  assertEquals(submission.status, "awaiting_participants");
  assertEquals(typeof submission.submissionGroupId, "string");

  const earlyReview = await reviewSubmissionResponse(
    fixture.app,
    fixture.adminHeaders,
    submission.id,
    "verified",
  );
  assertEquals(earlyReview.status, 409);
  assertEquals(await ownSubmissionCount(fixture.app, teammate.headers), 0);

  for (let scoreValue = 81; scoreValue <= 84; scoreValue++) {
    await submitScore(fixture.app, submitter.headers, {
      ...fixture.target,
      scoreValue,
      proofLevel: "manual_video",
    });
  }
  const overCapacity = await fixture.app.request("/submissions", {
    method: "POST",
    headers: submitter.headers,
    body: JSON.stringify({ ...fixture.target, scoreValue: 85, proofLevel: "manual_video" }),
  });
  assertEquals(overCapacity.status, 409);

  const invitations = await ownInvitations(fixture.app, teammate.headers);
  assertEquals(invitations.length, 1);
  assertEquals(invitations[0].group.submissions[0].id, submission.id);
  const accepted = await answerInvitation(
    fixture.app,
    teammate.headers,
    invitations[0].invitation.id,
    "accepted",
  );
  assertEquals(accepted.status, 200);
  assertEquals((await accepted.json()).submissions[0].status, "pending");
  assertEquals(await ownSubmissionCount(fixture.app, teammate.headers), 1);

  const reviewed = await reviewSubmissionResponse(
    fixture.app,
    fixture.adminHeaders,
    submission.id,
    "verified",
  );
  assertEquals(reviewed.status, 200);
  const participantRows = await fixture.db.select().from(submissionParticipants).where(
    eq(submissionParticipants.submissionId, submission.id),
  );
  assertEquals(
    participantRows.find((participant) => participant.userId === teammate.userId)?.acceptanceSource,
    "invitation",
  );

  const importedId = `imported-${crypto.randomUUID()}`;
  await fixture.db.insert(users).values({
    id: importedId,
    externalId: "zwr:player:unclaimed-test",
    name: "Imported Player",
    email: `${importedId}@import.local`,
  });
  const importedParticipant = await fixture.app.request("/submissions", {
    method: "POST",
    headers: submitter.headers,
    body: JSON.stringify({
      ...fixture.target,
      scoreValue: 86,
      participantUserIds: [submitter.userId, importedId],
      proofLevel: "manual_video",
    }),
  });
  assertEquals(importedParticipant.status, 400);
});

Deno.test("a rejection atomically cancels every leaderboard entry in the run group", async () => {
  const fixture = await setupSubmissionFixture(true);
  const submitter = await createAuthenticatedUser(fixture.app, fixture.db, ["ROLE_USER"]);
  const firstTeammate = await createAuthenticatedUser(fixture.app, fixture.db, ["ROLE_USER"]);
  const secondTeammate = await createAuthenticatedUser(fixture.app, fixture.db, ["ROLE_USER"]);
  const response = await fixture.app.request("/submission-groups", {
    method: "POST",
    headers: submitter.headers,
    body: JSON.stringify({
      gameId: fixture.target.gameId,
      mapId: fixture.target.mapId,
      participantUserIds: [submitter.userId, firstTeammate.userId, secondTeammate.userId],
      proofLevel: "manual_video",
      entries: [
        { categoryAssignmentId: fixture.target.categoryAssignmentId, scoreValue: 90 },
        { categoryAssignmentId: fixture.secondAssignmentId, scoreValue: 5_000, runDurationMs: 5_000 },
      ],
    }),
  });
  assertEquals(response.status, 201);
  const group = await response.json();
  assertEquals(
    group.submissions.every((submission: { status: string }) =>
      submission.status === "awaiting_participants"
    ),
    true,
  );

  const firstInvite = (await ownInvitations(fixture.app, firstTeammate.headers))[0];
  const secondInvite = (await ownInvitations(fixture.app, secondTeammate.headers))[0];
  const accepted = await answerInvitation(
    fixture.app,
    firstTeammate.headers,
    firstInvite.invitation.id,
    "accepted",
  );
  assertEquals(accepted.status, 200);
  assertEquals((await accepted.json()).submissions[0].status, "awaiting_participants");
  const rejected = await answerInvitation(
    fixture.app,
    secondTeammate.headers,
    secondInvite.invitation.id,
    "rejected",
  );
  assertEquals(rejected.status, 200);
  assertEquals(
    (await rejected.json()).submissions.every((submission: { status: string }) =>
      submission.status === "cancelled"
    ),
    true,
  );

  const storedSubmissions = await fixture.db.select().from(submissions).where(
    eq(submissions.submissionGroupId, group.submissionGroupId),
  );
  assertEquals(storedSubmissions.map((submission) => submission.status), ["cancelled", "cancelled"]);
  const storedInvitations = await fixture.db.select().from(participationInvitations).where(
    eq(participationInvitations.submissionGroupId, group.submissionGroupId),
  );
  assertEquals(storedInvitations.map((invitation) => invitation.status).sort(), ["accepted", "rejected"]);
});

Deno.test("same-clan teammates auto-accept unless their preference disables it", async () => {
  const fixture = await setupSubmissionFixture();
  const submitter = await createAuthenticatedUser(fixture.app, fixture.db, ["ROLE_USER"]);
  const teammate = await createAuthenticatedUser(fixture.app, fixture.db, ["ROLE_USER"]);
  const clan = await createClan(fixture.app, submitter.headers);
  const clanInvitation = await inviteClanMember(fixture.app, submitter.headers, clan.id, teammate.userId);
  const joined = await fixture.app.request(`/me/clan-invitations/${clanInvitation.id}`, {
    method: "PATCH",
    headers: teammate.headers,
    body: JSON.stringify({ status: "accepted" }),
  });
  assertEquals(joined.status, 200);

  const autoAccepted = await submitScore(fixture.app, submitter.headers, {
    ...fixture.target,
    scoreValue: 100,
    participantUserIds: [submitter.userId, teammate.userId],
    proofLevel: "manual_video",
  });
  assertEquals(autoAccepted.status, "pending");
  assertEquals((await ownInvitations(fixture.app, teammate.headers)).length, 0);
  const [autoParticipant] = await fixture.db.select().from(submissionParticipants).where(
    eq(submissionParticipants.userId, teammate.userId),
  );
  assert(autoParticipant);
  assertEquals(autoParticipant.acceptanceSource, "clan");
  assertEquals(autoParticipant.acceptanceClanId, clan.id);

  const preference = await fixture.app.request("/me/clan-preferences", {
    method: "PATCH",
    headers: teammate.headers,
    body: JSON.stringify({ autoAcceptClanRuns: false }),
  });
  assertEquals(preference.status, 200);
  const needsConsent = await submitScore(fixture.app, submitter.headers, {
    ...fixture.target,
    scoreValue: 101,
    participantUserIds: [submitter.userId, teammate.userId],
    proofLevel: "manual_video",
  });
  assertEquals(needsConsent.status, "awaiting_participants");
  assertEquals((await ownInvitations(fixture.app, teammate.headers)).length, 1);
});

Deno.test("an expired participation invitation cancels its run before returning a conflict", async () => {
  const fixture = await setupSubmissionFixture();
  const submitter = await createAuthenticatedUser(fixture.app, fixture.db, ["ROLE_USER"]);
  const teammate = await createAuthenticatedUser(fixture.app, fixture.db, ["ROLE_USER"]);
  const submission = await submitScore(fixture.app, submitter.headers, {
    ...fixture.target,
    scoreValue: 115,
    participantUserIds: [submitter.userId, teammate.userId],
    proofLevel: "manual_video",
  });
  const invitation = (await ownInvitations(fixture.app, teammate.headers))[0].invitation;
  await fixture.db.update(participationInvitations).set({ expiresAt: new Date(0) }).where(
    eq(participationInvitations.id, invitation.id),
  );

  const expired = await answerInvitation(fixture.app, teammate.headers, invitation.id, "accepted");
  assertEquals(expired.status, 409);
  const [storedSubmission] = await fixture.db.select().from(submissions).where(
    eq(submissions.id, submission.id),
  );
  const [storedInvitation] = await fixture.db.select().from(participationInvitations).where(
    eq(participationInvitations.id, invitation.id),
  );
  assert(storedSubmission && storedInvitation);
  assertEquals(storedSubmission.status, "cancelled");
  assertEquals(storedInvitation.status, "expired");
});

Deno.test("the worker automatically expires abandoned participation invitations", async () => {
  const fixture = await setupSubmissionFixture();
  const submitter = await createAuthenticatedUser(fixture.app, fixture.db, ["ROLE_USER"]);
  const teammate = await createAuthenticatedUser(fixture.app, fixture.db, ["ROLE_USER"]);
  const submission = await submitScore(fixture.app, submitter.headers, {
    ...fixture.target,
    scoreValue: 116,
    participantUserIds: [submitter.userId, teammate.userId],
    proofLevel: "manual_video",
  });
  const invitation = (await ownInvitations(fixture.app, teammate.headers))[0].invitation;
  await fixture.db.update(participationInvitations).set({ expiresAt: new Date(0) }).where(
    eq(participationInvitations.id, invitation.id),
  );

  const blobStore = createFileBlobStore(await Deno.makeTempDir({ prefix: "zwr-worker-blobs-" }));
  assertEquals(await runWorkerCycle(fixture.db, blobStore), {
    expiredParticipationGroups: 1,
    projectedEvents: 2,
    deletedClientRunBlobs: 0,
  });
  assertEquals(await runWorkerCycle(fixture.db, blobStore), {
    expiredParticipationGroups: 0,
    projectedEvents: 0,
    deletedClientRunBlobs: 0,
  });
  const [storedSubmission] = await fixture.db.select().from(submissions).where(
    eq(submissions.id, submission.id),
  );
  const [storedInvitation] = await fixture.db.select().from(participationInvitations).where(
    eq(participationInvitations.id, invitation.id),
  );
  assertEquals(storedSubmission?.status, "cancelled");
  assertEquals(storedInvitation?.status, "expired");
  assertEquals(
    (await fixture.db.select().from(notifications).where(eq(notifications.type, "participation.expired")))
      .length,
    2,
  );
});

Deno.test("concurrent teammate acceptances safely release one group to moderation", async () => {
  const fixture = await setupSubmissionFixture();
  const submitter = await createAuthenticatedUser(fixture.app, fixture.db, ["ROLE_USER"]);
  const first = await createAuthenticatedUser(fixture.app, fixture.db, ["ROLE_USER"]);
  const second = await createAuthenticatedUser(fixture.app, fixture.db, ["ROLE_USER"]);
  const submission = await submitScore(fixture.app, submitter.headers, {
    ...fixture.target,
    scoreValue: 120,
    participantUserIds: [submitter.userId, first.userId, second.userId],
    proofLevel: "manual_video",
  });
  const firstInvitation = (await ownInvitations(fixture.app, first.headers))[0];
  const secondInvitation = (await ownInvitations(fixture.app, second.headers))[0];
  const responses = await Promise.all([
    answerInvitation(fixture.app, first.headers, firstInvitation.invitation.id, "accepted"),
    answerInvitation(fixture.app, second.headers, secondInvitation.invitation.id, "accepted"),
  ]);
  assertEquals(responses.map((response) => response.status), [200, 200]);
  const [stored] = await fixture.db.select().from(submissions).where(eq(submissions.id, submission.id));
  assert(stored);
  assertEquals(stored.status, "pending");
});

async function setupSubmissionFixture(secondCategory = false) {
  const { app, db, headers: adminHeaders } = await setup(["ROLE_ADMIN"]);
  const game = await createGame(app, adminHeaders, `consent-${crypto.randomUUID()}`);
  const map = await createMap(app, adminHeaders, game.id, "consent-map");
  const category = await createCategory(app, adminHeaders, {
    slug: `consent-high-${crypto.randomUUID()}`,
    name: "Consent High Round",
    scoreType: "round",
    rankingDirection: "higher_is_better",
  });
  const assignment = await createCategoryAssignment(app, adminHeaders, {
    categoryId: category.id,
    gameId: game.id,
    mapId: map.id,
  });
  let secondAssignmentId = 0;
  if (secondCategory) {
    const speedrun = await createCategory(app, adminHeaders, {
      slug: `consent-speed-${crypto.randomUUID()}`,
      name: "Consent Speedrun",
      scoreType: "time",
      rankingDirection: "lower_is_better",
    });
    const secondAssignment = await createCategoryAssignment(app, adminHeaders, {
      categoryId: speedrun.id,
      gameId: game.id,
      mapId: map.id,
    });
    secondAssignmentId = secondAssignment.id;
  }
  return {
    app,
    db,
    adminHeaders,
    target: { gameId: game.id, mapId: map.id, categoryAssignmentId: assignment.id },
    secondAssignmentId,
  };
}

async function ownInvitations(app: Awaited<ReturnType<typeof setup>>["app"], headers: Headers) {
  const response = await app.request("/me/participation-invitations", { headers });
  assertEquals(response.status, 200);
  return response.json();
}

function answerInvitation(
  app: Awaited<ReturnType<typeof setup>>["app"],
  headers: Headers,
  invitationId: number,
  status: "accepted" | "rejected",
) {
  return app.request(`/me/participation-invitations/${invitationId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ status }),
  });
}

async function ownSubmissionCount(app: Awaited<ReturnType<typeof setup>>["app"], headers: Headers) {
  const response = await app.request("/me/submissions", { headers });
  assertEquals(response.status, 200);
  return (await response.json()).entries.length as number;
}

async function createClan(app: Awaited<ReturnType<typeof setup>>["app"], headers: Headers) {
  const response = await app.request("/clans", {
    method: "POST",
    headers,
    body: JSON.stringify({ slug: `coop-${crypto.randomUUID().slice(0, 8)}`, name: "Coop Clan" }),
  });
  assertEquals(response.status, 201);
  return response.json();
}

async function inviteClanMember(
  app: Awaited<ReturnType<typeof setup>>["app"],
  headers: Headers,
  clanId: number,
  userId: string,
) {
  const response = await app.request(`/clans/${clanId}/invitations`, {
    method: "POST",
    headers,
    body: JSON.stringify({ userId }),
  });
  assertEquals(response.status, 201);
  return response.json();
}
