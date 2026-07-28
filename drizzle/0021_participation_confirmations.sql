ALTER TABLE "submission_participants"
ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'accepted' NOT NULL;
ALTER TABLE "submission_participants"
ADD COLUMN IF NOT EXISTS "acceptance_source" text DEFAULT 'legacy' NOT NULL;
ALTER TABLE "submission_participants"
ADD COLUMN IF NOT EXISTS "acceptance_clan_id" integer;
ALTER TABLE "submission_participants"
ADD COLUMN IF NOT EXISTS "responded_at" timestamptz;

CREATE TABLE IF NOT EXISTS "participation_invitations" (
  "id" serial PRIMARY KEY,
  "submission_group_id" text NOT NULL,
  "invitee_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "invited_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "responded_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "participation_invitations_group_user_unique"
ON "participation_invitations" ("submission_group_id", "invitee_user_id");
CREATE INDEX IF NOT EXISTS "participation_invitations_invitee_status_idx"
ON "participation_invitations" ("invitee_user_id", "status");

DROP INDEX IF EXISTS "submissions_active_submitter_idx";
CREATE INDEX IF NOT EXISTS "submissions_active_submitter_idx"
ON "submissions" ("submitted_by")
WHERE "external_id" IS NULL AND "status" IN ('awaiting_participants', 'pending');
