CREATE INDEX IF NOT EXISTS "submissions_manual_daily_quota_idx"
ON "submissions" ("submitted_by", "submitted_at")
WHERE "external_id" IS NULL;
