import { Data, Effect, Schema } from "effect";

export const RoleSchema = Schema.Literal(
  "ROLE_USER",
  "ROLE_ADMIN",
  "ROLE_MAP_NOMINATOR",
  "ROLE_MODERATOR",
  "ROLE_CHECKER",
  "ROLE_VERIFIED",
  "ROLE_VIP",
  "ROLE_PREMIUM",
);
export const RolesSchema = Schema.Array(RoleSchema);

export type Role = typeof RoleSchema.Type;

export type CurrentUser = {
  id: string;
  roles: ReadonlyArray<Role>;
};

export class UnauthorizedError extends Data.TaggedError("UnauthorizedError") {}
export class ForbiddenError extends Data.TaggedError("ForbiddenError") {}

export function decodeRoles(roles: unknown) {
  return Schema.decodeUnknown(RolesSchema)(roles);
}

export function requireRole(user: CurrentUser | undefined, role: Role) {
  if (!user) {
    return Effect.fail(new UnauthorizedError());
  }

  return user.roles.includes(role) ? Effect.void : Effect.fail(new ForbiddenError());
}
