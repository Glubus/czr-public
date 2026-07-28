import { createClient } from "redis";

export type RateLimitResult = {
  count: number;
  ttlMs: number;
};

export interface RedisStore {
  incrementWindow(key: string, windowMs: number): Promise<RateLimitResult>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  increment(key: string): Promise<number>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

const INCREMENT_WINDOW_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return { count, ttl }
`;

/** One shared, reconnecting Redis client for the whole process. */
export async function createRedisStore(url: string): Promise<RedisStore> {
  const client = createClient({
    url,
    socket: {
      connectTimeout: 5_000,
      reconnectStrategy: (retries) =>
        retries >= 5
          ? new Error("Redis connection failed after 5 retries")
          : Math.min(100 * 2 ** retries, 3_000),
    },
  });
  client.on("error", (error) => {
    console.error(JSON.stringify({ event: "redis_error", error: String(error) }));
  });
  await client.connect();

  return {
    async incrementWindow(key, windowMs) {
      const result = await client.eval(INCREMENT_WINDOW_SCRIPT, {
        keys: [`zwr:rate-limit:${key}`],
        arguments: [String(windowMs)],
      });
      if (
        !Array.isArray(result) || result.length !== 2 ||
        typeof result[0] !== "number" || typeof result[1] !== "number"
      ) {
        throw new Error("Redis returned an invalid rate-limit result");
      }
      return {
        count: result[0],
        ttlMs: result[1] > 0 ? result[1] : windowMs,
      };
    },
    async get(key) {
      return await client.get(key);
    },
    async set(key, value, ttlSeconds) {
      await client.set(key, value, { EX: ttlSeconds });
    },
    async increment(key) {
      return await client.incr(key);
    },
    async ping() {
      return await client.ping() === "PONG";
    },
    async close() {
      if (client.isOpen) {
        await client.close();
      }
    },
  };
}
