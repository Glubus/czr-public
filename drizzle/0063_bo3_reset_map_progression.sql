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
    'back_from_the_dead', 'podium_records', 'jack_of_all_trades_top3',
    'game_specialist_records', 'map_domination_best_rank', 'dynamic_duo_records',
    'dynamic_duo_world_records', 'distinct_top3_duo_partners',
    'distinct_top1_duo_partners', 'duo_self_snipe', 'self_wr_improvement',
    'wr_weekend', 'wr_games', 'longest_wr_reign_days', 'record_breaker_days',
    'format_sweep_best_rank', 'speedrun_ladder_best_rank', 'no_crutches_best_rank',
    'clean_extraction_best_rank', 'double_agent_best_rank',
    'restricted_arsenal_best_rank', 'hardcore_credentials_best_rank',
    'first_room_official_round', 'flawless_official_round',
    'extinction_protocol_best_rank', 'endurance_best_rank', 'bo3_reset_maps'
  ));

INSERT INTO "achievement_definitions"
  ("slug", "name", "description", "metric", "threshold", "direction", "category", "series", "tier", "points")
VALUES
  ('bo3-round-255', 'Reset Reached', 'Reach round 255 in High Rounds on one Black Ops 3 map.', 'bo3_reset_maps', 1, 'higher_is_better', 'Game Mastery', 'bo3-reset', 1, 75),
  ('bo3-reset-3-maps', 'Reset Runner', 'Reach round 255 in High Rounds on 3 different Black Ops 3 maps.', 'bo3_reset_maps', 3, 'higher_is_better', 'Game Mastery', 'bo3-reset', 2, 50),
  ('bo3-reset-5-maps', 'System Breaker', 'Reach round 255 in High Rounds on 5 different Black Ops 3 maps.', 'bo3_reset_maps', 5, 'higher_is_better', 'Game Mastery', 'bo3-reset', 3, 75),
  ('bo3-reset-10-maps', 'Reset Cartographer', 'Reach round 255 in High Rounds on 10 different Black Ops 3 maps.', 'bo3_reset_maps', 10, 'higher_is_better', 'Game Mastery', 'bo3-reset', 4, 150)
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
