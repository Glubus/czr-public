import type { Context, MiddlewareHandler } from "hono";
import { getConnInfo } from "hono/deno";
import type { AuthEnv } from "../auth/authorization.ts";
import type { RedisStore } from "../infra/redis.ts";
import type { Metrics } from "../observability/metrics.ts";
import { problemResponse } from "./problem.ts";

export type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
  redis?: RedisStore;
  metrics?: Metrics;
  key: (context: Context<AuthEnv>, userId?: string) => string;
  when?: (context: Context<AuthEnv>) => boolean;
};
type Bucket = { count: number; resetAt: number };

const requestIdPattern = /^[A-Za-z0-9._:-]{1,80}$/;

/** Keeps one safe correlation identifier across the response and structured logs. */
export function requestId(): MiddlewareHandler<AuthEnv> {
  return async (context, next) => {
    const supplied = context.req.header("x-request-id");
    const id = supplied && requestIdPattern.test(supplied) ? supplied : crypto.randomUUID();
    context.set("requestId", id);
    context.header("x-request-id", id);
    await next();
  };
}

export function requestLogger(metrics?: Metrics): MiddlewareHandler<AuthEnv> {
  return async (context, next) => {
    const startedAt = Date.now();
    await next();
    const path = new URL(context.req.url).pathname;
    metrics?.recordRequest(context.req.method, path, context.res.status);
    console.log(JSON.stringify({
      event: "http_request",
      requestId: context.get("requestId"),
      method: context.req.method,
      path,
      status: context.res.status,
      durationMs: Date.now() - startedAt,
    }));
  };
}

/** Uses the shared Redis connection, with a bounded per-process fallback for development resilience. */
export function rateLimit(options: RateLimitOptions): MiddlewareHandler<AuthEnv> {
  const buckets = new Map<string, Bucket>();
  return async (context, next) => {
    if (options.when && !options.when(context)) {
      await next();
      return;
    }
    const now = Date.now();
    const key = options.key(context, context.get("currentUser")?.id);
    if (options.redis) {
      try {
        const result = await options.redis.incrementWindow(key, options.windowMs);
        if (result.count > options.maxRequests) {
          context.header("retry-after", String(Math.max(1, Math.ceil(result.ttlMs / 1000))));
          return rateLimited(context);
        }
        await next();
        return;
      } catch (error) {
        options.metrics?.recordRateLimitFallback();
        console.warn(JSON.stringify({ event: "redis_rate_limit_fallback", message: String(error) }));
      }
    }

    if (buckets.size > 10_000) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(bucketKey);
      }
    }
    const bucket = buckets.get(key);
    const active = bucket && bucket.resetAt > now ? bucket : { count: 0, resetAt: now + options.windowMs };
    active.count += 1;
    buckets.set(key, active);
    if (active.count > options.maxRequests) {
      context.header("retry-after", String(Math.max(1, Math.ceil((active.resetAt - now) / 1000))));
      return rateLimited(context);
    }
    await next();
  };
}

export function clientAddress(context: Context<AuthEnv>, trustProxy: boolean) {
  if (trustProxy) {
    const forwarded = context.req.header("x-forwarded-for")?.split(",").at(-1)?.trim();
    if (forwarded) return forwarded;
  }
  try {
    return getConnInfo(context).remote.address;
  } catch {
    return "unknown";
  }
}

function rateLimited(context: Context<AuthEnv>) {
  return problemResponse(context, {
    status: 429,
    code: "rate_limited",
    detail: "Too many requests",
  });
}
