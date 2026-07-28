ALTER TABLE "achievement_definitions" DROP CONSTRAINT IF EXISTS "achievement_definitions_metric_check";
ALTER TABLE "achievement_definitions"
  ADD CONSTRAINT "achievement_definitions_metric_check"
  CHECK ("metric" IN (
    'performance_points', 'verified_submissions', 'world_records', 'games_played', 'team_records',
    'record_points', 'classic_high_round', 'bo3_high_round', 'waw_high_round',
    'speedrun_30', 'speedrun_50', 'speedrun_100', 'no_power_round',
    'maps_played', 'team_best_rank', 'map_top10_categories', 'map_all_categories_top10'
  ));

INSERT INTO "achievement_definitions"
  ("slug", "name", "description", "metric", "threshold", "direction", "category", "series", "tier", "points")
VALUES
  ('map-explorer-1', 'First Steps', 'Play a verified record on 1 map.', 'maps_played', 1, 'higher_is_better', 'Exploration', 'map-explorer', 1, 5),
  ('map-explorer-5', 'Weekend Tourist', 'Play verified records on 5 different maps.', 'maps_played', 5, 'higher_is_better', 'Exploration', 'map-explorer', 2, 15),
  ('map-explorer-10', 'Map Hopper', 'Play verified records on 10 different maps.', 'maps_played', 10, 'higher_is_better', 'Exploration', 'map-explorer', 3, 30),
  ('map-explorer-25', 'Seasoned Explorer', 'Play verified records on 25 different maps.', 'maps_played', 25, 'higher_is_better', 'Exploration', 'map-explorer', 4, 60),
  ('map-explorer-50', 'No Map Left Behind', 'Play verified records on 50 different maps.', 'maps_played', 50, 'higher_is_better', 'Exploration', 'map-explorer', 5, 125),
  ('team-rank-50', 'Party Crashers', 'Reach the top 50 on a multiplayer leaderboard.', 'team_best_rank', 50, 'lower_is_better', 'Teamwork', 'team-rank', 1, 20),
  ('team-rank-10', 'Dangerous Company', 'Reach the top 10 on a multiplayer leaderboard.', 'team_best_rank', 10, 'lower_is_better', 'Teamwork', 'team-rank', 2, 50),
  ('team-rank-3', 'Podium Party', 'Reach the podium on a multiplayer leaderboard.', 'team_best_rank', 3, 'lower_is_better', 'Teamwork', 'team-rank', 3, 100),
  ('team-rank-1', 'Dream Team', 'Reach #1 on a multiplayer leaderboard.', 'team_best_rank', 1, 'lower_is_better', 'Teamwork', 'team-rank', 4, 175),
  ('map-completionist-2', 'Category Curious', 'Place in the top 10 of 2 categories on the same map. The map must have at least 5 categories.', 'map_top10_categories', 2, 'higher_is_better', 'Game Mastery', 'map-completionist', 1, 20),
  ('map-completionist-3', 'Triple Threat', 'Place in the top 10 of 3 categories on the same map. The map must have at least 5 categories.', 'map_top10_categories', 3, 'higher_is_better', 'Game Mastery', 'map-completionist', 2, 40),
  ('map-completionist-5', 'Five-Star Map', 'Place in the top 10 of 5 categories on the same map. The map must have at least 5 categories.', 'map_top10_categories', 5, 'higher_is_better', 'Game Mastery', 'map-completionist', 3, 80),
  ('map-completionist-all', 'Map Completionist', 'Place in the top 10 of every category on a map with at least 5 categories.', 'map_all_categories_top10', 1, 'higher_is_better', 'Game Mastery', 'map-completionist', 4, 150)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "metric" = EXCLUDED."metric", "threshold" = EXCLUDED."threshold",
  "direction" = EXCLUDED."direction", "category" = EXCLUDED."category",
  "series" = EXCLUDED."series", "tier" = EXCLUDED."tier",
  "points" = EXCLUDED."points", "active" = true, "updated_at" = now();
