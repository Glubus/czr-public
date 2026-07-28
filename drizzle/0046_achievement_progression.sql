ALTER TABLE "achievement_definitions"
  ADD COLUMN "direction" text NOT NULL DEFAULT 'higher_is_better',
  ADD COLUMN "category" text NOT NULL DEFAULT 'Milestones',
  ADD COLUMN "series" text NOT NULL DEFAULT 'general',
  ADD COLUMN "tier" integer NOT NULL DEFAULT 1,
  ADD COLUMN "points" integer NOT NULL DEFAULT 10;

ALTER TABLE "achievement_definitions" DROP CONSTRAINT IF EXISTS "achievement_definitions_metric_check";
ALTER TABLE "achievement_definitions"
  ADD CONSTRAINT "achievement_definitions_metric_check"
  CHECK ("metric" IN (
    'performance_points', 'verified_submissions', 'world_records', 'games_played', 'team_records',
    'record_points', 'classic_high_round', 'bo3_high_round', 'waw_high_round',
    'speedrun_30', 'speedrun_50', 'speedrun_100', 'no_power_round'
  ));
ALTER TABLE "achievement_definitions"
  ADD CONSTRAINT "achievement_definitions_direction_check"
  CHECK ("direction" IN ('higher_is_better', 'lower_is_better'));
ALTER TABLE "achievement_definitions"
  ADD CONSTRAINT "achievement_definitions_tier_check" CHECK ("tier" > 0);
ALTER TABLE "achievement_definitions"
  ADD CONSTRAINT "achievement_definitions_points_check" CHECK ("points" > 0);

UPDATE "achievement_definitions" SET
  "category" = 'Records', "series" = 'record-collector',
  "tier" = CASE "slug" WHEN 'first-record' THEN 1 WHEN 'ten-records' THEN 2 WHEN 'fifty-records' THEN 3 ELSE 4 END,
  "points" = CASE "slug" WHEN 'first-record' THEN 10 WHEN 'ten-records' THEN 25 WHEN 'fifty-records' THEN 50 ELSE 100 END
WHERE "slug" IN ('first-record', 'ten-records', 'fifty-records', 'hundred-records');

UPDATE "achievement_definitions" SET
  "category" = 'Performance', "series" = 'performance-ladder',
  "tier" = CASE "slug" WHEN 'first-100-pp' THEN 1 WHEN 'one-thousand-pp' THEN 2 WHEN 'five-thousand-pp' THEN 3 ELSE 4 END,
  "points" = CASE "slug" WHEN 'first-100-pp' THEN 10 WHEN 'one-thousand-pp' THEN 25 WHEN 'five-thousand-pp' THEN 75 ELSE 150 END
WHERE "slug" IN ('first-100-pp', 'one-thousand-pp', 'five-thousand-pp', 'ten-thousand-pp');

UPDATE "achievement_definitions" SET
  "category" = 'World Records', "series" = 'world-record-holder',
  "tier" = CASE WHEN "slug" = 'first-world-record' THEN 1 ELSE 3 END,
  "points" = CASE WHEN "slug" = 'first-world-record' THEN 25 ELSE 150 END
WHERE "slug" IN ('first-world-record', 'ten-world-records');

UPDATE "achievement_definitions" SET
  "category" = 'Exploration', "series" = 'game-explorer',
  "tier" = CASE WHEN "slug" = 'three-games' THEN 1 ELSE 2 END,
  "points" = CASE WHEN "slug" = 'three-games' THEN 25 ELSE 75 END
WHERE "slug" IN ('three-games', 'eight-games');

UPDATE "achievement_definitions" SET
  "category" = 'Teamwork', "series" = 'squad',
  "tier" = CASE WHEN "slug" = 'first-team-record' THEN 1 ELSE 3 END,
  "points" = CASE WHEN "slug" = 'first-team-record' THEN 10 ELSE 75 END
WHERE "slug" IN ('first-team-record', 'twenty-team-records');

INSERT INTO "achievement_definitions"
  ("slug", "name", "description", "metric", "threshold", "direction", "category", "series", "tier", "points")
VALUES
  ('five-world-records', 'World Authority', 'Hold 5 current world records.', 'world_records', 5, 'higher_is_better', 'World Records', 'world-record-holder', 2, 75),
  ('five-team-records', 'Full Party', 'Earn 5 verified team records.', 'team_records', 5, 'higher_is_better', 'Teamwork', 'squad', 2, 30),
  ('fifty-team-records', 'Squad Legends', 'Earn 50 verified team records.', 'team_records', 50, 'higher_is_better', 'Teamwork', 'squad', 4, 150),
  ('single-record-1000-pp', 'Four-Digit Run', 'Earn 1,000 PP from a single current record.', 'record_points', 1000, 'higher_is_better', 'Performance', 'single-record-pp', 1, 100),
  ('single-record-1500-pp', 'One Run Army', 'Earn more than 1,500 PP from a single current record.', 'record_points', 1500.000001, 'higher_is_better', 'Performance', 'single-record-pp', 2, 250),
  ('classic-round-200', 'Old School Survivor', 'Reach round 200 in High Rounds on Black Ops, Black Ops 2 or Black Ops 3.', 'classic_high_round', 200, 'higher_is_better', 'Game Mastery', 'classic-high-round', 1, 100),
  ('bo3-round-255', 'Reset Reached', 'Reach round 255 in High Rounds on Black Ops 3.', 'bo3_high_round', 255, 'higher_is_better', 'Game Mastery', 'bo3-reset', 1, 150),
  ('waw-round-1000', 'The Endless War', 'Reach round 1,000 in High Rounds on World at War.', 'waw_high_round', 1000, 'higher_is_better', 'Game Mastery', 'waw-eternal', 1, 300),
  ('30sr-sub-30', 'Thirty Under Thirty', 'Finish any 30 Speedrun in under 30 minutes.', 'speedrun_30', 1799999, 'lower_is_better', 'Speedruns', '30-speedrun', 1, 100),
  ('50sr-sub-hour', 'Hour Breaker', 'Finish any 50 Speedrun in under one hour.', 'speedrun_50', 3599999, 'lower_is_better', 'Speedruns', '50-speedrun', 1, 125),
  ('100sr-sub-four-hours', 'Four-Hour Club', 'Finish any 100 Speedrun in under four hours.', 'speedrun_100', 14399999, 'lower_is_better', 'Speedruns', '100-speedrun', 1, 175),
  ('no-power-round-100', 'Lights Out', 'Reach round 100 in No Power.', 'no_power_round', 100, 'higher_is_better', 'Challenges', 'no-power', 1, 125)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "metric" = EXCLUDED."metric", "threshold" = EXCLUDED."threshold",
  "direction" = EXCLUDED."direction", "category" = EXCLUDED."category",
  "series" = EXCLUDED."series", "tier" = EXCLUDED."tier",
  "points" = EXCLUDED."points", "active" = true;
