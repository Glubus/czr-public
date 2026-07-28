ALTER TABLE "achievement_definitions"
  DROP CONSTRAINT IF EXISTS "achievement_definitions_metric_check";

ALTER TABLE "achievement_definitions"
  ADD CONSTRAINT "achievement_definitions_metric_check"
  CHECK ("metric" IN (
    'performance_points', 'verified_submissions', 'world_records', 'games_played', 'team_records',
    'record_points', 'classic_high_round', 'bo3_high_round', 'waw_high_round',
    'speedrun_30', 'speedrun_50', 'speedrun_100',
    'other_speedrun_30', 'other_speedrun_50', 'other_speedrun_100',
    'no_power_round', 'maps_played', 'team_best_rank',
    'map_top15_categories', 'map_all_categories_top15',
    'world_records_2p', 'world_records_3p', 'world_records_4p',
    'team_formats_played', 'categories_played', 'game_high_round_top15_complete',
    'game_ee_top20_records', 'game_all_ee_top20',
    'community_records', 'community_best_rank', 'bo3_gum_trio_best_rank'
  ));

UPDATE "achievement_definitions"
SET
  "points" = CASE "tier"
    WHEN 1 THEN 10 WHEN 2 THEN 15 WHEN 3 THEN 20 WHEN 4 THEN 25 ELSE 35
  END,
  "description" = regexp_replace(
    "description",
    '\.$',
    ' on Black Ops, Black Ops 2 or Black Ops 3.'
  ),
  "updated_at" = now()
WHERE "series" = 'speed-demon'
  AND "description" NOT LIKE '%Black Ops 3.';

UPDATE "achievement_definitions"
SET
  "points" = CASE "tier" WHEN 1 THEN 15 WHEN 2 THEN 20 WHEN 3 THEN 25 ELSE 40 END,
  "description" = regexp_replace(
    "description",
    '\.$',
    ' on Black Ops, Black Ops 2 or Black Ops 3.'
  ),
  "updated_at" = now()
WHERE "series" = '50-speedrun'
  AND "description" NOT LIKE '%Black Ops 3.';

UPDATE "achievement_definitions"
SET
  "points" = CASE "tier" WHEN 1 THEN 20 WHEN 2 THEN 25 WHEN 3 THEN 35 ELSE 50 END,
  "description" = regexp_replace(
    "description",
    '\.$',
    ' on Black Ops, Black Ops 2 or Black Ops 3.'
  ),
  "updated_at" = now()
WHERE "series" = '100-speedrun'
  AND "description" NOT LIKE '%Black Ops 3.';

UPDATE "achievement_definitions"
SET
  "points" = CASE "tier"
    WHEN 1 THEN 5
    WHEN 2 THEN 10
    WHEN 3 THEN 10
    WHEN 4 THEN 15
    WHEN 5 THEN 20
    WHEN 6 THEN 25
    WHEN 7 THEN 30
    WHEN 8 THEN 35
    WHEN 9 THEN 40
    WHEN 10 THEN 45
    WHEN 11 THEN 50
    WHEN 12 THEN 60
    WHEN 13 THEN 75
    ELSE 100
  END,
  "updated_at" = now()
WHERE "series" = 'total-performance-pp';

INSERT INTO "achievement_definitions"
  ("slug", "name", "description", "metric", "threshold", "direction", "category", "series", "tier", "points")
VALUES
  ('community-record-1', 'Community Debut', 'Set a verified record on a Custom or UEM map.', 'community_records', 1, 'higher_is_better', 'Community', 'community-regular', 1, 5),
  ('community-record-10', 'Workshop Regular', 'Set verified records on 10 Custom or UEM boards.', 'community_records', 10, 'higher_is_better', 'Community', 'community-regular', 2, 10),
  ('community-record-25', 'Community Mainstay', 'Set verified records on 25 Custom or UEM boards.', 'community_records', 25, 'higher_is_better', 'Community', 'community-regular', 3, 20),
  ('community-rank-25', 'Community Climber', 'Reach the top 25 of a Custom or UEM board.', 'community_best_rank', 25, 'lower_is_better', 'Community', 'community-rank', 1, 10),
  ('community-rank-10', 'Workshop Contender', 'Reach the top 10 of a Custom or UEM board.', 'community_best_rank', 10, 'lower_is_better', 'Community', 'community-rank', 2, 15),
  ('community-rank-3', 'Community Podium', 'Reach the podium of a Custom or UEM board.', 'community_best_rank', 3, 'lower_is_better', 'Community', 'community-rank', 3, 25),
  ('community-rank-1', 'Community Crown', 'Reach #1 on a Custom or UEM board.', 'community_best_rank', 1, 'lower_is_better', 'Community', 'community-rank', 4, 50),
  ('bo3-gum-trio-top5', 'Gum Control', 'On BO3, reach the top 5 on the same map, category and player count with No Gum, Classic Gum and Mega Gum.', 'bo3_gum_trio_best_rank', 5, 'lower_is_better', 'Game Mastery', 'bo3-gum-trio', 1, 25),
  ('bo3-gum-trio-top3', 'Chew on This', 'On BO3, reach the top 3 on the same map, category and player count with No Gum, Classic Gum and Mega Gum.', 'bo3_gum_trio_best_rank', 3, 'lower_is_better', 'Game Mastery', 'bo3-gum-trio', 2, 50),
  ('bo3-gum-trio-top1', 'GobbleGum Grand Slam', 'On BO3, reach #1 on the same map, category and player count with No Gum, Classic Gum and Mega Gum.', 'bo3_gum_trio_best_rank', 1, 'lower_is_better', 'Game Mastery', 'bo3-gum-trio', 3, 100),
  ('other-30sr-25', 'Modern Sprint', 'Finish a 30 Speedrun outside BO1-BO3 in 25:00 or faster.', 'other_speedrun_30', 1500000, 'lower_is_better', 'Other Games Speedruns', 'other-30-speedrun', 1, 10),
  ('other-30sr-22', 'Modern Rush', 'Finish a 30 Speedrun outside BO1-BO3 in 22:00 or faster.', 'other_speedrun_30', 1320000, 'lower_is_better', 'Other Games Speedruns', 'other-30-speedrun', 2, 15),
  ('other-30sr-20', 'Modern Blitz', 'Finish a 30 Speedrun outside BO1-BO3 in 20:00 or faster.', 'other_speedrun_30', 1200000, 'lower_is_better', 'Other Games Speedruns', 'other-30-speedrun', 3, 25),
  ('other-50sr-45', 'Alternate Route', 'Finish a 50 Speedrun outside BO1-BO3 in 45:00 or faster.', 'other_speedrun_50', 2700000, 'lower_is_better', 'Other Games Speedruns', 'other-50-speedrun', 1, 15),
  ('other-50sr-40', 'Alternate Express', 'Finish a 50 Speedrun outside BO1-BO3 in 40:00 or faster.', 'other_speedrun_50', 2400000, 'lower_is_better', 'Other Games Speedruns', 'other-50-speedrun', 2, 20),
  ('other-50sr-35', 'Alternate Lightning', 'Finish a 50 Speedrun outside BO1-BO3 in 35:00 or faster.', 'other_speedrun_50', 2100000, 'lower_is_better', 'Other Games Speedruns', 'other-50-speedrun', 3, 35),
  ('other-100sr-3h', 'Different Century', 'Finish a 100 Speedrun outside BO1-BO3 in 3:00:00 or faster.', 'other_speedrun_100', 10800000, 'lower_is_better', 'Other Games Speedruns', 'other-100-speedrun', 1, 20),
  ('other-100sr-2h45', 'Century Detour', 'Finish a 100 Speedrun outside BO1-BO3 in 2:45:00 or faster.', 'other_speedrun_100', 9900000, 'lower_is_better', 'Other Games Speedruns', 'other-100-speedrun', 2, 25),
  ('other-100sr-2h30', 'Century Shortcut', 'Finish a 100 Speedrun outside BO1-BO3 in 2:30:00 or faster.', 'other_speedrun_100', 9000000, 'lower_is_better', 'Other Games Speedruns', 'other-100-speedrun', 3, 45)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "metric" = EXCLUDED."metric",
  "threshold" = EXCLUDED."threshold",
  "direction" = EXCLUDED."direction",
  "category" = EXCLUDED."category",
  "series" = EXCLUDED."series",
  "tier" = EXCLUDED."tier",
  "points" = EXCLUDED."points",
  "active" = true,
  "updated_at" = now();

CREATE INDEX IF NOT EXISTS "maps_type_id_idx" ON "maps" ("type", "id");
CREATE INDEX IF NOT EXISTS "category_assignments_gum_rules_idx"
  ON "category_assignments" (("specific_rules"->>'zwrSubrecord'));
CREATE INDEX IF NOT EXISTS "submission_participants_accepted_user_submission_idx"
  ON "submission_participants" ("user_id", "submission_id")
  WHERE "status" = 'accepted';
