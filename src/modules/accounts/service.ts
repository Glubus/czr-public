import { and, eq, isNull, or } from "drizzle-orm";
import { Effect, Schema } from "effect";
import { verifyPassword } from "better-auth/crypto";
import type { Database } from "../../db/client.ts";
import { accounts, follows, profileClaims, sessions, users, verifications } from "../../db/schema.ts";
import { ConflictError, NotFoundError, ValidationError } from "../shared/errors.ts";

const UpdateProfilePayload = Schema.Struct({
  name: Schema.optional(Schema.String.pipe(Schema.minLength(1), Schema.maxLength(80))),
  profileColor: Schema.optional(Schema.String.pipe(Schema.pattern(/^#[0-9a-fA-F]{6}$/))),
  profileGradientColor: Schema.optional(
    Schema.NullOr(Schema.String.pipe(Schema.pattern(/^#[0-9a-fA-F]{6}$/))),
  ),
  profileGradientAngle: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(0, 360))),
  countryCode: Schema.optional(
    Schema.NullOr(Schema.String.pipe(Schema.pattern(/^[A-Za-z]{2}$/))),
  ),
});
const DeleteAccountPayload = Schema.Struct({
  confirmation: Schema.Literal("DELETE"),
  password: Schema.String.pipe(Schema.minLength(1)),
});

export function updateOwnProfile(db: Database, userId: string, payload: unknown) {
  return Schema.decodeUnknown(UpdateProfilePayload)(payload).pipe(
    Effect.mapError((error) => new ValidationError(String(error))),
    Effect.flatMap((decoded) =>
      Effect.tryPromise({
        try: async () => {
          if (
            decoded.name === undefined &&
            decoded.profileColor === undefined && decoded.profileGradientColor === undefined &&
            decoded.profileGradientAngle === undefined && decoded.countryCode === undefined
          ) {
            throw new ValidationError("at least one profile field must be provided");
          }
          const [current] = await db.select({
            countryCode: users.countryCode,
            countryChangedAt: users.countryChangedAt,
            roles: users.roles,
          }).from(users).where(and(eq(users.id, userId), isNull(users.deletedAt))).limit(1);
          if (!current) throw new NotFoundError("user not found");
          const countryCode = decoded.countryCode === undefined
            ? undefined
            : decoded.countryCode?.toUpperCase() ?? null;
          const countryChanged = countryCode !== undefined && countryCode !== current.countryCode;
          const canBypassCountryLock = current.roles.includes("ROLE_ADMIN");
          if (countryChanged && current.countryChangedAt && !canBypassCountryLock) {
            const nextChangeAt = new Date(current.countryChangedAt);
            nextChangeAt.setUTCMonth(nextChangeAt.getUTCMonth() + 1);
            if (nextChangeAt > new Date()) {
              throw new ConflictError(
                `country can be changed again on ${nextChangeAt.toISOString()}`,
              );
            }
          }
          const [updated] = await db.update(users).set({
            ...(decoded.name === undefined ? {} : { name: decoded.name.trim() }),
            ...(decoded.profileColor === undefined
              ? {}
              : { profileColor: decoded.profileColor.toLowerCase() }),
            ...(decoded.profileGradientColor === undefined
              ? {}
              : { profileGradientColor: decoded.profileGradientColor?.toLowerCase() ?? null }),
            ...(decoded.profileGradientAngle === undefined
              ? {}
              : { profileGradientAngle: decoded.profileGradientAngle }),
            ...(countryCode === undefined ? {} : {
              countryCode,
              ...(countryChanged ? { countryChangedAt: new Date() } : {}),
            }),
            updatedAt: new Date(),
          }).where(and(eq(users.id, userId), isNull(users.deletedAt))).returning({
            id: users.id,
            name: users.name,
            image: users.image,
            profileColor: users.profileColor,
            profileGradientColor: users.profileGradientColor,
            profileGradientAngle: users.profileGradientAngle,
            countryCode: users.countryCode,
            countryChangedAt: users.countryChangedAt,
          });
          if (!updated) throw new NotFoundError("user not found");
          return updated;
        },
        catch: (error) => error,
      })
    ),
  );
}

export function deleteOwnAccount(db: Database, userId: string, payload: unknown) {
  return Schema.decodeUnknown(DeleteAccountPayload)(payload).pipe(
    Effect.mapError((error) => new ValidationError(String(error))),
    Effect.flatMap((decoded) =>
      Effect.tryPromise({
        try: () =>
          db.transaction(async (transaction) => {
            const [user] = await transaction.select().from(users).where(eq(users.id, userId)).limit(1);
            if (!user || user.deletedAt) throw new NotFoundError("user not found");
            const [credential] = await transaction.select({ password: accounts.password }).from(accounts)
              .where(
                and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")),
              ).limit(1);
            if (
              !credential?.password ||
              !await verifyPassword({ hash: credential.password, password: decoded.password })
            ) {
              throw new ValidationError("current password is invalid");
            }
            if (Array.isArray(user.roles) && user.roles.includes("ROLE_ADMIN")) {
              throw new ConflictError("admin accounts must be demoted before deletion");
            }

            await transaction.delete(sessions).where(eq(sessions.userId, userId));
            await transaction.delete(accounts).where(eq(accounts.userId, userId));
            await transaction.delete(verifications).where(eq(verifications.identifier, user.email));
            await transaction.delete(follows).where(or(
              eq(follows.followerUserId, userId),
              and(eq(follows.targetType, "user"), eq(follows.targetId, userId)),
            ));
            await transaction.update(profileClaims).set({
              status: "rejected",
              reviewNote: "Claim closed because the claimant deleted their account",
              reviewedAt: new Date(),
            }).where(and(eq(profileClaims.claimantUserId, userId), eq(profileClaims.status, "pending")));
            await transaction.update(users).set({
              externalId: null,
              name: "Deleted user",
              email: `deleted+${userId}@deleted.invalid`,
              emailVerified: false,
              image: null,
              backgroundImage: null,
              profileColor: "#101311",
              profileGradientColor: null,
              profileGradientAngle: 135,
              countryCode: null,
              countryChangedAt: null,
              roles: ["ROLE_USER"],
              deletedAt: new Date(),
              updatedAt: new Date(),
            }).where(eq(users.id, userId));
            return { deleted: true };
          }),
        catch: (error) => error,
      })
    ),
  );
}
