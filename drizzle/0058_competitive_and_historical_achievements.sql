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
    'distinct_top3_duo_partners', 'distinct_top1_duo_partners', 'duo_self_snipe',
    'self_wr_improvement', 'wr_weekend', 'wr_games', 'longest_wr_reign_days',
    'record_breaker_days'
  ));

INSERT INTO "achievement_definitions"
  ("slug", "name", "description", "metric", "threshold", "direction", "category", "series", "tier", "points")
VALUES
  ('back-from-the-dead', 'Back From the Dead', 'Regain a world record after another player or roster took it from you.', 'back_from_the_dead', 1, 'higher_is_better', 'World Records', 'back-from-the-dead', 1, 75),
  ('podium-collector-3', 'Bronze Cabinet', 'Hold 3 current top-three records at the same time.', 'podium_records', 3, 'higher_is_better', 'Rankings', 'podium-collector', 1, 15),
  ('podium-collector-10', 'Podium Collector', 'Hold 10 current top-three records at the same time.', 'podium_records', 10, 'higher_is_better', 'Rankings', 'podium-collector', 2, 30),
  ('podium-collector-25', 'Podium Hoarder', 'Hold 25 current top-three records at the same time.', 'podium_records', 25, 'higher_is_better', 'Rankings', 'podium-collector', 3, 60),
  ('jack-of-all-trades-top3', 'Jack of All Trades', 'Simultaneously hold a top 3 in High Rounds, 30 Speedrun, 50 Speedrun, 100 Speedrun, No Power and First Room.', 'jack_of_all_trades_top3', 1, 'higher_is_better', 'Game Mastery', 'jack-of-all-trades-top3', 1, 150),
  ('game-specialist-25', 'Game Specialist', 'Hold at least 25 records on one game with an average leaderboard rank of 15 or better.', 'game_specialist_records', 25, 'higher_is_better', 'Game Mastery', 'game-specialist', 1, 75),
  ('total-domination-top5', 'Total Domination', 'On a map with at least 8 categories, rank in the top 5 of every category.', 'map_domination_best_rank', 5, 'lower_is_better', 'Game Mastery', 'total-domination', 1, 100),
  ('total-domination-top3', 'Absolute Domination', 'On a map with at least 8 categories, rank in the top 3 of every category.', 'map_domination_best_rank', 3, 'lower_is_better', 'Game Mastery', 'total-domination', 2, 200),
  ('total-domination-top1', 'Uncontested', 'On a map with at least 8 categories, hold #1 in every category.', 'map_domination_best_rank', 1, 'lower_is_better', 'Game Mastery', 'total-domination', 3, 500),
  ('dynamic-duo-5', 'Dynamic Duo', 'Hold 5 records with the same 2P partner.', 'dynamic_duo_records', 5, 'higher_is_better', 'Teamwork', 'dynamic-duo', 1, 15),
  ('dynamic-duo-15', 'Partners in Crime', 'Hold 15 records with the same 2P partner.', 'dynamic_duo_records', 15, 'higher_is_better', 'Teamwork', 'dynamic-duo', 2, 30),
  ('dynamic-duo-30', 'Inseparable', 'Hold 30 records with the same 2P partner.', 'dynamic_duo_records', 30, 'higher_is_better', 'Teamwork', 'dynamic-duo', 3, 60),
  ('two-partners-top3', 'Social Climber', 'Hold a 2P top 3 with two different partners.', 'distinct_top3_duo_partners', 2, 'higher_is_better', 'Teamwork', 'duo-network', 1, 40),
  ('two-partners-top1', 'Two Crowns, Two Partners', 'Hold a 2P world record with two different partners.', 'distinct_top1_duo_partners', 2, 'higher_is_better', 'Teamwork', 'duo-network', 2, 100),
  ('duo-self-snipe', 'Friendly Fire', 'Beat your own 2P world record with a different partner.', 'duo_self_snipe', 1, 'higher_is_better', 'Teamwork', 'duo-self-snipe', 1, 125),
  ('self-wr-improvement', 'Raising the Bar', 'Improve your own world record while the same player or roster is already #1.', 'self_wr_improvement', 1, 'higher_is_better', 'World Records', 'self-wr-improvement', 1, 50),
  ('wr-weekend', 'WR Weekend', 'Set two world records within 48 hours.', 'wr_weekend', 1, 'higher_is_better', 'World Records', 'wr-weekend', 1, 75),
  ('cross-game-wr-3', 'Cross-Game Champion', 'Hold current world records in 3 different games.', 'wr_games', 3, 'higher_is_better', 'World Records', 'cross-game-champion', 1, 100),
  ('cross-game-wr-5', 'All-Around Champion', 'Hold current world records in 5 different games.', 'wr_games', 5, 'higher_is_better', 'World Records', 'cross-game-champion', 2, 250),
  ('untouchable-30', 'Holding Strong', 'Keep a world record for at least 30 days.', 'longest_wr_reign_days', 30, 'higher_is_better', 'World Records', 'untouchable', 1, 30),
  ('untouchable-90', 'Untouchable', 'Keep a world record for at least 90 days.', 'longest_wr_reign_days', 90, 'higher_is_better', 'World Records', 'untouchable', 2, 75),
  ('untouchable-365', 'Immortal Record', 'Keep a world record for at least 365 days.', 'longest_wr_reign_days', 365, 'higher_is_better', 'World Records', 'untouchable', 3, 200),
  ('record-breaker-year', 'Record Breaker', 'Break a world record that stood for at least one year.', 'record_breaker_days', 365, 'higher_is_better', 'World Records', 'record-breaker', 1, 100)
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

CREATE INDEX IF NOT EXISTS "submissions_verified_board_history_idx"
  ON "submissions" (
    "map_id", "category_assignment_id", "player_count", "verified_at", "id"
  )
  WHERE "status" = 'verified';
