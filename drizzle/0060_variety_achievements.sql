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
    'community_records', 'community_best_rank', 'bo3_gum_trio_best_rank',
    'back_from_the_dead', 'podium_records', 'runner_up_records', 'podium_games',
    'favorite_map_records', 'favorite_game_records', 'jack_of_all_trades_top3',
    'game_specialist_records', 'map_domination_best_rank', 'dynamic_duo_records',
    'dynamic_duo_world_records', 'distinct_top3_duo_partners',
    'distinct_top1_duo_partners', 'duo_self_snipe', 'self_wr_improvement',
    'wr_weekend', 'wr_games', 'longest_wr_reign_days', 'record_breaker_days'
  ));

INSERT INTO "achievement_definitions"
  ("slug", "name", "description", "metric", "threshold", "direction", "category", "series", "tier", "points")
VALUES
  ('silver-lining-3', 'Silver Lining', 'Hold 3 current #2 records at the same time.', 'runner_up_records', 3, 'higher_is_better', 'Rankings', 'silver-lining', 1, 15),
  ('silver-lining-10', 'Always the Bridesmaid', 'Hold 10 current #2 records at the same time.', 'runner_up_records', 10, 'higher_is_better', 'Rankings', 'silver-lining', 2, 35),
  ('home-map-5', 'Home Sweet Home', 'Hold 5 current records on the same map.', 'favorite_map_records', 5, 'higher_is_better', 'Exploration', 'home-map', 1, 10),
  ('home-map-10', 'Local Legend', 'Hold 10 current records on the same map.', 'favorite_map_records', 10, 'higher_is_better', 'Exploration', 'home-map', 2, 25),
  ('favorite-game-10', 'Game Night', 'Hold 10 current records on the same game.', 'favorite_game_records', 10, 'higher_is_better', 'Game Mastery', 'favorite-game', 1, 15),
  ('favorite-game-25', 'Franchise Player', 'Hold 25 current records on the same game.', 'favorite_game_records', 25, 'higher_is_better', 'Game Mastery', 'favorite-game', 2, 40),
  ('touring-podium-3', 'Touring Contender', 'Hold a current top-three record in 3 different games.', 'podium_games', 3, 'higher_is_better', 'Rankings', 'touring-podium', 1, 30),
  ('touring-podium-5', 'Podium Without Borders', 'Hold a current top-three record in 5 different games.', 'podium_games', 5, 'higher_is_better', 'Rankings', 'touring-podium', 2, 60),
  ('power-couple-3', 'Power Couple', 'Hold 3 current 2P world records with the same partner.', 'dynamic_duo_world_records', 3, 'higher_is_better', 'Teamwork', 'power-couple', 1, 30),
  ('power-couple-10', 'Royal Couple', 'Hold 10 current 2P world records with the same partner.', 'dynamic_duo_world_records', 10, 'higher_is_better', 'Teamwork', 'power-couple', 2, 75)
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
