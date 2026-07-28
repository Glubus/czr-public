import { assert, assertEquals } from "@std/assert";
import { eq } from "drizzle-orm";
import type { Role } from "../src/auth/session.ts";
import type { Database } from "../src/db/client.ts";
import { users } from "../src/db/schema.ts";
import { createTestDatabase } from "../src/db/test-database.ts";
import { createApp } from "../src/http/app.ts";
import { createFileBlobStore } from "../src/infra/blob-store.ts";

export type App = ReturnType<typeof createApp>;

export async function setup(
  roles?: ReadonlyArray<Role>,
): Promise<{ app: App; db: Database; headers: Headers; blobRoot: string }> {
  const { db, ready } = createTestDatabase();
  await ready;
  const blobRoot = await Deno.makeTempDir({ prefix: "zwr-client-blobs-" });
  const app = createVersionedTestApp(createApp({ db, blobStore: createFileBlobStore(blobRoot) }));
  if (!roles) {
    return { app, db, headers: new Headers({ "content-type": "application/json" }), blobRoot };
  }

  const authenticated = await createAuthenticatedUser(app, db, roles);
  return { app, db, headers: authenticated.headers, blobRoot };
}

/** The production API deliberately has no legacy routes; tests use its v1 contract by default. */
export function createVersionedTestApp(api: App): App {
  return new Proxy(api, {
    get(target, property, receiver) {
      if (property !== "request") return Reflect.get(target, property, receiver);
      return (path: string, init?: RequestInit) =>
        target.request(
          path === "/health" || path === "/metrics" || path.startsWith("/docs") ? path : `/v1${path}`,
          init,
        );
    },
  });
}

export async function createAuthenticatedUser(
  app: App,
  db: Database,
  roles: ReadonlyArray<Role>,
) {
  const email = `${crypto.randomUUID()}@example.test`;
  const password = "test-password-123";
  const response = await app.request("/auth/sign-up", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, name: "Test User" }),
  });
  assertEquals(response.status, 200);
  const body = await response.json();
  await db.update(users).set({ roles: [...roles], emailVerified: true }).where(eq(users.id, body.user.id));

  const signIn = await app.request("/auth/sign-in", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assertEquals(signIn.status, 200);
  const token = signIn.headers.get("set-auth-token");
  assert(token);
  return {
    headers: new Headers({ "content-type": "application/json", authorization: `Bearer ${token}` }),
    userId: body.user.id as string,
  };
}

export async function createGame(app: App, headers: HeadersInit, slug: string) {
  const response = await app.request("/admin/games", {
    method: "POST",
    headers,
    body: JSON.stringify({
      slug,
      name: slug.toUpperCase(),
      shortName: slug.toUpperCase(),
      releaseYear: 2010,
    }),
  });
  assertEquals(response.status, 201);
  return response.json();
}

export async function createMap(app: App, headers: HeadersInit, gameId: number, slug: string) {
  const response = await app.request("/admin/maps", {
    method: "POST",
    headers,
    body: JSON.stringify({ gameId, slug, name: slug, type: "custom", status: "published" }),
  });
  assertEquals(response.status, 201);
  return response.json();
}

export async function createCategory(app: App, headers: HeadersInit, payload: Record<string, unknown>) {
  const response = await app.request("/admin/categories", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  assertEquals(response.status, 201);
  return response.json();
}

export async function createCategoryAssignment(
  app: App,
  headers: HeadersInit,
  payload: Record<string, unknown>,
) {
  const response = await app.request("/admin/category-assignments", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  assertEquals(response.status, 201);
  return response.json();
}

export async function submitScore(app: App, headers: HeadersInit, payload: Record<string, unknown>) {
  const response = await app.request("/submissions", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  assertEquals(response.status, 201);
  return response.json();
}

export async function reviewSubmission(
  app: App,
  headers: HeadersInit,
  submissionId: number,
  status: "verified" | "rejected",
  reviewNote?: string,
) {
  const response = await reviewSubmissionResponse(app, headers, submissionId, status, reviewNote);
  assertEquals(response.status, 200);
  return response.json();
}

export function reviewSubmissionResponse(
  app: App,
  headers: HeadersInit,
  submissionId: number,
  status: "verified" | "rejected",
  reviewNote?: string,
) {
  return app.request(`/admin/submissions/${submissionId}/status`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ status, reviewNote }),
  });
}
