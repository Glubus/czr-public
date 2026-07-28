ALTER TABLE "achievement_definitions"
  DROP CONSTRAINT IF EXISTS "achievement_definitions_metric_check";

UPDATE "achievement_definitions"
SET
  "metric" = CASE "metric"
    WHEN 'map_top10_categories' THEN 'map_top15_categories'
    WHEN 'map_all_categories_top10' THEN 'map_all_categories_top15'
    ELSE "metric"
  END,
  "description" = CASE "slug"
    WHEN 'map-completionist-2'
      THEN 'Place in the top 15 of 2 categories on the same map. The map must have at least 5 categories.'
    WHEN 'map-completionist-3'
      THEN 'Place in the top 15 of 3 categories on the same map. The map must have at least 5 categories.'
    WHEN 'map-completionist-5'
      THEN 'Place in the top 15 of 5 categories on the same map. The map must have at least 5 categories.'
    WHEN 'map-completionist-all'
      THEN 'Place in the top 15 of every category on a map with at least 5 categories.'
    ELSE "description"
  END,
  "updated_at" = now()
WHERE "metric" IN ('map_top10_categories', 'map_all_categories_top10');

ALTER TABLE "achievement_definitions"
  ADD CONSTRAINT "achievement_definitions_metric_check"
  CHECK ("metric" IN (
    'performance_points', 'verified_submissions', 'world_records', 'games_played', 'team_records',
    'record_points', 'classic_high_round', 'bo3_high_round', 'waw_high_round',
    'speedrun_30', 'speedrun_50', 'speedrun_100', 'no_power_round',
    'maps_played', 'team_best_rank', 'map_top15_categories', 'map_all_categories_top15',
    'world_records_2p', 'world_records_3p', 'world_records_4p',
    'team_formats_played', 'categories_played', 'game_high_round_top15_complete',
    'game_ee_top20_records', 'game_all_ee_top20'
  ));
