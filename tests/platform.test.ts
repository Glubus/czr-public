import { assert, assertEquals } from "@std/assert";
import { createTestDatabase } from "../src/db/test-database.ts";
import { createApp } from "../src/http/app.ts";
import { openApiDocument, publicOpenApiDocument, publicOpenApiPaths } from "../src/http/openapi.ts";
import { v1RouteContracts } from "../src/http/v1-contracts.ts";
import type { RedisStore } from "../src/infra/redis.ts";
import { setup } from "./helpers.ts";

Deno.test("health checks PostgreSQL and Redis", async () => {
  const { db, ready } = createTestDatabase();
  await ready;
  const redis: RedisStore = {
    incrementWindow: () => Promise.resolve({ count: 1, ttlMs: 1_000 }),
    get: () => Promise.resolve(null),
    set: () => Promise.resolve(),
    increment: () => Promise.resolve(1),
    ping: () => Promise.resolve(true),
    close: () => Promise.resolve(),
  };
  const response = await createApp({ db, redis }).request("/health");
  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    status: "ok",
    service: "zwr-api",
    checks: { database: true, redis: true },
  });
});

Deno.test("health becomes unavailable when Redis is down", async () => {
  const { db, ready } = createTestDatabase();
  await ready;
  const redis: RedisStore = {
    incrementWindow: () => Promise.reject(new Error("down")),
    get: () => Promise.reject(new Error("down")),
    set: () => Promise.reject(new Error("down")),
    increment: () => Promise.reject(new Error("down")),
    ping: () => Promise.resolve(false),
    close: () => Promise.resolve(),
  };
  const response = await createApp({ db, redis }).request("/health");
  assertEquals(response.status, 503);
  assertEquals((await response.json()).checks.redis, false);
});

Deno.test("only v1 exposes business routes", async () => {
  const { db, ready } = createTestDatabase();
  await ready;
  const app = createApp({ db });
  const missing = await app.request("/games");
  assertEquals(missing.status, 404);
  assertEquals(missing.headers.get("content-type"), "application/problem+json");
  assertEquals((await missing.json()).code, "route_not_found");
  assertEquals((await app.request("/v1/games")).status, 200);
});

Deno.test("responses expose a safe request correlation identifier", async () => {
  const { db, ready } = createTestDatabase();
  await ready;
  const app = createApp({ db });

  const supplied = await app.request("/health", { headers: { "x-request-id": "web-check:42" } });
  assertEquals(supplied.headers.get("x-request-id"), "web-check:42");

  const unsafe = await app.request("/health", { headers: { "x-request-id": "invalid request id" } });
  assert(unsafe.headers.get("x-request-id")?.match(/^[0-9a-f-]{36}$/));
});

Deno.test("platform statistics expose real database totals", async () => {
  const { db, ready } = createTestDatabase();
  await ready;
  const response = await createApp({ db }).request("/v1/stats");
  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    playerCount: 0,
    submissionCount: 0,
    gameCount: 0,
    mapCount: 0,
    categoryCount: 0,
  });
});

Deno.test("public category and highest PP record collections are available", async () => {
  const { db, ready } = createTestDatabase();
  await ready;
  const app = createApp({ db });

  assertEquals(await (await app.request("/v1/categories")).json(), []);
  assertEquals(await (await app.request("/v1/records/highest-pp")).json(), {
    limit: 50,
    entries: [],
  });
  assertEquals(await (await app.request("/v1/records/latest-world-records")).json(), {
    limit: 50,
    entries: [],
  });
  const weekly = await app.request("/v1/records/highest-pp-week");
  assertEquals(weekly.status, 200);
  assertEquals((await weekly.json()).entries, []);
  assertEquals(await (await app.request("/v1/leaderboard/highest-average")).json(), {
    limit: 50,
    entries: [],
  });
});

Deno.test("public API accepts browser clients from any origin", async () => {
  const { db, ready } = createTestDatabase();
  await ready;
  const app = createApp({ db });

  const preflight = await app.request("/v1/submissions", {
    method: "OPTIONS",
    headers: {
      origin: "https://community-client.example",
      "access-control-request-method": "POST",
      "access-control-request-headers": "authorization,content-type",
    },
  });
  assertEquals(preflight.status, 204);
  assertEquals(preflight.headers.get("access-control-allow-origin"), "*");
  assert(preflight.headers.get("access-control-allow-methods")?.includes("POST"));
  assert(preflight.headers.get("access-control-allow-headers")?.toLowerCase().includes("authorization"));

  const response = await app.request("/v1/games", {
    headers: { origin: "https://another-client.example" },
  });
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("access-control-allow-origin"), "*");
  assert(response.headers.get("access-control-expose-headers")?.toLowerCase().includes("set-auth-token"));
  assert(response.headers.get("access-control-expose-headers")?.toLowerCase().includes("x-request-id"));
});

Deno.test("Scalar documentation renders the OpenAPI reference", async () => {
  const { app } = await setup();
  const response = await app.request("/docs");
  assertEquals(response.status, 200);
  assert(response.headers.get("content-type")?.includes("text/html"));
  const html = await response.text();
  assert(html.includes("ZWR API Documentation"));
  assert(html.includes("/v1/openapi.json"));
});

Deno.test("public docs expose only the anonymous allowlist and internal docs require DOCS_TOKEN", async () => {
  const { db, ready } = createTestDatabase();
  await ready;
  const docsToken = "test-internal-docs-token";
  const app = createApp({ db, docsToken });

  const publicSpec = await app.request("/v1/openapi.json");
  assertEquals(publicSpec.status, 200);
  const publicDocument = await publicSpec.json();
  assertEquals(Object.keys(publicDocument.paths).sort(), [...publicOpenApiPaths].sort());
  assertEquals(Object.keys(publicOpenApiDocument.paths).sort(), [...publicOpenApiPaths].sort());
  for (
    const protectedPath of [
      "/auth/session",
      "/auth/sign-out",
      "/maps/preview",
      "/submissions",
      "/me/submissions",
      "/admin/submissions",
      "/metrics",
    ]
  ) {
    assertEquals(protectedPath in publicDocument.paths, false);
  }

  const denied = await app.request("/docs/internal");
  assertEquals(denied.status, 401);
  assert(denied.headers.get("www-authenticate")?.startsWith("Basic "));

  const authorization = `Basic ${btoa(`docs:${docsToken}`)}`;
  const internalDocs = await app.request("/docs/internal", {
    headers: { authorization },
  });
  assertEquals(internalDocs.status, 200);
  assert((await internalDocs.text()).includes("ZWR Internal API Documentation"));

  const internalSpec = await app.request("/v1/openapi.internal.json", {
    headers: { authorization },
  });
  assertEquals(internalSpec.status, 200);
  const internalDocument = await internalSpec.json();
  assertEquals(
    Object.keys(internalDocument.paths).some((path) => path.startsWith("/admin/")),
    true,
  );
});

Deno.test("every documented v1 route has explicit VC and IC test domains", () => {
  const documentedRoutes = Object.entries(openApiDocument.paths)
    .filter(([path]) => path !== "/health" && path !== "/metrics")
    .flatMap(([path, methods]) => Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`));
  const contractedRoutes = v1RouteContracts.map((contract) =>
    `${contract.method} ${contract.path.replace(/:([A-Za-z][A-Za-z0-9]*)/g, "{$1}")}`
  );
  assertEquals(contractedRoutes.sort(), documentedRoutes.sort());
  for (const contract of v1RouteContracts) {
    assert(contract.VC.length > 0, `${contract.method} ${contract.path} needs VC`);
    assert(contract.IC !== undefined, `${contract.method} ${contract.path} needs IC`);
  }
});

Deno.test("every JSON OpenAPI operation uses named request and response schemas", () => {
  for (const [path, methods] of Object.entries(openApiDocument.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if ("requestBody" in operation) {
        const jsonBody = operation.requestBody.content["application/json"];
        if (jsonBody) {
          const schema = jsonBody.schema;
          assert("$ref" in schema, `${method.toUpperCase()} ${path} request must use a component schema`);
        }
      }
      if (!("responses" in operation)) continue;
      for (const [status, response] of Object.entries(operation.responses)) {
        if (!isRecord(response) || !isRecord(response.content)) continue;
        const media = response.content["application/json"];
        if (!isRecord(media) || !isRecord(media.schema)) continue;
        const schema = media.schema;
        assert(
          "$ref" in schema,
          `${method.toUpperCase()} ${path} response ${status} must use a component schema`,
        );
      }
    }
  }
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

Deno.test("admin access is derived from database roles", async () => {
  const { app, headers } = await setup(["ROLE_USER", "ROLE_ADMIN"]);
  const created = await app.request("/admin/games", {
    method: "POST",
    headers,
    body: JSON.stringify({ slug: "bo3", name: "Black Ops III", shortName: "BO3", releaseYear: 2015 }),
  });
  assertEquals(created.status, 201);
  const game = await created.json();
  assertEquals((await (await app.request("/games")).json()).entries[0].slug, "bo3");
  assertEquals((await (await app.request("/games/bo3")).json()).id, game.id);
});

Deno.test("forged identity and role headers never grant access", async () => {
  const { app } = await setup();
  const response = await app.request("/admin/games", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-user-id": "fake-admin",
      "x-user-roles": '["ROLE_ADMIN"]',
    },
    body: JSON.stringify({ slug: "bo2", name: "Black Ops II", shortName: "BO2" }),
  });
  assertEquals(response.status, 401);
  assertEquals(response.headers.get("content-type"), "application/problem+json");
  assertEquals((await response.json()).code, "unauthorized");
});

Deno.test("a connected ROLE_USER is forbidden on admin routes", async () => {
  const { app, headers } = await setup(["ROLE_USER"]);
  const response = await app.request("/admin/games", {
    method: "POST",
    headers,
    body: JSON.stringify({ slug: "bo2", name: "Black Ops II", shortName: "BO2" }),
  });
  assertEquals(response.status, 403);
  assertEquals((await response.json()).code, "forbidden");
});

Deno.test("Redis-backed rate limiting is shared and emits metrics", async () => {
  let count = 0;
  const redis: RedisStore = {
    incrementWindow: () => Promise.resolve({ count: ++count, ttlMs: 30_000 }),
    get: () => Promise.resolve(null),
    set: () => Promise.resolve(),
    increment: () => Promise.resolve(1),
    ping: () => Promise.resolve(true),
    close: () => Promise.resolve(),
  };
  const { db, ready } = createTestDatabase();
  await ready;
  const app = createApp({ db, redis });
  const request = () =>
    app.request("/v1/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
  for (let index = 0; index < 20; index++) {
    assert((await request()).status !== 429);
  }
  const limited = await request();
  assertEquals(limited.status, 429);
  assertEquals(limited.headers.get("retry-after"), "30");
  const metrics = await app.request("/metrics");
  assertEquals(metrics.status, 200);
  assert((await metrics.text()).includes("zwr_http_requests_total"));
});

Deno.test("session reads do not consume the authentication write limit", async () => {
  const keys: string[] = [];
  const redis: RedisStore = {
    incrementWindow: (key) => {
      keys.push(key);
      return Promise.resolve({ count: 21, ttlMs: 30_000 });
    },
    get: () => Promise.resolve(null),
    set: () => Promise.resolve(),
    increment: () => Promise.resolve(1),
    ping: () => Promise.resolve(true),
    close: () => Promise.resolve(),
  };
  const { db, ready } = createTestDatabase();
  await ready;
  const app = createApp({ db, redis });

  const response = await app.request("/v1/auth/session");
  assert(response.status !== 429);
  assertEquals(keys.some((key) => key.startsWith("auth:")), false);
});

Deno.test("unauthenticated writes are rate limited before authorization", async () => {
  const keys: string[] = [];
  const redis: RedisStore = {
    incrementWindow: (key) => {
      keys.push(key);
      return Promise.resolve({
        count: key.startsWith("write-ip:") ? 181 : 1,
        ttlMs: 30_000,
      });
    },
    get: () => Promise.resolve(null),
    set: () => Promise.resolve(),
    increment: () => Promise.resolve(1),
    ping: () => Promise.resolve(true),
    close: () => Promise.resolve(),
  };
  const { db, ready } = createTestDatabase();
  await ready;
  const app = createApp({ db, redis });

  const response = await app.request("/v1/profile-claims", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });

  assertEquals(response.status, 429);
  assert(keys.some((key) => key.startsWith("write-ip:")));
});

Deno.test("public reads use their own Redis rate-limit bucket", async () => {
  const keys: string[] = [];
  const redis: RedisStore = {
    incrementWindow: (key) => {
      keys.push(key);
      return Promise.resolve({ count: key.startsWith("public-read:") ? 301 : 1, ttlMs: 12_000 });
    },
    get: () => Promise.resolve(null),
    set: () => Promise.resolve(),
    increment: () => Promise.resolve(1),
    ping: () => Promise.resolve(true),
    close: () => Promise.resolve(),
  };
  const { db, ready } = createTestDatabase();
  await ready;
  const app = createApp({ db, redis });

  const limited = await app.request("/v1/games");
  assertEquals(limited.status, 429);
  assertEquals(limited.headers.get("retry-after"), "12");
  assert(keys.some((key) => key.startsWith("public-read:")));

  keys.length = 0;
  assertEquals((await app.request("/v1/me/notifications")).status, 401);
  assertEquals(keys.some((key) => key.startsWith("public-read:")), false);
});

Deno.test("trusted internal SSR reads do not share the proxy public rate-limit bucket", async () => {
  const keys: string[] = [];
  const redis: RedisStore = {
    incrementWindow: (key) => {
      keys.push(key);
      return Promise.resolve({ count: 301, ttlMs: 12_000 });
    },
    get: () => Promise.resolve(null),
    set: () => Promise.resolve(),
    increment: () => Promise.resolve(1),
    ping: () => Promise.resolve(true),
    close: () => Promise.resolve(),
  };
  const { db, ready } = createTestDatabase();
  await ready;
  const app = createApp({ db, redis, trustProxy: true });

  assertEquals((await app.request("/v1/games")).status, 200);
  assertEquals(keys.some((key) => key.startsWith("public-read:")), false);
});
