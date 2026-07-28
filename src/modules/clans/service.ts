import { and, asc, desc, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { Effect, Schema } from "effect";
import type { Database } from "../../db/client.ts";
import { clanAuditEvents, clanInvitations, clanMembers, clans, users } from "../../db/schema.ts";
import { ConflictError, NotFoundError, ValidationError } from "../shared/errors.ts";

const CreateClanPayload = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(2), Schema.maxLength(80)),
});
const InvitePayload = Schema.Struct({ userId: Schema.String.pipe(Schema.minLength(1)) });
const InvitationResponsePayload = Schema.Struct({ status: Schema.Literal("accepted", "rejected") });
const MemberRolePayload = Schema.Struct({ role: Schema.Literal("admin", "member") });
const TransferOwnershipPayload = Schema.Struct({ userId: Schema.String.pipe(Schema.minLength(1)) });
const ClanPreferencesPayload = Schema.Struct({ autoAcceptClanRuns: Schema.Boolean });

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

export function createClan(db: Database, actorUserId: string, payload: unknown) {
  return decode(CreateClanPayload, payload).pipe(
    Effect.flatMap((decoded) =>
      databaseEffect(async () => {
        const name = decoded.name.trim();
        return await db.transaction(async (transaction) => {
          const tx = transaction as unknown as Database;
          await lockClanMembership(tx, actorUserId);
          await assertNoClanMembership(tx, actorUserId);
          const slug = await availableClanSlug(tx, name);
          const [clan] = await tx.insert(clans).values({ slug, name, createdBy: actorUserId }).returning();
          if (!clan) throw new ConflictError("clan could not be created");
          await tx.insert(clanMembers).values({ clanId: clan.id, userId: actorUserId, role: "owner" });
          await audit(tx, clan.id, actorUserId, actorUserId, "clan_created");
          return getClanDetail(tx, clan.id);
        });
      })
    ),
  );
}

export function getClanBySlug(db: Database, slug: string) {
  return databaseEffect(async () => {
    const [clan] = await db.select({ id: clans.id }).from(clans).where(eq(clans.slug, slug)).limit(1);
    if (!clan) throw new NotFoundError("clan not found");
    return getClanDetail(db, clan.id);
  });
}

export function getOwnClan(db: Database, userId: string) {
  return databaseEffect(async () => {
    const [membership] = await db.select({ clanId: clanMembers.clanId }).from(clanMembers)
      .where(eq(clanMembers.userId, userId)).limit(1);
    return { clan: membership ? await getClanDetail(db, membership.clanId) : null };
  });
}

export function createClanInvitation(db: Database, clanId: number, actorUserId: string, payload: unknown) {
  return decode(InvitePayload, payload).pipe(
    Effect.flatMap((decoded) =>
      databaseEffect(() =>
        db.transaction(async (transaction) => {
          const tx = transaction as unknown as Database;
          assertPositiveId(clanId, "clanId");
          await requireClanRole(tx, clanId, actorUserId, ["owner", "admin"]);
          if (decoded.userId === actorUserId) throw new ValidationError("a user cannot invite themselves");
          const [invitee] = await tx.select({ id: users.id }).from(users).where(
            and(eq(users.id, decoded.userId), isNull(users.deletedAt)),
          ).limit(1);
          if (!invitee) throw new NotFoundError("invitee not found");
          const [existingMembership] = await tx.select({ clanId: clanMembers.clanId }).from(clanMembers)
            .where(eq(clanMembers.userId, decoded.userId)).limit(1);
          if (existingMembership) throw new ConflictError("invitee already belongs to a clan");
          const [created] = await tx.insert(clanInvitations).values({
            clanId,
            inviteeUserId: decoded.userId,
            invitedBy: actorUserId,
            expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
          }).returning();
          if (!created) throw new ConflictError("clan invitation could not be created");
          await audit(tx, clanId, actorUserId, decoded.userId, "member_invited", {
            invitationId: created.id,
          });
          return created;
        })
      )
    ),
  );
}

export function listOwnClanInvitations(db: Database, userId: string) {
  return databaseEffect(() =>
    db.select({
      invitation: clanInvitations,
      clan: { id: clans.id, slug: clans.slug, name: clans.name },
      inviter: { id: users.id, name: users.name },
    }).from(clanInvitations)
      .innerJoin(clans, eq(clanInvitations.clanId, clans.id))
      .leftJoin(users, eq(clanInvitations.invitedBy, users.id))
      .where(and(
        eq(clanInvitations.inviteeUserId, userId),
        eq(clanInvitations.status, "pending"),
        gt(clanInvitations.expiresAt, new Date()),
      ))
      .orderBy(desc(clanInvitations.createdAt), desc(clanInvitations.id))
  );
}

export function listClanInvitations(db: Database, clanId: number, actorUserId: string) {
  return databaseEffect(async () => {
    assertPositiveId(clanId, "clanId");
    await requireClanRole(db, clanId, actorUserId, ["owner", "admin"]);
    return db.select({
      invitation: clanInvitations,
      invitee: { id: users.id, name: users.name, image: users.image },
    }).from(clanInvitations)
      .innerJoin(users, eq(clanInvitations.inviteeUserId, users.id))
      .where(eq(clanInvitations.clanId, clanId))
      .orderBy(desc(clanInvitations.createdAt), desc(clanInvitations.id)).limit(100);
  });
}

export function respondClanInvitation(db: Database, invitationId: number, userId: string, payload: unknown) {
  return decode(InvitationResponsePayload, payload).pipe(
    Effect.flatMap((decoded) =>
      databaseEffect(() =>
        db.transaction(async (transaction) => {
          const tx = transaction as unknown as Database;
          assertPositiveId(invitationId, "invitationId");
          const [candidate] = await tx.select({ inviteeUserId: clanInvitations.inviteeUserId })
            .from(clanInvitations).where(eq(clanInvitations.id, invitationId)).limit(1);
          if (!candidate || candidate.inviteeUserId !== userId) {
            throw new NotFoundError("clan invitation not found");
          }
          await lockClanMembership(tx, userId);
          const [invitation] = await tx.select().from(clanInvitations).where(
            eq(clanInvitations.id, invitationId),
          ).for("update").limit(1);
          if (!invitation) throw new NotFoundError("clan invitation not found");
          if (invitation.status !== "pending") {
            throw new ConflictError("clan invitation is no longer pending");
          }
          if (invitation.expiresAt <= new Date()) {
            throw new ConflictError("clan invitation has expired");
          }

          if (decoded.status === "rejected") {
            const [updated] = await tx.update(clanInvitations).set({
              status: "rejected",
              respondedAt: new Date(),
            }).where(eq(clanInvitations.id, invitation.id)).returning();
            await audit(tx, invitation.clanId, userId, userId, "invitation_rejected", {
              invitationId: invitation.id,
            });
            return { invitation: updated, clan: null };
          }

          await assertNoClanMembership(tx, userId);
          await tx.insert(clanMembers).values({ clanId: invitation.clanId, userId, role: "member" });
          const [updated] = await tx.update(clanInvitations).set({
            status: "accepted",
            respondedAt: new Date(),
          }).where(eq(clanInvitations.id, invitation.id)).returning();
          await tx.update(clanInvitations).set({ status: "revoked", respondedAt: new Date() }).where(and(
            eq(clanInvitations.inviteeUserId, userId),
            eq(clanInvitations.status, "pending"),
            ne(clanInvitations.id, invitation.id),
          ));
          await audit(tx, invitation.clanId, userId, userId, "invitation_accepted", {
            invitationId: invitation.id,
          });
          return { invitation: updated, clan: await getClanDetail(tx, invitation.clanId) };
        })
      )
    ),
  );
}

export function updateClanMemberRole(
  db: Database,
  clanId: number,
  targetUserId: string,
  actorUserId: string,
  payload: unknown,
) {
  return decode(MemberRolePayload, payload).pipe(
    Effect.flatMap((decoded) =>
      databaseEffect(() =>
        db.transaction(async (transaction) => {
          const tx = transaction as unknown as Database;
          assertPositiveId(clanId, "clanId");
          await requireClanRole(tx, clanId, actorUserId, ["owner"]);
          const target = await requireClanRole(tx, clanId, targetUserId, ["admin", "member"]);
          const [updated] = await tx.update(clanMembers).set({ role: decoded.role }).where(
            eq(clanMembers.id, target.id),
          ).returning();
          await audit(tx, clanId, actorUserId, targetUserId, "member_role_changed", {
            previousRole: target.role,
            role: decoded.role,
          });
          return updated;
        })
      )
    ),
  );
}

export function transferClanOwnership(db: Database, clanId: number, actorUserId: string, payload: unknown) {
  return decode(TransferOwnershipPayload, payload).pipe(
    Effect.flatMap((decoded) =>
      databaseEffect(() =>
        db.transaction(async (transaction) => {
          const tx = transaction as unknown as Database;
          assertPositiveId(clanId, "clanId");
          const owner = await requireClanRole(tx, clanId, actorUserId, ["owner"]);
          if (decoded.userId === actorUserId) throw new ValidationError("target user already owns the clan");
          const target = await requireClanRole(tx, clanId, decoded.userId, ["admin", "member"]);
          await tx.update(clanMembers).set({ role: "admin" }).where(eq(clanMembers.id, owner.id));
          await tx.update(clanMembers).set({ role: "owner" }).where(eq(clanMembers.id, target.id));
          await audit(tx, clanId, actorUserId, decoded.userId, "ownership_transferred");
          return getClanDetail(tx, clanId);
        })
      )
    ),
  );
}

export function removeClanMember(db: Database, clanId: number, targetUserId: string, actorUserId: string) {
  return databaseEffect(() =>
    db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;
      assertPositiveId(clanId, "clanId");
      const actor = await requireClanRole(tx, clanId, actorUserId, ["owner", "admin", "member"]);
      const target = await requireClanRole(tx, clanId, targetUserId, ["owner", "admin", "member"]);
      if (target.role === "owner") {
        throw new ConflictError("clan ownership must be transferred before leaving");
      }
      if (targetUserId !== actorUserId) {
        if (actor.role === "member" || (actor.role === "admin" && target.role !== "member")) {
          throw new ConflictError("member cannot be removed by this clan role");
        }
      }
      await tx.delete(clanMembers).where(eq(clanMembers.id, target.id));
      await audit(
        tx,
        clanId,
        actorUserId,
        targetUserId,
        targetUserId === actorUserId ? "member_left" : "member_removed",
      );
      return { removed: true };
    })
  );
}

export function revokeClanInvitation(
  db: Database,
  clanId: number,
  invitationId: number,
  actorUserId: string,
) {
  return databaseEffect(() =>
    db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;
      assertPositiveId(clanId, "clanId");
      assertPositiveId(invitationId, "invitationId");
      await requireClanRole(tx, clanId, actorUserId, ["owner", "admin"]);
      const [invitation] = await tx.select().from(clanInvitations).where(and(
        eq(clanInvitations.id, invitationId),
        eq(clanInvitations.clanId, clanId),
      )).for("update").limit(1);
      if (!invitation) throw new NotFoundError("clan invitation not found");
      if (invitation.status !== "pending") throw new ConflictError("clan invitation is no longer pending");
      const [updated] = await tx.update(clanInvitations).set({ status: "revoked", respondedAt: new Date() })
        .where(eq(clanInvitations.id, invitation.id)).returning();
      await audit(tx, clanId, actorUserId, invitation.inviteeUserId, "invitation_revoked", {
        invitationId,
      });
      return updated;
    })
  );
}

export function updateClanPreferences(db: Database, userId: string, payload: unknown) {
  return decode(ClanPreferencesPayload, payload).pipe(
    Effect.flatMap((decoded) =>
      databaseEffect(async () => {
        const [updated] = await db.update(users).set({
          autoAcceptClanRuns: decoded.autoAcceptClanRuns,
          updatedAt: new Date(),
        }).where(and(eq(users.id, userId), isNull(users.deletedAt))).returning({
          autoAcceptClanRuns: users.autoAcceptClanRuns,
        });
        if (!updated) throw new NotFoundError("user not found");
        return updated;
      })
    ),
  );
}

export function getClanPreferences(db: Database, userId: string) {
  return databaseEffect(async () => {
    const [preferences] = await db.select({ autoAcceptClanRuns: users.autoAcceptClanRuns }).from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt))).limit(1);
    if (!preferences) throw new NotFoundError("user not found");
    return preferences;
  });
}

export function listClanAuditEvents(db: Database, clanId: number, actorUserId: string) {
  return databaseEffect(async () => {
    assertPositiveId(clanId, "clanId");
    await requireClanRole(db, clanId, actorUserId, ["owner", "admin"]);
    return db.select().from(clanAuditEvents).where(eq(clanAuditEvents.clanId, clanId))
      .orderBy(desc(clanAuditEvents.createdAt), desc(clanAuditEvents.id)).limit(100);
  });
}

async function getClanDetail(db: Database, clanId: number) {
  const [clan] = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  if (!clan) throw new NotFoundError("clan not found");
  const members = await db.select({
    id: clanMembers.id,
    role: clanMembers.role,
    joinedAt: clanMembers.joinedAt,
    user: {
      id: users.id,
      name: users.name,
      image: users.image,
      performancePoints: users.performancePoints,
    },
  }).from(clanMembers).innerJoin(users, eq(clanMembers.userId, users.id))
    .where(eq(clanMembers.clanId, clanId))
    .orderBy(asc(clanMembers.joinedAt), asc(clanMembers.id));
  return { ...clan, members };
}

async function availableClanSlug(db: Database, name: string) {
  const normalized = name.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 34) || "clan";
  const existing = await db.select({ slug: clans.slug }).from(clans)
    .where(sql`${clans.slug} = ${normalized} OR ${clans.slug} LIKE ${`${normalized}-%`}`);
  const used = new Set(existing.map((entry) => entry.slug));
  if (!used.has(normalized)) return normalized;
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const text = String(suffix);
    const candidate = `${normalized.slice(0, 39 - text.length)}-${text}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new ConflictError("a URL could not be generated for this clan name");
}

async function requireClanRole(
  db: Database,
  clanId: number,
  userId: string,
  allowed: ReadonlyArray<"owner" | "admin" | "member">,
) {
  const [membership] = await db.select().from(clanMembers).where(and(
    eq(clanMembers.clanId, clanId),
    eq(clanMembers.userId, userId),
  )).limit(1);
  if (!membership) throw new NotFoundError("clan membership not found");
  if (!allowed.includes(membership.role)) throw new ConflictError("clan role cannot perform this action");
  return membership;
}

async function lockClanMembership(db: Database, userId: string) {
  await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`clan-membership:${userId}`}))`);
}

async function assertNoClanMembership(db: Database, userId: string) {
  const [membership] = await db.select({ id: clanMembers.id }).from(clanMembers)
    .where(eq(clanMembers.userId, userId)).limit(1);
  if (membership) throw new ConflictError("user already belongs to a clan");
}

function audit(
  db: Database,
  clanId: number,
  actorUserId: string | null,
  targetUserId: string | null,
  type: typeof clanAuditEvents.$inferInsert.type,
  metadata: Record<string, unknown> = {},
) {
  return db.insert(clanAuditEvents).values({ clanId, actorUserId, targetUserId, type, metadata });
}

function decode<A, I>(schema: Schema.Schema<A, I, never>, payload: unknown) {
  return Schema.decodeUnknown(schema)(payload).pipe(
    Effect.mapError((error) => new ValidationError(String(error))),
  );
}

function databaseEffect<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({
    try: operation,
    catch: normalizeClanError,
  });
}

function normalizeClanError(error: unknown) {
  if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
    return error;
  }
  if (postgresErrorCode(error) === "23505") return new ConflictError("clan data already exists");
  return error;
}

function postgresErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  if ("code" in error && typeof error.code === "string") return error.code;
  return "cause" in error ? postgresErrorCode(error.cause) : undefined;
}

function assertPositiveId(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ValidationError(`${name} must be a positive integer`);
  }
}
