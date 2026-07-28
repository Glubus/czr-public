ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "submission_group_id" text;
CREATE INDEX IF NOT EXISTS "submissions_group_idx" ON "submissions" ("submission_group_id");
