import { assert, assertEquals } from "@std/assert";
import { eq } from "drizzle-orm";
import { createTestDatabase } from "../src/db/test-database.ts";
import { accounts, follows, sessions, users } from "../src/db/schema.ts";
import { createApp } from "../src/http/app.ts";
import type { AccountEmail } from "../src/infra/email.ts";
import { createVersionedTestApp } from "./helpers.ts";

Deno.test("registration and password recovery complete the account lifecycle", async () => {
  const { db, ready } = createTestDatabase();
  await ready;
  const email = new CapturingEmail();
  const app = createVersionedTestApp(createApp({
    db,
    accountEmail: email,
    frontendUrl: "https://frontend.example",
  }));
  const address = `${crypto.randomUUID()}@example.test`;

  const signUp = await app.request("/auth/sign-up", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: address, password: "initial-password-123", name: "Initial name" }),
  });
  assertEquals(signUp.status, 200);
  const signUpBody = await signUp.json();
  assertEquals(email.messages.length, 0);
  const [createdUser] = await db.select().from(users).where(eq(users.id, signUpBody.user.id));
  assertEquals(createdUser?.emailVerified, true);

  const signedIn = await signIn(app, address, "initial-password-123");
  assertEquals(signedIn.status, 200);

  const resetRequested = await app.request("/auth/request-password-reset", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: address, redirectTo: "https://frontend.example/reset-password" }),
  });
  assertEquals(resetRequested.status, 200);
  const resetMessage = email.messages.find((message) => message.subject.includes("Reset"));
  assert(resetMessage);
  const resetToken = tokenFrom(resetMessage.text);
  const reset = await app.request("/auth/reset-password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: resetToken, newPassword: "replacement-password-123" }),
  });
  assertEquals(reset.status, 200);
  assertEquals((await signIn(app, address, "initial-password-123")).status, 401);
  const replacementSignIn = await signIn(app, address, "replacement-password-123");
  assertEquals(replacementSignIn.status, 200);
  const authorization = bearerFrom(replacementSignIn);

  const updated = await app.request("/me/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization },
    body: JSON.stringify({
      name: "Final name",
      profileColor: "#E45735",
      profileGradientColor: "#3B1111",
      profileGradientAngle: 210,
      countryCode: "fr",
    }),
  });
  assertEquals(updated.status, 200);
  const updatedProfile = await updated.json();
  assertEquals(updatedProfile.name, "Final name");
  assertEquals(updatedProfile.profileColor, "#e45735");
  assertEquals(updatedProfile.profileGradientColor, "#3b1111");
  assertEquals(updatedProfile.profileGradientAngle, 210);
  assertEquals(updatedProfile.countryCode, "FR");
  assertEquals(updatedProfile.image, null);

  const externalImage = await app.request("/me/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization },
    body: JSON.stringify({ image: "https://tracking.example/pixel.gif" }),
  });
  assertEquals(externalImage.status, 400);

  const adminCountryChange = await app.request("/me/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization },
    body: JSON.stringify({ countryCode: "US" }),
  });
  assertEquals(adminCountryChange.status, 200);
  await db.update(users).set({ roles: ["ROLE_USER"] }).where(eq(users.id, signUpBody.user.id));
  const lockedCountry = await app.request("/me/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization },
    body: JSON.stringify({ countryCode: "CA" }),
  });
  assertEquals(lockedCountry.status, 409);
  await db.update(users).set({ countryChangedAt: new Date("2026-05-01T00:00:00Z") })
    .where(eq(users.id, signUpBody.user.id));
  const changedCountry = await app.request("/me/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization },
    body: JSON.stringify({ countryCode: "CA" }),
  });
  assertEquals(changedCountry.status, 200);
  assertEquals((await changedCountry.json()).countryCode, "CA");
  await db.update(users).set({ roles: ["ROLE_USER", "ROLE_ADMIN"] }).where(eq(users.id, signUpBody.user.id));

  const createdBadge = await app.request("/admin/badges", {
    method: "POST",
    headers: { "content-type": "application/json", authorization },
    body: JSON.stringify({
      slug: `e2e-badge-${crypto.randomUUID().slice(0, 8)}`,
      name: "Test badge",
      color: "#123456",
    }),
  });
  assertEquals(createdBadge.status, 201);
  const badge = await createdBadge.json();
  assertEquals(
    (await app.request(`/admin/users/${signUpBody.user.id}/badges/${badge.id}`, {
      method: "PUT",
      headers: { authorization },
    })).status,
    200,
  );
  const publicBadges = await (await app.request(`/users/${signUpBody.user.id}/badges`)).json();
  assertEquals(publicBadges.some((entry: { id: number }) => entry.id === badge.id), true);

  const invalidColor = await app.request("/me/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization },
    body: JSON.stringify({ profileColor: "red; background:url(evil)" }),
  });
  assertEquals(invalidColor.status, 400);

  const deniedAdminDeletion = await app.request("/me/account", {
    method: "DELETE",
    headers: { "content-type": "application/json", authorization },
    body: JSON.stringify({ confirmation: "DELETE", password: "replacement-password-123" }),
  });
  assertEquals(deniedAdminDeletion.status, 409);
  await db.update(users).set({ roles: ["ROLE_USER"] }).where(eq(users.id, signUpBody.user.id));

  const deniedDeletion = await app.request("/me/account", {
    method: "DELETE",
    headers: { "content-type": "application/json", authorization },
    body: JSON.stringify({ confirmation: "DELETE", password: "wrong-password" }),
  });
  assertEquals(deniedDeletion.status, 400);
  assertEquals((await deniedDeletion.json()).code, "validation_failed");
  await db.insert(follows).values({
    followerUserId: signUpBody.user.id,
    targetType: "map",
    targetId: "1",
  });

  const deleted = await app.request("/me/account", {
    method: "DELETE",
    headers: { "content-type": "application/json", authorization },
    body: JSON.stringify({ confirmation: "DELETE", password: "replacement-password-123" }),
  });
  assertEquals(deleted.status, 200);
  const [anonymized] = await db.select().from(users).where(eq(users.email, address));
  assertEquals(anonymized, undefined);
  const deletedUsers = await db.select().from(users).where(eq(users.name, "Deleted user"));
  assertEquals(deletedUsers.length, 1);
  assert(deletedUsers[0]!.deletedAt instanceof Date);
  assertEquals((await db.select().from(accounts).where(eq(accounts.userId, deletedUsers[0]!.id))).length, 0);
  assertEquals((await db.select().from(sessions).where(eq(sessions.userId, deletedUsers[0]!.id))).length, 0);
  assertEquals(
    (await db.select().from(follows).where(eq(follows.followerUserId, deletedUsers[0]!.id))).length,
    0,
  );
  const collection = await app.request("/users?search=Deleted");
  assertEquals((await collection.json()).entries.length, 0);
});

class CapturingEmail implements AccountEmail {
  messages: Array<{ to: string; subject: string; text: string; html?: string }> = [];

  send(message: { to: string; subject: string; text: string; html?: string }) {
    this.messages.push(message);
    return Promise.resolve();
  }
}

function signIn(app: ReturnType<typeof createVersionedTestApp>, email: string, password: string) {
  return app.request("/auth/sign-in", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

function tokenFrom(text: string) {
  const match = /[?&]token=([^\s&]+)/.exec(text);
  assert(match?.[1]);
  return decodeURIComponent(match[1]);
}

function bearerFrom(response: Response) {
  const token = response.headers.get("set-auth-token");
  assert(token);
  return `Bearer ${token}`;
}
