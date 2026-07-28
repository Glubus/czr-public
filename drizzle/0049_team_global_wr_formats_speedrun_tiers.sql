ALTER TABLE "achievement_definitions" DROP CONSTRAINT IF EXISTS "achievement_definitions_metric_check";
ALTER TABLE "achievement_definitions"
  ADD CONSTRAINT "achievement_definitions_metric_check"
  CHECK ("metric" IN (
    'performance_points', 'verified_submissions', 'world_records', 'games_played', 'team_records',
    'record_points', 'classic_high_round', 'bo3_high_round', 'waw_high_round',
    'speedrun_30', 'speedrun_50', 'speedrun_100', 'no_power_round',
    'maps_played', 'team_best_rank', 'map_top10_categories', 'map_all_categories_top10',
    'world_records_2p', 'world_records_3p', 'world_records_4p',
    'team_formats_played', 'categories_played', 'game_high_round_top15_complete',
    'game_ee_top20_records', 'game_all_ee_top20'
  ));

UPDATE "achievement_definitions"
SET
  "description" = CASE "slug"
    WHEN 'team-rank-50' THEN 'Reach the top 50 of a global team leaderboard.'
    WHEN 'team-rank-10' THEN 'Reach the top 10 of a global team leaderboard.'
    WHEN 'team-rank-3' THEN 'Reach the podium of a global team leaderboard.'
    ELSE 'Reach #1 on a global team leaderboard.'
  END,
  "updated_at" = now()
WHERE "slug" IN ('team-rank-50', 'team-rank-10', 'team-rank-3', 'team-rank-1');

UPDATE "achievement_definitions"
SET
  "threshold" = 3600000,
  "description" = 'Finish any 50 Speedrun in 1:00:00 or faster.',
  "series" = '50-speedrun',
  "tier" = 1,
  "updated_at" = now()
WHERE "slug" = '50sr-sub-hour';

UPDATE "achievement_definitions"
SET
  "threshold" = 14400000,
  "description" = 'Finish any 100 Speedrun in 4:00:00 or faster.',
  "series" = '100-speedrun',
  "tier" = 1,
  "updated_at" = now()
WHERE "slug" = '100sr-sub-four-hours';

INSERT INTO "achievement_definitions"
  ("slug", "name", "description", "metric", "threshold", "direction", "category", "series", "tier", "points")
VALUES
  ('wr-2p', 'Double Trouble', 'Hold a current 2P world record.', 'world_records_2p', 1, 'higher_is_better', 'World Records', 'world-record-2p', 1, 50),
  ('wr-3p', 'Three''s a Crowd', 'Hold a current 3P world record.', 'world_records_3p', 1, 'higher_is_better', 'World Records', 'world-record-3p', 1, 50),
  ('wr-4p', 'Full Squad WR', 'Hold a current 4P world record.', 'world_records_4p', 1, 'higher_is_better', 'World Records', 'world-record-4p', 1, 50),
  ('team-formats-1', 'Party Starter', 'Set a verified record in one co-op format: 2P, 3P or 4P.', 'team_formats_played', 1, 'higher_is_better', 'Teamwork', 'team-formats', 1, 10),
  ('team-formats-2', 'Flexible Squad', 'Set verified records in two co-op formats.', 'team_formats_played', 2, 'higher_is_better', 'Teamwork', 'team-formats', 2, 25),
  ('team-formats-3', 'All Formats', 'Set verified records in 2P, 3P and 4P.', 'team_formats_played', 3, 'higher_is_better', 'Teamwork', 'team-formats', 3, 50),
  ('category-sampler-3', 'Category Sampler', 'Set verified records in 3 different categories.', 'categories_played', 3, 'higher_is_better', 'Exploration', 'category-sampler', 1, 10),
  ('category-sampler-5', 'Mixed Bag', 'Set verified records in 5 different categories.', 'categories_played', 5, 'higher_is_better', 'Exploration', 'category-sampler', 2, 25),
  ('category-sampler-10', 'Jack of All Trades', 'Set verified records in 10 different categories.', 'categories_played', 10, 'higher_is_better', 'Exploration', 'category-sampler', 3, 50),
  ('game-high-round-top15', 'Tour of Duty', 'On one game, place in the top 15 in High Rounds on every map that offers High Rounds.', 'game_high_round_top15_complete', 1, 'higher_is_better', 'Game Mastery', 'tour-of-duty', 1, 150),
  ('game-ee-top20-1', 'Egg Hunter', 'Place in the top 20 of one EE Speedrun.', 'game_ee_top20_records', 1, 'higher_is_better', 'Game Mastery', 'ee-game-mastery', 1, 20),
  ('game-ee-top20-2', 'Egg Carton', 'On one game, place in the top 20 of 2 EE Speedruns.', 'game_ee_top20_records', 2, 'higher_is_better', 'Game Mastery', 'ee-game-mastery', 2, 40),
  ('game-ee-top20-3', 'Easter Specialist', 'On one game, place in the top 20 of 3 EE Speedruns.', 'game_ee_top20_records', 3, 'higher_is_better', 'Game Mastery', 'ee-game-mastery', 3, 75),
  ('game-ee-top20-all', 'Eggs Benedict', 'On one game, place in the top 20 of every available EE Speedrun.', 'game_all_ee_top20', 1, 'higher_is_better', 'Game Mastery', 'ee-game-mastery', 4, 150),
  ('50sr-55', 'Minute Hunter', 'Finish any 50 Speedrun in 55:00 or faster.', 'speedrun_50', 3300000, 'lower_is_better', 'Speedruns', '50-speedrun', 2, 150),
  ('50sr-50', 'Fifty in Fifty', 'Finish any 50 Speedrun in 50:00 or faster.', 'speedrun_50', 3000000, 'lower_is_better', 'Speedruns', '50-speedrun', 3, 200),
  ('50sr-48', 'Forty-Eight Special', 'Finish any 50 Speedrun in 48:00 or faster.', 'speedrun_50', 2880000, 'lower_is_better', 'Speedruns', '50-speedrun', 4, 250),
  ('100sr-3h50', 'Long Haul Sprinter', 'Finish any 100 Speedrun in 3:50:00 or faster.', 'speedrun_100', 13800000, 'lower_is_better', 'Speedruns', '100-speedrun', 2, 200),
  ('100sr-3h40', 'Endurance Express', 'Finish any 100 Speedrun in 3:40:00 or faster.', 'speedrun_100', 13200000, 'lower_is_better', 'Speedruns', '100-speedrun', 3, 250),
  ('100sr-3h30', 'Century Rush', 'Finish any 100 Speedrun in 3:30:00 or faster.', 'speedrun_100', 12600000, 'lower_is_better', 'Speedruns', '100-speedrun', 4, 300)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "metric" = EXCLUDED."metric", "threshold" = EXCLUDED."threshold",
  "direction" = EXCLUDED."direction", "category" = EXCLUDED."category",
  "series" = EXCLUDED."series", "tier" = EXCLUDED."tier",
  "points" = EXCLUDED."points", "active" = true, "updated_at" = now();
