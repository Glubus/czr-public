ALTER TABLE "user_goals" DROP CONSTRAINT IF EXISTS "user_goals_metric_check";
ALTER TABLE "user_goals" ADD COLUMN "game_id" integer REFERENCES "games"("id") ON DELETE CASCADE;
ALTER TABLE "user_goals" ADD COLUMN "map_id" integer REFERENCES "maps"("id") ON DELETE CASCADE;
ALTER TABLE "user_goals" ADD COLUMN "category_assignment_id" integer REFERENCES "category_assignments"("id") ON DELETE CASCADE;
ALTER TABLE "user_goals" ADD COLUMN "player_count" integer;
ALTER TABLE "user_goals" ADD CONSTRAINT "user_goals_metric_check"
  CHECK ("metric" IN ('performance_points', 'verified_submissions', 'round', 'time', 'rank'));
ALTER TABLE "user_goals" ADD CONSTRAINT "user_goals_board_target_check" CHECK (
  ("metric" IN ('performance_points', 'verified_submissions')
    AND "game_id" IS NULL AND "map_id" IS NULL AND "category_assignment_id" IS NULL AND "player_count" IS NULL)
  OR
  ("metric" IN ('round', 'time', 'rank')
    AND "game_id" IS NOT NULL AND "map_id" IS NOT NULL
    AND "category_assignment_id" IS NOT NULL AND "player_count" BETWEEN 1 AND 4)
);
CREATE INDEX "user_goals_board_idx"
  ON "user_goals" ("map_id", "category_assignment_id", "player_count")
  WHERE "map_id" IS NOT NULL;
