import { assertEquals } from "@std/assert";
import { Hono } from "hono";
import type { RedisStore } from "../src/infra/redis.ts";
import { redisResponseCache } from "../src/http/response-cache.ts";

function fakeRedis() {
  const values = new Map<string, string>();
  const versions = new Map<string, number>();
  const redis: RedisStore = {
    incrementWindow: () => Promise.resolve({ count: 1, ttlMs: 1_000 }),
    get: (key) => Promise.resolve(values.get(key) ?? null),
    set: (key, value) => {
      values.set(key, value);
      return Promise.resolve();
    },
    increment: (key) => {
      const version = (versions.get(key) ?? 0) + 1;
      versions.set(key, version);
      values.set(key, String(version));
      return Promise.resolve(version);
    },
    ping: () => Promise.resolve(true),
    close: () => Promise.resolve(),
  };
  return {
    redis,
    version: (namespace: string) => versions.get(`zwr:http-cache:version:${namespace}`) ?? 0,
  };
}

Deno.test("Redis response cache serves public GET responses and invalidates only dependent namespaces", async () => {
  const store = fakeRedis();
  const app = new Hono();
  let gameCalls = 0;
  let leaderboardCalls = 0;
  app.use("*", redisResponseCache(store.redis));
  app.get("/v1/games", (context) => context.json({ calls: ++gameCalls }));
  app.get("/v1/leaderboard", (context) => context.json({ calls: ++leaderboardCalls }));
  app.patch("/v1/admin/submissions/:id/status", (context) => context.json({ ok: true }));

  const first = await app.request("/v1/games");
  assertEquals(first.headers.get("x-cache"), "MISS");
  assertEquals(await first.json(), { calls: 1 });

  const second = await app.request("/v1/games");
  assertEquals(second.headers.get("x-cache"), "HIT");
  assertEquals(await second.json(), { calls: 1 });

  assertEquals((await app.request("/v1/leaderboard")).headers.get("x-cache"), "MISS");
  assertEquals((await app.request("/v1/leaderboard")).headers.get("x-cache"), "HIT");

  await app.request("/v1/admin/submissions/42/status", { method: "PATCH" });
  assertEquals(store.version("records"), 1);
  assertEquals(store.version("catalog"), 0);

  assertEquals((await app.request("/v1/games")).headers.get("x-cache"), "HIT");
  assertEquals((await app.request("/v1/leaderboard")).headers.get("x-cache"), "MISS");
  assertEquals(gameCalls, 1);
  assertEquals(leaderboardCalls, 2);
});

Deno.test("client traffic, authentication and social actions never invalidate world leaderboards", async () => {
  const store = fakeRedis();
  const app = new Hono();
  let leaderboardCalls = 0;
  let comparisonCalls = 0;
  app.use("*", redisResponseCache(store.redis));
  app.get("/v1/leaderboard", (context) => context.json({ calls: ++leaderboardCalls }));
  app.get("/v1/users/a/compare/b", (context) => context.json({ calls: ++comparisonCalls }));
  app.post("/v1/me/client-runs/:id/heartbeat", (context) => context.json({ ok: true }));
  app.post("/v1/me/client-runs/:id/chunks", (context) => context.json({ ok: true }, 201));
  app.post("/v1/auth/sign-in", (context) => context.json({ ok: true }));
  app.post("/v1/me/follows", (context) => context.json({ ok: true }, 201));

  assertEquals((await app.request("/v1/leaderboard")).headers.get("x-cache"), "MISS");
  assertEquals((await app.request("/v1/users/a/compare/b")).headers.get("x-cache"), "MISS");

  await app.request("/v1/me/client-runs/1/heartbeat", { method: "POST" });
  await app.request("/v1/me/client-runs/1/chunks", { method: "POST" });
  await app.request("/v1/auth/sign-in", { method: "POST" });
  await app.request("/v1/me/follows", { method: "POST" });

  assertEquals(store.version("records"), 0);
  assertEquals(store.version("relationships"), 1);
  assertEquals((await app.request("/v1/leaderboard")).headers.get("x-cache"), "HIT");
  assertEquals((await app.request("/v1/users/a/compare/b")).headers.get("x-cache"), "MISS");
  assertEquals(leaderboardCalls, 1);
  assertEquals(comparisonCalls, 2);
});

Deno.test("Redis response cache ignores private and personalized GET responses", async () => {
  const store = fakeRedis();
  const app = new Hono();
  let calls = 0;
  app.use("*", redisResponseCache(store.redis));
  app.get("/v1/me/notifications", (context) => context.json({ calls: ++calls }));
  app.get("/v1/leaderboard", (context) => context.json({ calls: ++calls }));

  assertEquals((await app.request("/v1/me/notifications")).headers.get("x-cache"), null);
  assertEquals((await app.request("/v1/me/notifications")).headers.get("x-cache"), null);
  assertEquals(
    (await app.request("/v1/leaderboard?scope=friends")).headers.get("x-cache"),
    null,
  );
  assertEquals(calls, 3);
});

Deno.test("concurrent cache misses for one key are coalesced", async () => {
  const store = fakeRedis();
  const app = new Hono();
  let calls = 0;
  app.use("*", redisResponseCache(store.redis));
  app.get("/v1/games", async (context) => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return context.json({ calls });
  });

  const responses = await Promise.all(Array.from({ length: 10 }, () => app.request("/v1/games")));
  assertEquals(calls, 1);
  assertEquals(responses.filter((response) => response.headers.get("x-cache") === "MISS").length, 1);
  assertEquals(responses.filter((response) => response.headers.get("x-cache") === "HIT").length, 9);
});

Deno.test("public player achievements are cached and coalesced", async () => {
  const store = fakeRedis();
  const app = new Hono();
  let calls = 0;
  app.use("*", redisResponseCache(store.redis));
  app.get("/v1/users/:id/achievements", async (context) => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return context.json({ player: context.req.param("id"), calls });
  });

  const responses = await Promise.all(
    Array.from({ length: 8 }, () => app.request("/v1/users/player-1/achievements")),
  );
  assertEquals(calls, 1);
  assertEquals(responses.filter((response) => response.headers.get("x-cache") === "MISS").length, 1);
  assertEquals(responses.filter((response) => response.headers.get("x-cache") === "HIT").length, 7);
});
