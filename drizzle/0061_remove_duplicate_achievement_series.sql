DELETE FROM "achievement_definitions"
WHERE "slug" IN (
  'silver-lining-3',
  'silver-lining-10',
  'home-map-5',
  'home-map-10',
  'favorite-game-10',
  'favorite-game-25',
  'touring-podium-3',
  'touring-podium-5'
);

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
    'wr_weekend', 'wr_games', 'longest_wr_reign_days', 'record_breaker_days'
  ));
