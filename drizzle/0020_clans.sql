ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "auto_accept_clan_runs" boolean DEFAULT true NOT NULL;

CREATE TABLE IF NOT EXISTS "clans" (
  "id" serial PRIMARY KEY,
  "slug" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "created_by" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "clan_members" (
  "id" serial PRIMARY KEY,
  "clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" text DEFAULT 'member' NOT NULL,
  "joined_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "clan_members_clan_user_unique"
ON "clan_members" ("clan_id", "user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "clan_members_user_unique"
ON "clan_members" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "clan_members_one_owner_unique"
ON "clan_members" ("clan_id") WHERE "role" = 'owner';

CREATE TABLE IF NOT EXISTS "clan_invitations" (
  "id" serial PRIMARY KEY,
  "clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE CASCADE,
  "invitee_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "invited_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "responded_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "clan_invitations_invitee_status_idx"
ON "clan_invitations" ("invitee_user_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "clan_invitations_pending_unique"
ON "clan_invitations" ("clan_id", "invitee_user_id") WHERE "status" = 'pending';

CREATE TABLE IF NOT EXISTS "clan_audit_events" (
  "id" serial PRIMARY KEY,
  "clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE CASCADE,
  "actor_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "target_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "type" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "clan_audit_events_clan_created_idx"
ON "clan_audit_events" ("clan_id", "created_at");
