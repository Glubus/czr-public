import { type Context, Hono } from "hono";
import type { createAuth } from "../../auth/better-auth.ts";
import type { AuthEnv } from "../../auth/authorization.ts";

/** Better Auth is an infrastructure adapter; its public aliases stay isolated here. */
export function registerAuthRoutes(
  app: Hono<AuthEnv>,
  auth: ReturnType<typeof createAuth>,
  run: (context: Context<AuthEnv>, path: string) => Promise<Response>,
) {
  app.post("/auth/sign-up", (context) => run(context, "/api/auth/sign-up/email"));
  app.post("/auth/sign-in", (context) => run(context, "/api/auth/sign-in/email"));
  app.post("/auth/sign-out", (context) => run(context, "/api/auth/sign-out"));
  app.get("/auth/session", (context) => run(context, "/api/auth/get-session"));
  app.post("/auth/request-password-reset", (context) => run(context, "/api/auth/request-password-reset"));
  app.post("/auth/reset-password", (context) => run(context, "/api/auth/reset-password"));
  app.post("/auth/change-password", (context) => run(context, "/api/auth/change-password"));
  void auth;
}
