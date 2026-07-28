import { assert, assertEquals } from "@std/assert";
import { eq } from "drizzle-orm";
import { clanAuditEvents, clanInvitations, clanMembers, users } from "../src/db/schema.ts";
import { createAuthenticatedUser, setup } from "./helpers.ts";

Deno.test("clan lifecycle enforces invitations, roles, ownership and audit history", async () => {
  const { app, db } = await setup();
  const owner = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const member = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const outsider = await createAuthenticatedUser(app, db, ["ROLE_USER"]);

  const clan = await createClan(app, owner.headers, "night-watch", "Night Watch");
  assertEquals(clan.members.length, 1);
  assertEquals(clan.members[0].role, "owner");

  const ownClan = await app.request("/me/clan", { headers: owner.headers });
  assertEquals(ownClan.status, 200);
  assertEquals((await ownClan.json()).clan.id, clan.id);
  const publicClan = await app.request("/clans/night-watch");
  assertEquals(publicClan.status, 200);

  const invite = await inviteUser(app, owner.headers, clan.id, member.userId);
  const managedInvites = await app.request(`/clans/${clan.id}/invitations`, { headers: owner.headers });
  assertEquals(managedInvites.status, 200);
  assertEquals((await managedInvites.json())[0].invitation.id, invite.id);
  const memberInvites = await app.request("/me/clan-invitations", { headers: member.headers });
  assertEquals(memberInvites.status, 200);
  assertEquals((await memberInvites.json()).length, 1);

  const accepted = await app.request(`/me/clan-invitations/${invite.id}`, {
    method: "PATCH",
    headers: member.headers,
    body: JSON.stringify({ status: "accepted" }),
  });
  assertEquals(accepted.status, 200);
  assertEquals((await accepted.json()).clan.members.length, 2);

  const promote = await app.request(`/clans/${clan.id}/members/${member.userId}/role`, {
    method: "PATCH",
    headers: owner.headers,
    body: JSON.stringify({ role: "admin" }),
  });
  assertEquals(promote.status, 200);
  assertEquals((await promote.json()).role, "admin");

  const outsiderInvite = await inviteUser(app, member.headers, clan.id, outsider.userId);
  const rejected = await app.request(`/me/clan-invitations/${outsiderInvite.id}`, {
    method: "PATCH",
    headers: outsider.headers,
    body: JSON.stringify({ status: "rejected" }),
  });
  assertEquals(rejected.status, 200);
  assertEquals((await rejected.json()).invitation.status, "rejected");

  const transfer = await app.request(`/clans/${clan.id}/owner`, {
    method: "PATCH",
    headers: owner.headers,
    body: JSON.stringify({ userId: member.userId }),
  });
  assertEquals(transfer.status, 200);
  const transferred = await transfer.json();
  assertEquals(
    transferred.members.find((entry: { user: { id: string } }) => entry.user.id === member.userId).role,
    "owner",
  );

  const ownerCannotLeave = await app.request(`/clans/${clan.id}/members/${member.userId}`, {
    method: "DELETE",
    headers: member.headers,
  });
  assertEquals(ownerCannotLeave.status, 409);
  const removeFormerOwner = await app.request(`/clans/${clan.id}/members/${owner.userId}`, {
    method: "DELETE",
    headers: member.headers,
  });
  assertEquals(removeFormerOwner.status, 200);

  const preferences = await app.request("/me/clan-preferences", {
    method: "PATCH",
    headers: member.headers,
    body: JSON.stringify({ autoAcceptClanRuns: false }),
  });
  assertEquals(preferences.status, 200);
  assertEquals(await preferences.json(), { autoAcceptClanRuns: false });
  const readPreferences = await app.request("/me/clan-preferences", { headers: member.headers });
  assertEquals(readPreferences.status, 200);
  assertEquals(await readPreferences.json(), { autoAcceptClanRuns: false });
  const [storedUser] = await db.select().from(users).where(eq(users.id, member.userId));
  assert(storedUser);
  assertEquals(storedUser.autoAcceptClanRuns, false);

  const audit = await app.request(`/clans/${clan.id}/audit-events`, { headers: member.headers });
  assertEquals(audit.status, 200);
  const eventTypes = (await audit.json()).map((event: { type: string }) => event.type);
  assertEquals(eventTypes.includes("ownership_transferred"), true);
  assertEquals(eventTypes.includes("member_removed"), true);
});

Deno.test("clan permissions and membership uniqueness reject invalid management", async () => {
  const { app, db } = await setup();
  const owner = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const member = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const outsider = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const clan = await createClan(app, owner.headers, "keepers", "Keepers");

  const duplicateClan = await app.request("/clans", {
    method: "POST",
    headers: owner.headers,
    body: JSON.stringify({ slug: "second", name: "Second" }),
  });
  assertEquals(duplicateClan.status, 409);

  const unauthorizedInvite = await app.request(`/clans/${clan.id}/invitations`, {
    method: "POST",
    headers: outsider.headers,
    body: JSON.stringify({ userId: member.userId }),
  });
  assertEquals(unauthorizedInvite.status, 404);

  const invite = await inviteUser(app, owner.headers, clan.id, member.userId);
  const duplicateInvite = await app.request(`/clans/${clan.id}/invitations`, {
    method: "POST",
    headers: owner.headers,
    body: JSON.stringify({ userId: member.userId }),
  });
  assertEquals(duplicateInvite.status, 409);
  const hiddenInvite = await app.request(`/me/clan-invitations/${invite.id}`, {
    method: "PATCH",
    headers: outsider.headers,
    body: JSON.stringify({ status: "accepted" }),
  });
  assertEquals(hiddenInvite.status, 404);

  const revoked = await app.request(`/clans/${clan.id}/invitations/${invite.id}`, {
    method: "DELETE",
    headers: owner.headers,
  });
  assertEquals(revoked.status, 200);
  assertEquals((await revoked.json()).status, "revoked");
});

Deno.test("concurrent clan acceptances leave exactly one active membership", async () => {
  const { app, db } = await setup();
  const firstOwner = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const secondOwner = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const invitee = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const firstClan = await createClan(app, firstOwner.headers, "first-clan", "First Clan");
  const secondClan = await createClan(app, secondOwner.headers, "second-clan", "Second Clan");
  const firstInvite = await inviteUser(app, firstOwner.headers, firstClan.id, invitee.userId);
  const secondInvite = await inviteUser(app, secondOwner.headers, secondClan.id, invitee.userId);

  const responses = await Promise.all([
    respondAccepted(app, invitee.headers, firstInvite.id),
    respondAccepted(app, invitee.headers, secondInvite.id),
  ]);
  assertEquals(responses.map((response) => response.status).sort(), [200, 409]);

  const memberships = await db.select().from(clanMembers).where(eq(clanMembers.userId, invitee.userId));
  assertEquals(memberships.length, 1);
  const invitations = await db.select().from(clanInvitations).where(
    eq(clanInvitations.inviteeUserId, invitee.userId),
  );
  assertEquals(invitations.filter((invitation) => invitation.status === "accepted").length, 1);
  assertEquals(invitations.filter((invitation) => invitation.status === "revoked").length, 1);
  assertEquals((await db.select().from(clanAuditEvents)).length >= 5, true);
});

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

async function inviteUser(
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

function respondAccepted(
  app: Awaited<ReturnType<typeof setup>>["app"],
  headers: Headers,
  invitationId: number,
) {
  return app.request(`/me/clan-invitations/${invitationId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ status: "accepted" }),
  });
}
