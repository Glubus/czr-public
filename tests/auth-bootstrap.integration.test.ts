import { assertEquals } from "@std/assert";
import { inArray } from "drizzle-orm";
import { createTestDatabase } from "../src/db/test-database.ts";
import { users } from "../src/db/schema.ts";
import { createApp } from "../src/http/app.ts";

Deno.test("exactly the first registered account becomes admin under concurrent signups", async () => {
  const { db, ready } = createTestDatabase();
  await ready;
  const app = createApp({ db });

  await db.insert(users).values({
    id: crypto.randomUUID(),
    externalId: "zwr:player:bootstrap-fixture",
    name: "Imported player",
    email: "bootstrap-fixture@import.local",
    emailVerified: true,
  });

  const registrations = await Promise.all([
    signUp(app, "first-bootstrap@example.test", "First"),
    signUp(app, "second-bootstrap@example.test", "Second"),
  ]);
  assertEquals(registrations.map((response) => response.status), [200, 200]);

  const registered = await db.select({ email: users.email, roles: users.roles }).from(users).where(
    inArray(users.email, ["first-bootstrap@example.test", "second-bootstrap@example.test"]),
  );
  assertEquals(registered.length, 2);
  assertEquals(registered.filter((user) => user.roles.includes("ROLE_ADMIN")).length, 1);
  assertEquals(registered.every((user) => user.roles.includes("ROLE_USER")), true);
});

function signUp(app: ReturnType<typeof createApp>, email: string, name: string) {
  return app.request("/v1/auth/sign-up", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "bootstrap-password-123", name }),
  });
}
