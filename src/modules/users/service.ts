import { and, asc, eq, ilike, isNull, sql } from "drizzle-orm";
import { Effect, Schema } from "effect";
import { RolesSchema } from "../../auth/session.ts";
import type { Database } from "../../db/client.ts";
import { users } from "../../db/schema.ts";
import { NotFoundError, ValidationError } from "../shared/errors.ts";
import { parsePage } from "../shared/pagination.ts";
export { compareUsers } from "./comparison.ts";
export { getUserScopedRanks } from "./ranks.ts";
export { getUserSocialContext } from "./social-context.ts";

const UpdateUserRolesPayload = Schema.Struct({ roles: RolesSchema });
const USER_PAGE_SIZE = 50;

export function listUsers(db: Database, search?: string, pageValue?: string) {
  return Effect.tryPromise({
    try: async () => {
      const page = parsePage(pageValue);
      const query = search?.trim();
      const where = and(isNull(users.deletedAt), query ? ilike(users.name, `%${query}%`) : undefined);
      const rows = await db.select({
        id: users.id,
        name: users.name,
        image: users.image,
        performancePoints: users.performancePoints,
        isClaimable: sql<
          boolean
        >`${users.externalId} LIKE 'zwr:player:%' AND ${users.email} LIKE '%@import.local'`,
      }).from(users).where(where).orderBy(asc(users.name), asc(users.id))
        .limit(USER_PAGE_SIZE + 1).offset(page * USER_PAGE_SIZE);
      return {
        search: query ?? null,
        page,
        pageSize: USER_PAGE_SIZE,
        hasMore: rows.length > USER_PAGE_SIZE,
        entries: rows.slice(0, USER_PAGE_SIZE),
      };
    },
    catch: (error) => error,
  });
}

export function updateUserRoles(db: Database, userId: string, payload: unknown) {
  return Schema.decodeUnknown(UpdateUserRolesPayload)(payload).pipe(
    Effect.mapError((error) => new ValidationError(String(error))),
    Effect.flatMap(({ roles }) =>
      Effect.tryPromise({
        try: async () => {
          const uniqueRoles = [...new Set(roles)];
          if (uniqueRoles.length === 0) throw new ValidationError("a user must keep at least one role");
          const [updated] = await db.update(users).set({ roles: uniqueRoles }).where(eq(users.id, userId))
            .returning({ id: users.id, name: users.name, roles: users.roles });
          if (!updated) throw new NotFoundError("user not found");
          return updated;
        },
        catch: (error) => error,
      })
    ),
  );
}
