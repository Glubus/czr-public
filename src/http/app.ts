import { sql } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import { Cause, Effect, Option } from "effect";
import { apiReference } from "@scalar/hono-api-reference";
import type { Database } from "../db/client.ts";
import { createAuth } from "../auth/better-auth.ts";
import { UnauthorizedError } from "../auth/session.ts";
import { authenticate, type AuthEnv } from "../auth/authorization.ts";
import type { RedisStore } from "../infra/redis.ts";
import type { AccountEmail } from "../infra/email.ts";
import { type BlobStore, createFileBlobStore } from "../infra/blob-store.ts";
import { Metrics } from "../observability/metrics.ts";
import { requireDocsToken } from "./docs-auth.ts";
import { requestId, requestLogger } from "./operations.ts";
import {
  registerAuthenticatedWriteProtection,
  registerPreAuthenticationProtection,
  registerPublicReadProtection,
  registerSubmissionProtection,
} from "./abuse-protection.ts";
import { openApiDocument, publicOpenApiDocument } from "./openapi.ts";
import { problemResponse } from "./problem.ts";
import { redisResponseCache } from "./response-cache.ts";
import { registerPublicRoutes } from "./routes/public.ts";
import { registerAuthRoutes } from "./routes/auth.ts";
import { registerAdminRoutes } from "./routes/admin.ts";
import { registerSubmissionRoutes } from "./routes/submissions.ts";
import { registerMapRoutes } from "./routes/maps.ts";
import { registerProfileClaimRoutes } from "./routes/profile-claims.ts";
import { registerAccountRoutes } from "./routes/accounts.ts";
import { registerClanRoutes } from "./routes/clans.ts";
import { registerSocialRoutes } from "./routes/social.ts";
import { registerPersonalRunRoutes } from "./routes/personal-runs.ts";
import { registerClientIngestionRoutes } from "./routes/client-ingestion.ts";
import { registerEngagementRoutes } from "./routes/engagement.ts";
import { ImportValidationError } from "../modules/map-import/service.ts";
import { ConflictError, NotFoundError, RateLimitError, ValidationError } from "../modules/shared/errors.ts";

type AppDependencies = {
  db: Database;
  redis?: RedisStore;
  docsToken?: string;
  trustProxy?: boolean;
  metrics?: Metrics;
  accountEmail?: AccountEmail;
  frontendUrl?: string;
  blobStore?: BlobStore;
};

export function createApp({
  db,
  redis,
  docsToken,
  trustProxy = false,
  metrics = new Metrics(),
  accountEmail,
  frontendUrl,
  blobStore = createFileBlobStore("/tmp/zwr-client-blobs"),
}: AppDependencies) {
  const root = new Hono<AuthEnv>();
  const app = root.basePath("/v1");
  const auth = createAuth(db, { email: accountEmail, frontendUrl });

  root.use("*", requestId());
  root.use(
    "*",
    cors({
      origin: "*",
      allowHeaders: ["Authorization", "Content-Type"],
      allowMethods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      exposeHeaders: ["Set-Auth-Token", "X-Request-Id"],
      maxAge: 86_400,
    }),
  );

  root.get("/health", async (c) => {
    const checks = await readinessChecks(db, redis);
    const ready = checks.database && checks.redis;
    return c.json(
      { status: ready ? "ok" : "degraded", service: "zwr-api", checks },
      ready ? 200 : 503,
    );
  });
  root.get("/metrics", (c) =>
    c.text(metrics.renderPrometheus(), 200, {
      "content-type": "text/plain; version=0.0.4; charset=utf-8",
    }));
  root.get(
    "/docs",
    apiReference({
      pageTitle: "ZWR API Documentation",
      theme: "purple",
      layout: "modern",
      spec: { url: "/v1/openapi.json" },
      defaultHttpClient: { targetKey: "js", clientKey: "fetch" },
    }),
  );
  root.get(
    "/docs/internal",
    requireDocsToken(docsToken),
    apiReference({
      pageTitle: "ZWR Internal API Documentation",
      theme: "purple",
      layout: "modern",
      spec: { content: openApiDocument },
      defaultHttpClient: { targetKey: "js", clientKey: "fetch" },
    }),
  );

  app.use("*", requestLogger(metrics));
  const abuseProtection = { redis, metrics, trustProxy };
  registerPreAuthenticationProtection(app, abuseProtection);
  app.use(authenticate(db, auth));
  registerAuthenticatedWriteProtection(app, abuseProtection);
  app.use("*", redisResponseCache(redis));
  registerPublicReadProtection(app, abuseProtection);
  registerSubmissionProtection(app, abuseProtection);

  registerAuthRoutes(app, auth, (context, path) => runAuthRoute(context, auth, path));

  app.get("/openapi.json", (c) => c.json(publicOpenApiDocument));
  app.get(
    "/openapi.internal.json",
    requireDocsToken(docsToken),
    (c) => c.json(openApiDocument),
  );
  registerPublicRoutes(app, db, blobStore, runHttpEffect);
  registerAdminRoutes(app, db, runHttpEffect, requestJson);

  registerSubmissionRoutes(app, db, runHttpEffect, requestJson);
  registerMapRoutes(app, db, runHttpEffect, requestJson);
  registerProfileClaimRoutes(app, db, runHttpEffect, requestJson);
  registerAccountRoutes(app, db, blobStore, runHttpEffect, requestJson);
  registerClanRoutes(app, db, runHttpEffect, requestJson);
  registerSocialRoutes(app, db, runHttpEffect, requestJson);
  registerPersonalRunRoutes(app, db, runHttpEffect, requestJson);
  registerClientIngestionRoutes(app, db, blobStore, runHttpEffect, requestJson);
  registerEngagementRoutes(app, db, runHttpEffect, requestJson);

  root.notFound((c) =>
    problemResponse(c, {
      status: 404,
      code: "route_not_found",
      detail: "The requested route does not exist",
    })
  );
  root.onError((error, c) => {
    console.error(JSON.stringify({
      event: "unhandled_http_error",
      requestId: c.get("requestId"),
      error: String(error),
    }));
    return problemResponse(c, {
      status: 500,
      code: "internal_error",
      detail: "An unexpected error occurred",
    });
  });

  return root;
}

function mapDomainError(c: Context<AuthEnv>, error: unknown) {
  if (error instanceof UnauthorizedError) {
    return problemResponse(c, { status: 401, code: "unauthorized", detail: "Authentication is required" });
  }
  if (error instanceof ValidationError || error instanceof ImportValidationError) {
    return problemResponse(c, { status: 400, code: "validation_failed", detail: error.message });
  }

  if (error instanceof NotFoundError) {
    return problemResponse(c, { status: 404, code: error.code, detail: error.message });
  }

  if (error instanceof ConflictError) {
    return problemResponse(c, { status: 409, code: error.code, detail: error.message });
  }

  if (error instanceof RateLimitError) {
    c.header("retry-after", String(error.retryAfterSeconds));
    return problemResponse(c, { status: 429, code: error.code, detail: error.message });
  }

  console.error(JSON.stringify({ event: "unhandled_effect_failure", error: String(error) }));
  return problemResponse(c, { status: 500, code: "internal_error", detail: "An unexpected error occurred" });
}

function requestJson(c: Context<AuthEnv>) {
  return Effect.tryPromise({
    try: () => c.req.json<unknown>(),
    catch: () => new ValidationError("request body must contain valid JSON"),
  });
}

export const runHttpEffect = async <A, E>(
  c: Context<AuthEnv>,
  program: Effect.Effect<A, E>,
  onSuccess: (value: A) => Response,
): Promise<Response> => {
  const exit = await Effect.runPromiseExit(program);

  if (exit._tag === "Success") {
    return onSuccess(exit.value);
  }

  const error = Option.getOrElse(Cause.failureOption(exit.cause), () => exit.cause);
  return mapDomainError(c, error);
};

function runAuthRoute(c: Context<AuthEnv>, auth: ReturnType<typeof createAuth>, path: string) {
  return runHttpEffect(
    c,
    Effect.tryPromise({
      try: () => auth.handler(requestWithPath(c.req.raw, path)),
      catch: (cause) => cause,
    }),
    (response) => response,
  );
}

function requestWithPath(request: Request, path: string) {
  const url = new URL(request.url);
  url.pathname = path;
  return new Request(url, request);
}

async function readinessChecks(db: Database, redis?: RedisStore) {
  const database = await db.execute(sql`SELECT 1`).then(
    () => true,
    () => false,
  );
  const redisReady = redis ? await redis.ping().catch(() => false) : true;
  return { database, redis: redisReady };
}
