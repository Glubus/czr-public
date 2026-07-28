import type { MiddlewareHandler } from "hono";
import type { AuthEnv } from "../auth/authorization.ts";
import type { RedisStore } from "../infra/redis.ts";

const CACHE_VERSION_PREFIX = "zwr:http-cache:version:";
const MAX_CACHEABLE_BYTES = 1_000_000;
const inFlight = new Map<string, Promise<void>>();

type CacheNamespace = "catalog" | "users" | "records" | "clans" | "relationships";

type CachedResponse = {
  body: string;
  contentType: string;
};

type CachePolicy = {
  ttlSeconds: number;
  namespaces: readonly CacheNamespace[];
};

export function redisResponseCache(redis?: RedisStore): MiddlewareHandler<AuthEnv> {
  return async (context, next) => {
    if (!redis) {
      await next();
      return;
    }

    const method = context.req.method;
    const url = new URL(context.req.url);

    if (method !== "GET") {
      await next();
      if (context.res.status >= 200 && context.res.status < 400) {
        await invalidate(redis, mutationNamespaces(method, url.pathname));
      }
      return;
    }

    const policy = cachePolicy(url);
    if (!policy) {
      await next();
      return;
    }

    try {
      const versions = await Promise.all(
        policy.namespaces.map(async (namespace) =>
          `${namespace}:${await redis.get(versionKey(namespace)) ?? "0"}`
        ),
      );
      const key = cacheKey(versions.join(","), url);
      const cached = await redis.get(key);
      if (cached !== null) {
        return cachedBody(cached, policy.ttlSeconds, context);
      }

      const pending = inFlight.get(key);
      if (pending) {
        await pending;
        const filled = await redis.get(key);
        if (filled !== null) return cachedBody(filled, policy.ttlSeconds, context);
      }

      let release!: () => void;
      const flight = new Promise<void>((resolve) => release = resolve);
      inFlight.set(key, flight);
      try {
        await next();
        context.res.headers.set("x-cache", "MISS");
        if (context.res.status !== 200 || !isJson(context.res.headers.get("content-type"))) return;

        const body = await context.res.clone().text();
        if (new TextEncoder().encode(body).byteLength > MAX_CACHEABLE_BYTES) return;

        context.res.headers.set("cache-control", `public, max-age=${policy.ttlSeconds}`);
        await redis.set(
          key,
          JSON.stringify(
            {
              body,
              contentType: context.res.headers.get("content-type") ?? "application/json; charset=UTF-8",
            } satisfies CachedResponse,
          ),
          policy.ttlSeconds,
        );
      } finally {
        if (inFlight.get(key) === flight) inFlight.delete(key);
        release();
      }
    } catch (error) {
      logCacheFailure(error);
      await nextIfNeeded(context.res, next);
    }
  };
}

function cachedBody(
  cached: string,
  ttlSeconds: number,
  context: Parameters<MiddlewareHandler<AuthEnv>>[0],
) {
  const value = JSON.parse(cached) as CachedResponse;
  context.header("x-cache", "HIT");
  context.header("cache-control", `public, max-age=${ttlSeconds}`);
  return context.body(value.body, 200, { "content-type": value.contentType });
}

function cachePolicy(url: URL): CachePolicy | undefined {
  const path = url.pathname;

  if (path === "/v1/leaderboard") {
    const scope = url.searchParams.get("scope") ?? "world";
    return scope === "world" ? policy(60, "records", "catalog", "users") : undefined;
  }

  if (
    path === "/v1/stats" ||
    path === "/v1/records/highest-pp" ||
    path === "/v1/records/highest-pp-week" ||
    path === "/v1/records/latest-world-records"
  ) return policy(60, "records", "catalog", "users");
  if (path === "/v1/leaderboard/highest-average") {
    return policy(60, "records", "catalog", "users");
  }
  if (path === "/v1/leaderboard/achievements") {
    return policy(60, "users", "records");
  }

  if (
    path === "/v1/games" || path === "/v1/maps" || path === "/v1/categories" ||
    /^\/v1\/games\/[^/]+(?:\/mods)?$/.test(path) ||
    /^\/v1\/maps\/\d+(?:\/categories)?$/.test(path)
  ) return policy(300, "catalog");

  if (path === "/v1/users") return policy(300, "users");

  if (path === "/v1/clans/leaderboard") {
    return policy(60, "records", "catalog", "users", "clans");
  }

  if (/^\/v1\/clans\/[^/]+$/.test(path)) return policy(60, "clans", "users");

  if (/^\/v1\/users\/[^/]+\/compare\/[^/]+$/.test(path)) {
    return policy(60, "records", "catalog", "users", "relationships");
  }

  if (/^\/v1\/users\/[^/]+\/achievements$/.test(path)) {
    return policy(300, "records", "catalog", "users");
  }

  if (
    path === "/v1/teams/leaderboard" ||
    /^\/v1\/maps\/\d+\/categories\/\d+\/leaderboard$/.test(path) ||
    /^\/v1\/users\/[^/]+\/(?:records|history|performance-history|ranks|social-context)$/.test(path) ||
    /^\/v1\/teams\/[^/]+(?:\/records)?$/.test(path)
  ) return policy(60, "records", "catalog", "users");

  return undefined;
}

function policy(ttlSeconds: number, ...namespaces: CacheNamespace[]): CachePolicy {
  return { ttlSeconds, namespaces };
}

function mutationNamespaces(method: string, path: string): readonly CacheNamespace[] {
  if (path === "/v1/auth/sign-up" && method === "POST") return ["users"];

  if (/^\/v1\/admin\/(?:games|maps|mods|categories|category-assignments)(?:\/|$)/.test(path)) {
    return ["catalog"];
  }

  if (method === "PATCH" && /^\/v1\/admin\/submissions\/\d+\/status$/.test(path)) {
    return ["records"];
  }

  if (/^\/v1\/me\/(?:profile|account|pinned-records(?:\/\d+)?)$/.test(path)) return ["users"];

  if (method === "PATCH" && /^\/v1\/admin\/profile-claims\/\d+\/status$/.test(path)) {
    return ["users", "records", "clans", "relationships"];
  }

  if (/^\/v1\/me\/follows(?:\/|$)/.test(path)) {
    return ["relationships"];
  }

  if (
    path === "/v1/clans" ||
    /^\/v1\/me\/clan-invitations\/\d+$/.test(path) ||
    /^\/v1\/clans\/\d+\/(?:members|owner)(?:\/|$)/.test(path)
  ) return ["clans"];

  return [];
}

async function invalidate(redis: RedisStore, namespaces: readonly CacheNamespace[]) {
  await Promise.all(namespaces.map((namespace) => redis.increment(versionKey(namespace))))
    .catch(logCacheFailure);
}

function versionKey(namespace: CacheNamespace) {
  return `${CACHE_VERSION_PREFIX}${namespace}`;
}

function cacheKey(versions: string, url: URL) {
  const query = [...url.searchParams.entries()]
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)
    )
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  return `zwr:http-cache:${versions}:${url.pathname}${query ? `?${query}` : ""}`;
}

function isJson(contentType: string | null) {
  return contentType?.toLowerCase().includes("application/json") ?? false;
}

function logCacheFailure(error: unknown) {
  console.warn(JSON.stringify({ event: "redis_response_cache_fallback", message: String(error) }));
}

async function nextIfNeeded(response: Response, next: () => Promise<void>) {
  if (response.status === 404) await next();
}
