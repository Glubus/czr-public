import { type Context, type Hono } from "hono";
import type { AuthEnv } from "../auth/authorization.ts";
import type { RedisStore } from "../infra/redis.ts";
import type { Metrics } from "../observability/metrics.ts";
import { clientAddress, rateLimit } from "./operations.ts";

const ONE_MINUTE_MS = 60_000;
const TEN_MINUTES_MS = 10 * ONE_MINUTE_MS;

const AUTH_WRITE_REQUESTS_PER_MINUTE = 20;
const WRITE_REQUESTS_PER_MINUTE_PER_IP = 180;
const AUTHENTICATED_WRITES_PER_MINUTE = 60;
const COMMUNITY_WRITES_PER_MINUTE = 30;
const MEDIA_UPLOADS_PER_TEN_MINUTES = 6;
const CLIENT_INGESTION_WRITES_PER_MINUTE = 180;
const PUBLIC_READS_PER_MINUTE = 300;
const SUBMISSIONS_PER_MINUTE = 10;

type AbuseProtectionDependencies = {
  redis?: RedisStore;
  metrics: Metrics;
  trustProxy: boolean;
};

export function registerPreAuthenticationProtection(
  app: Hono<AuthEnv>,
  { redis, metrics, trustProxy }: AbuseProtectionDependencies,
) {
  app.use(
    "*",
    rateLimit({
      windowMs: ONE_MINUTE_MS,
      maxRequests: WRITE_REQUESTS_PER_MINUTE_PER_IP,
      redis,
      metrics,
      key: (context) => `write-ip:${clientAddress(context, trustProxy)}`,
      when: (context) => isMutation(context) && !isAuthenticationPath(context),
    }),
  );
  app.use(
    "/auth/*",
    rateLimit({
      windowMs: ONE_MINUTE_MS,
      maxRequests: AUTH_WRITE_REQUESTS_PER_MINUTE,
      redis,
      metrics,
      key: (context) => `auth:${clientAddress(context, trustProxy)}`,
      when: (context) => !["GET", "HEAD", "OPTIONS"].includes(context.req.method),
    }),
  );
}

function isMutation(context: Context<AuthEnv>) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(context.req.method);
}

function isAuthenticationPath(context: Context<AuthEnv>) {
  return /^\/v1\/auth(?:\/|$)/.test(requestPath(context));
}

export function registerAuthenticatedWriteProtection(
  app: Hono<AuthEnv>,
  { redis, metrics, trustProxy }: AbuseProtectionDependencies,
) {
  app.use(
    "*",
    rateLimit({
      windowMs: ONE_MINUTE_MS,
      maxRequests: AUTHENTICATED_WRITES_PER_MINUTE,
      redis,
      metrics,
      key: (context, userId) => `authenticated-write:${userId ?? clientAddress(context, trustProxy)}`,
      when: (context) => isAuthenticatedWrite(context) && !isClientIngestionWrite(context),
    }),
  );
  app.use(
    "*",
    rateLimit({
      windowMs: ONE_MINUTE_MS,
      maxRequests: COMMUNITY_WRITES_PER_MINUTE,
      redis,
      metrics,
      key: (context, userId) => `community-write:${userId ?? clientAddress(context, trustProxy)}`,
      when: (context) => isAuthenticatedWrite(context) && isCommunityWrite(context),
    }),
  );
  app.use(
    "*",
    rateLimit({
      windowMs: TEN_MINUTES_MS,
      maxRequests: MEDIA_UPLOADS_PER_TEN_MINUTES,
      redis,
      metrics,
      key: (context, userId) => `media-upload:${userId ?? clientAddress(context, trustProxy)}`,
      when: (context) => isAuthenticatedWrite(context) && isMediaUpload(context),
    }),
  );
  app.use(
    "*",
    rateLimit({
      windowMs: ONE_MINUTE_MS,
      maxRequests: CLIENT_INGESTION_WRITES_PER_MINUTE,
      redis,
      metrics,
      key: (context, userId) => `client-ingestion:${userId ?? clientAddress(context, trustProxy)}`,
      when: (context) => isAuthenticatedWrite(context) && isClientIngestionWrite(context),
    }),
  );
}

export function registerPublicReadProtection(
  app: Hono<AuthEnv>,
  { redis, metrics, trustProxy }: AbuseProtectionDependencies,
) {
  app.use(
    "*",
    rateLimit({
      windowMs: ONE_MINUTE_MS,
      maxRequests: PUBLIC_READS_PER_MINUTE,
      redis,
      metrics,
      key: (context) => `public-read:${clientAddress(context, trustProxy)}`,
      // Browser API calls arrive through the trusted proxy. SSR calls use
      // the private network and must not make every visitor share one bucket.
      when: (context) => isPublicRead(context) && !(trustProxy && !context.req.header("x-forwarded-for")),
    }),
  );
}

export function registerSubmissionProtection(
  app: Hono<AuthEnv>,
  { redis, metrics, trustProxy }: AbuseProtectionDependencies,
) {
  const submissionRateLimit = rateLimit({
    windowMs: ONE_MINUTE_MS,
    maxRequests: SUBMISSIONS_PER_MINUTE,
    redis,
    metrics,
    key: (context: Context<AuthEnv>, userId?: string) =>
      `submission:${userId ?? clientAddress(context, trustProxy)}`,
  });
  app.use("/submissions", submissionRateLimit);
  app.use("/submission-groups", submissionRateLimit);
}

function isPublicRead(context: Context<AuthEnv>) {
  if (context.req.method !== "GET") return false;
  const path = requestPath(context);
  return (
    !/^\/v1\/(?:admin|auth|me)(?:\/|$)/.test(path) &&
    path !== "/v1/openapi.json" &&
    path !== "/v1/openapi.internal.json"
  );
}

function isAuthenticatedWrite(context: Context<AuthEnv>) {
  return (
    Boolean(context.get("currentUser")) &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(context.req.method)
  );
}

function requestPath(context: Context<AuthEnv>) {
  return new URL(context.req.url).pathname;
}

function isMediaUpload(context: Context<AuthEnv>) {
  return /^\/v1\/me\/media(?:\/|$)/.test(requestPath(context));
}

function isClientIngestionWrite(context: Context<AuthEnv>) {
  return /^\/v1\/me\/client-(?:runs|installations)(?:\/|$)/.test(requestPath(context));
}

function isCommunityWrite(context: Context<AuthEnv>) {
  return /^\/v1\/(?:submissions\/\d+\/comments(?:\/|$)|me\/follows(?:\/|$)|clans(?:\/|$)|me\/(?:clan|goals|personal-runs)(?:\/|$))/
    .test(
      requestPath(context),
    );
}
