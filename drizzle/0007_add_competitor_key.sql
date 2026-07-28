ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "competitor_key" text;
--> statement-breakpoint
UPDATE "submissions" AS submission
SET "competitor_key" = COALESCE(
  (
    SELECT 'team:' || string_agg(participant."user_id", ':' ORDER BY participant."user_id")
    FROM "submission_participants" AS participant
    WHERE participant."submission_id" = submission."id"
  ),
  'team:' || submission."user_id"
)
WHERE "competitor_key" IS NULL;
--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "competitor_key" SET NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "submissions_competitor_best_idx"
  ON "submissions" ("map_id", "category_assignment_id", "competitor_key")
  WHERE "status" = 'verified';
