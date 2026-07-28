import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import type { Database } from "../db/client.ts";
import { accounts, sessions, users, verifications } from "../db/schema.ts";
import type { AccountEmail } from "../infra/email.ts";

type AuthOptions = {
  email?: AccountEmail;
  frontendUrl?: string;
};

export function createAuth(db: Database, options: AuthOptions = {}) {
  const frontendUrl = (options.frontendUrl ?? Deno.env.get("FRONTEND_URL") ?? "http://localhost:8888")
    .replace(/\/$/, "");
  return betterAuth({
    baseURL: Deno.env.get("BETTER_AUTH_URL") ?? `http://localhost:${Deno.env.get("PORT") ?? 3000}`,
    trustedOrigins: [frontendUrl],
    secret: Deno.env.get("BETTER_AUTH_SECRET") ?? "dev-only-change-me-dev-only-change-me",
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
      },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: options.email
        ? async ({ user, token }) => {
          const url = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
          await options.email!.send({
            to: user.email,
            subject: "Reset your ZWR API password",
            text: `Reset your password: ${url}`,
          });
        }
        : undefined,
    },
    databaseHooks: {
      user: {
        create: {
          before: (user) => Promise.resolve({ data: { ...user, emailVerified: true } }),
        },
      },
    },
    plugins: [bearer()],
    user: {
      additionalFields: {
        roles: {
          type: "string[]",
          required: false,
          input: false,
          defaultValue: ["ROLE_USER"],
        },
        backgroundImage: {
          type: "string",
          required: false,
          input: false,
        },
        profileColor: {
          type: "string",
          required: false,
          input: false,
          defaultValue: "#101311",
        },
        profileGradientColor: {
          type: "string",
          required: false,
          input: false,
        },
        profileGradientAngle: {
          type: "number",
          required: false,
          input: false,
          defaultValue: 135,
        },
        countryCode: {
          type: "string",
          required: false,
          input: false,
        },
        countryChangedAt: {
          type: "date",
          required: false,
          input: false,
        },
      },
    },
  });
}
