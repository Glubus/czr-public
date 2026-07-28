import { assertEquals, assertThrows } from "@std/assert";
import { loadAppConfig } from "../src/config.ts";

Deno.test("development frontend origin matches the local web server", () => {
  withEnvironment({ APP_ENV: "development", FRONTEND_URL: undefined }, () => {
    assertEquals(loadAppConfig().frontendUrl, "http://localhost:8888");
  });
});

Deno.test("production refuses default secrets and missing Redis", () => {
  withEnvironment({
    APP_ENV: "production",
    PORT: "3000",
    BETTER_AUTH_SECRET: "change-me",
    REDIS_URL: undefined,
    DOCS_TOKEN: undefined,
    EMAIL_MODE: "log",
    FRONTEND_URL: undefined,
  }, () => {
    assertThrows(() => loadAppConfig(), Error, "BETTER_AUTH_SECRET");
  });
});

Deno.test("production accepts explicit infrastructure configuration", () => {
  withEnvironment({
    APP_ENV: "production",
    PORT: "3000",
    BETTER_AUTH_SECRET: "a-secure-production-secret-with-32-characters",
    REDIS_URL: "redis://redis:6379",
    DOCS_TOKEN: "internal-docs-token",
    TRUST_PROXY: "true",
    EMAIL_MODE: "resend",
    FRONTEND_URL: "https://zwr.example",
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: "ZWR <accounts@zwr.example>",
  }, () => {
    assertEquals(loadAppConfig(), {
      environment: "production",
      port: 3000,
      redisUrl: "redis://redis:6379",
      clientBlobRoot: "/tmp/zwr-client-blobs",
      docsToken: "internal-docs-token",
      trustProxy: true,
      frontendUrl: "https://zwr.example",
      email: { mode: "resend", apiKey: "re_test", from: "ZWR <accounts@zwr.example>" },
    });
  });
});

Deno.test("production log email suppresses reset links and recipient data", () => {
  withEnvironment({
    APP_ENV: "production",
    BETTER_AUTH_SECRET: "a-secure-production-secret-with-32-characters",
    REDIS_URL: "redis://redis:6379",
    EMAIL_MODE: "log",
  }, () => {
    assertEquals(loadAppConfig().email, { mode: "log", includeContent: false });
  });
});

function withEnvironment(values: Record<string, string | undefined>, run: () => void) {
  const previous = new Map(Object.keys(values).map((key) => [key, Deno.env.get(key)]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
    run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
}
