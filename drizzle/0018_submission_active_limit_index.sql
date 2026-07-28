DROP INDEX IF EXISTS "submissions_manual_daily_quota_idx";

CREATE INDEX IF NOT EXISTS "submissions_active_submitter_idx"
ON "submissions" ("submitted_by")
WHERE "external_id" IS NULL AND "status" = 'pending';
