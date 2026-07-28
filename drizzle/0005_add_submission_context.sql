CREATE TABLE "mods" ("id" serial PRIMARY KEY NOT NULL, "game_id" integer NOT NULL REFERENCES "games"("id") ON DELETE cascade, "slug" text NOT NULL, "name" text NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX "mods_game_slug_unique" ON "mods" ("game_id", "slug");
--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "platform" text;
--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "game_version" text;
--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "map_version" text;
--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "mod_id" integer REFERENCES "mods"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "mod_version" text;
--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "rules_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb;
--> statement-breakpoint
CREATE TABLE "submission_participants" ("submission_id" integer NOT NULL REFERENCES "submissions"("id") ON DELETE cascade, "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE restrict, "role" text NOT NULL DEFAULT 'teammate');
--> statement-breakpoint
CREATE UNIQUE INDEX "submission_participants_unique" ON "submission_participants" ("submission_id", "user_id");
--> statement-breakpoint
CREATE INDEX "submission_participants_user_idx" ON "submission_participants" ("user_id");
--> statement-breakpoint
ALTER TABLE "run_artifacts" RENAME TO "submission_proofs";
--> statement-breakpoint
ALTER INDEX IF EXISTS "run_artifacts_submission_idx" RENAME TO "submission_proofs_submission_idx";
--> statement-breakpoint
ALTER TABLE "submission_proofs" ADD COLUMN IF NOT EXISTS "source_url" text;
--> statement-breakpoint
ALTER TABLE "submission_proofs" ADD COLUMN IF NOT EXISTS "mime_type" text;
--> statement-breakpoint
ALTER TABLE "submission_proofs" ALTER COLUMN "storage_key" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "submission_proofs" ALTER COLUMN "sha256" DROP NOT NULL;
