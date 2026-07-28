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
    'extinction_protocol_best_rank', 'endurance_best_rank'
  ));

INSERT INTO "achievement_definitions"
  ("slug", "name", "description", "metric", "threshold", "direction", "category", "series", "tier", "points")
VALUES
  ('format-sweep-top3', 'Every Seat at the Table', 'On one map and category, hold a top 3 record in 1P, 2P, 3P and 4P.', 'format_sweep_best_rank', 3, 'lower_is_better', 'Teamwork', 'format-sweep', 1, 50),
  ('format-sweep-top1', 'Four Crowns', 'On one map and category, hold #1 in 1P, 2P, 3P and 4P.', 'format_sweep_best_rank', 1, 'lower_is_better', 'Teamwork', 'format-sweep', 2, 100),
  ('speedrun-ladder-top10', 'Cruise Control', 'On one map, place top 10 in 30, 50, 70 and 100 Speedrun.', 'speedrun_ladder_best_rank', 10, 'lower_is_better', 'Speedruns', 'speedrun-ladder', 1, 15),
  ('speedrun-ladder-top3', 'Full Throttle', 'On one map, place top 3 in 30, 50, 70 and 100 Speedrun.', 'speedrun_ladder_best_rank', 3, 'lower_is_better', 'Speedruns', 'speedrun-ladder', 2, 25),
  ('speedrun-ladder-top1', 'Perfect Pace', 'On one map, hold #1 in 30, 50, 70 and 100 Speedrun.', 'speedrun_ladder_best_rank', 1, 'lower_is_better', 'Speedruns', 'speedrun-ladder', 3, 50),
  ('no-crutches-top10', 'No Crutches', 'On one map, place top 10 in No Power, No Perks and No Jug.', 'no_crutches_best_rank', 10, 'lower_is_better', 'Game Mastery', 'no-crutches', 1, 15),
  ('no-crutches-top3', 'Bare Essentials', 'On one map, place top 3 in No Power, No Perks and No Jug.', 'no_crutches_best_rank', 3, 'lower_is_better', 'Game Mastery', 'no-crutches', 2, 25),
  ('no-crutches-top1', 'Raw Survival', 'On one map, hold #1 in No Power, No Perks and No Jug.', 'no_crutches_best_rank', 1, 'lower_is_better', 'Game Mastery', 'no-crutches', 3, 50),
  ('clean-extraction-top3', 'Clean Extraction', 'On one Black Ops 6 map, place top 3 in both Round 11 and Round 21 Exfil Speedrun.', 'clean_extraction_best_rank', 3, 'lower_is_better', 'Game Mastery', 'clean-extraction', 1, 25),
  ('clean-extraction-top1', 'Perfect Extraction', 'On one Black Ops 6 map, hold #1 in both Round 11 and Round 21 Exfil Speedrun.', 'clean_extraction_best_rank', 1, 'lower_is_better', 'Game Mastery', 'clean-extraction', 2, 50),
  ('double-agent-top3', 'Double Agent', 'On one Black Ops 2 map, place top 3 on both the Maxis and Richtofen EE sides.', 'double_agent_best_rank', 3, 'lower_is_better', 'Game Mastery', 'double-agent', 1, 30),
  ('double-agent-top1', 'Master Manipulator', 'On one Black Ops 2 map, hold #1 on both the Maxis and Richtofen EE sides.', 'double_agent_best_rank', 1, 'lower_is_better', 'Game Mastery', 'double-agent', 2, 60),
  ('restricted-arsenal-top10', 'Restricted Arsenal', 'On one Modern Warfare 3 map, place top 10 in High Round, No Guns and Pistols Only Survival.', 'restricted_arsenal_best_rank', 10, 'lower_is_better', 'Game Mastery', 'restricted-arsenal', 1, 15),
  ('restricted-arsenal-top3', 'Survival Specialist', 'On one Modern Warfare 3 map, place top 3 in High Round, No Guns and Pistols Only Survival.', 'restricted_arsenal_best_rank', 3, 'lower_is_better', 'Game Mastery', 'restricted-arsenal', 2, 25),
  ('restricted-arsenal-top1', 'Nothing Left', 'On one Modern Warfare 3 map, hold #1 in High Round, No Guns and Pistols Only Survival.', 'restricted_arsenal_best_rank', 1, 'lower_is_better', 'Game Mastery', 'restricted-arsenal', 3, 50),
  ('hardcore-credentials-top10', 'Hardcore Credentials', 'On one Black Ops 4 map, place top 10 in High Round, Hardcore High Round, Realistic, Flawless and Hardcore Flawless.', 'hardcore_credentials_best_rank', 10, 'lower_is_better', 'Game Mastery', 'hardcore-credentials', 1, 30),
  ('hardcore-credentials-top3', 'Hardened', 'On one Black Ops 4 map, place top 3 in all five standard and hardcore survival categories.', 'hardcore_credentials_best_rank', 3, 'lower_is_better', 'Game Mastery', 'hardcore-credentials', 2, 50),
  ('hardcore-credentials-top1', 'Beyond Hardcore', 'On one Black Ops 4 map, hold #1 in all five standard and hardcore survival categories.', 'hardcore_credentials_best_rank', 1, 'lower_is_better', 'Game Mastery', 'hardcore-credentials', 3, 100),
  ('first-room-25', 'Spawn Camper', 'Reach round 25 in First Room on an official Black Ops 1, 2 or 3 map.', 'first_room_official_round', 25, 'higher_is_better', 'Game Mastery', 'first-room-official', 1, 10),
  ('first-room-30', 'Door Stays Closed', 'Reach round 30 in First Room on an official Black Ops 1, 2 or 3 map.', 'first_room_official_round', 30, 'higher_is_better', 'Game Mastery', 'first-room-official', 2, 15),
  ('first-room-40', 'Still in Spawn', 'Reach round 40 in First Room on an official Black Ops 1, 2 or 3 map.', 'first_room_official_round', 40, 'higher_is_better', 'Game Mastery', 'first-room-official', 3, 25),
  ('first-room-50', 'Never Left', 'Reach round 50 in First Room on an official Black Ops 1, 2 or 3 map.', 'first_room_official_round', 50, 'higher_is_better', 'Game Mastery', 'first-room-official', 4, 40),
  ('flawless-50', 'Not a Scratch', 'Reach round 50 Flawless on an official Black Ops 1, 2 or 3 map.', 'flawless_official_round', 50, 'higher_is_better', 'Game Mastery', 'flawless-official', 1, 15),
  ('flawless-100', 'Perfect Century', 'Reach round 100 Flawless on an official Black Ops 1, 2 or 3 map.', 'flawless_official_round', 100, 'higher_is_better', 'Game Mastery', 'flawless-official', 2, 30),
  ('flawless-150', 'Untouched', 'Reach round 150 Flawless on an official Black Ops 1, 2 or 3 map.', 'flawless_official_round', 150, 'higher_is_better', 'Game Mastery', 'flawless-official', 3, 50),
  ('flawless-200', 'Beyond Flawless', 'Reach round 200 Flawless on an official Black Ops 1, 2 or 3 map.', 'flawless_official_round', 200, 'higher_is_better', 'Game Mastery', 'flawless-official', 4, 100),
  ('extinction-protocol-top3', 'Extinction Protocol', 'On one Ghosts map, place top 3 in both Regular and Hardcore Extinction High Score.', 'extinction_protocol_best_rank', 3, 'lower_is_better', 'Game Mastery', 'extinction-protocol', 1, 30),
  ('extinction-protocol-top1', 'Species Eradicated', 'On one Ghosts map, hold #1 in both Regular and Hardcore Extinction High Score.', 'extinction_protocol_best_rank', 1, 'lower_is_better', 'Game Mastery', 'extinction-protocol', 2, 60),
  ('endurance-freak-top3', 'Endurance Freak', 'Place top 3 in a 200 or 255 Speedrun.', 'endurance_best_rank', 3, 'lower_is_better', 'Speedruns', 'endurance-freak', 1, 35),
  ('endurance-freak-top1', 'Beyond Endurance', 'Hold #1 in a 200 or 255 Speedrun.', 'endurance_best_rank', 1, 'lower_is_better', 'Speedruns', 'endurance-freak', 2, 75)
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
