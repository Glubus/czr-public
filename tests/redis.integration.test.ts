import { assertEquals } from "@std/assert";
import { createRedisStore } from "../src/infra/redis.ts";

Deno.test("shared Redis store increments one atomic rate-limit window", async () => {
  const redis = await createRedisStore(
    Deno.env.get("TEST_REDIS_URL") ?? "redis://localhost:6379",
  );
  try {
    const key = `test:${crypto.randomUUID()}`;
    const first = await redis.incrementWindow(key, 30_000);
    const second = await redis.incrementWindow(key, 30_000);
    assertEquals(first.count, 1);
    assertEquals(second.count, 2);
    assertEquals(await redis.ping(), true);
  } finally {
    await redis.close();
  }
});
