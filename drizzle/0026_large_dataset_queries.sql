UPDATE "submissions" AS submission
SET "competitor_key" = roster."competitor_key"
FROM (
  SELECT "submission_id",
    'team:' || string_agg("user_id", ':' ORDER BY "user_id") AS "competitor_key"
  FROM "submission_participants"
  WHERE "status" = 'accepted'
  GROUP BY "submission_id"
) AS roster
WHERE roster."submission_id" = submission."id"
  AND submission."competitor_key" IS DISTINCT FROM roster."competitor_key";

CREATE INDEX IF NOT EXISTS "submission_participants_personal_best_user_submission_idx"
ON "submission_participants" ("user_id", "submission_id")
WHERE "is_personal_best" = true;

CREATE INDEX IF NOT EXISTS "best_records_points_idx"
ON "best_records" ("points" DESC, "submission_id");

CREATE INDEX IF NOT EXISTS "submissions_roster_lookup_idx"
ON "submissions" ("competitor_key", "player_count", "map_id", "category_assignment_id")
WHERE "status" = 'verified';
