import { and, eq, isNull } from "drizzle-orm";
import { Data, Effect } from "effect";
import type { MiddlewareHandler } from "hono";
import type { createAuth } from "./better-auth.ts";
import {
  type CurrentUser,
  decodeRoles,
  ForbiddenError,
  requireRole,
  type Role,
  UnauthorizedError,
} from "./session.ts";
import type { Database } from "../db/client.ts";
import { users } from "../db/schema.ts";
import { problemResponse } from "../http/problem.ts";

export const authorizationSettings = {
  ROLE_USER: ["submission:create"],
  ROLE_ADMIN: [
    "game:create",
    "map:create",
    "category:create",
    "category:assign",
    "submission:review",
    "user:roles",
    "mod:create",
    "profile-claim:review",
  ],
  ROLE_MAP_NOMINATOR: ["map:preview"],
  ROLE_MODERATOR: ["submission:review", "profile-claim:review"],
  ROLE_CHECKER: ["submission:review"],
  ROLE_VERIFIED: [],
  ROLE_VIP: [],
  ROLE_PREMIUM: [],
} as const satisfies Record<Role, ReadonlyArray<string>>;

export type Permission = (typeof authorizationSettings)[Role][number];
export type Grant = Role | Permission;

export type AuthEnv = {
  Variables: {
    currentUser?: CurrentUser;
    requestId: string;
  };
};

export class AuthenticationError extends Data.TaggedError("AuthenticationError")<{
  cause: unknown;
}> {}

export function loadCurrentUser(
  db: Database,
  auth: ReturnType<typeof createAuth>,
  headers: Headers,
) {
  return Effect.gen(function* () {
    const session = yield* Effect.tryPromise({
      try: () => auth.api.getSession({ headers }),
      catch: (cause) => new AuthenticationError({ cause }),
    });

    if (!session) {
      return undefined;
    }

    const [user] = yield* Effect.tryPromise({
      try: () =>
        db.select({ id: users.id, roles: users.roles }).from(users).where(
          and(eq(users.id, session.user.id), isNull(users.deletedAt)),
        )
          .limit(1),
      catch: (cause) => new AuthenticationError({ cause }),
    });

    if (!user) {
      return undefined;
    }

    const roles = yield* decodeRoles(user.roles).pipe(
      Effect.mapError((cause) => new AuthenticationError({ cause })),
    );

    return { id: user.id, roles } satisfies CurrentUser;
  });
}

export function authenticate(
  db: Database,
  auth: ReturnType<typeof createAuth>,
): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    const exit = await Effect.runPromiseExit(loadCurrentUser(db, auth, c.req.raw.headers));

    if (exit._tag === "Failure") {
      return problemResponse(c, {
        status: 500,
        code: "authentication_error",
        detail: "Authentication could not be evaluated",
      });
    }

    if (exit.value) {
      c.set("currentUser", exit.value);
    }

    await next();
  };
}

export function checkGrant(
  user: CurrentUser | undefined,
  grant: Grant,
): Effect.Effect<void, UnauthorizedError | ForbiddenError> {
  if (grant.startsWith("ROLE_")) {
    return requireRole(user, grant as Role);
  }

  if (!user) {
    return Effect.fail(new UnauthorizedError());
  }

  const allowed = user.roles.some((role) =>
    (authorizationSettings[role] as ReadonlyArray<string>).includes(grant)
  );

  return allowed ? Effect.void : Effect.fail(new ForbiddenError());
}

export function isGranted(grant: Grant): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    const decision = await Effect.runPromise(
      checkGrant(c.get("currentUser"), grant).pipe(
        Effect.match({
          onFailure: (error) => error,
          onSuccess: () => undefined,
        }),
      ),
    );

    if (decision instanceof UnauthorizedError) {
      return problemResponse(c, { status: 401, code: "unauthorized", detail: "Authentication is required" });
    }

    if (decision instanceof ForbiddenError) {
      return problemResponse(c, { status: 403, code: "forbidden", detail: "Permission is required" });
    }

    await next();
  };
}
