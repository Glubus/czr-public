const DEVELOPMENT_SECRETS = new Set([
  "change-me",
  "change-me-in-production-change-me",
  "dev-only-change-me-dev-only-change-me",
]);

export type AppConfig = {
  environment: "development" | "test" | "production";
  port: number;
  redisUrl?: string;
  clientBlobRoot: string;
  docsToken?: string;
  trustProxy: boolean;
  frontendUrl: string;
  email: { mode: "log"; includeContent: boolean } | { mode: "resend"; apiKey: string; from: string };
};

export function loadAppConfig(): AppConfig {
  const environment = parseEnvironment(Deno.env.get("APP_ENV"));
  const port = Number(Deno.env.get("PORT") ?? 3000);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  const authSecret = Deno.env.get("BETTER_AUTH_SECRET");
  if (
    environment === "production" &&
    (!authSecret || authSecret.length < 32 || DEVELOPMENT_SECRETS.has(authSecret))
  ) {
    throw new Error("BETTER_AUTH_SECRET must be a non-default secret of at least 32 characters");
  }

  const redisUrl = Deno.env.get("REDIS_URL") || undefined;
  if (environment === "production" && !redisUrl) {
    throw new Error("REDIS_URL is required in production");
  }

  const emailMode = Deno.env.get("EMAIL_MODE") ?? "log";
  if (emailMode !== "log" && emailMode !== "resend") {
    throw new Error("EMAIL_MODE must be log or resend");
  }
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const emailFrom = Deno.env.get("EMAIL_FROM");
  if (emailMode === "resend" && (!resendApiKey || !emailFrom)) {
    throw new Error("RESEND_API_KEY and EMAIL_FROM are required when EMAIL_MODE=resend");
  }

  return {
    environment,
    port,
    redisUrl,
    clientBlobRoot: Deno.env.get("CLIENT_BLOB_ROOT") ?? "/tmp/zwr-client-blobs",
    docsToken: Deno.env.get("DOCS_TOKEN") || undefined,
    trustProxy: Deno.env.get("TRUST_PROXY") === "true",
    frontendUrl: Deno.env.get("FRONTEND_URL") ?? "http://localhost:8888",
    email: emailMode === "resend"
      ? { mode: "resend", apiKey: resendApiKey!, from: emailFrom! }
      : { mode: "log", includeContent: environment !== "production" },
  };
}

function parseEnvironment(value: string | undefined): AppConfig["environment"] {
  if (value === undefined) return "development";
  if (value === "development" || value === "test" || value === "production") return value;
  throw new Error("APP_ENV must be development, test or production");
}
