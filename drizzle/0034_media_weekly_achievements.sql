ALTER TABLE "users" ADD COLUMN "background_image" text;
ALTER TABLE "clans" ADD COLUMN "logo_image" text;
ALTER TABLE "clans" ADD COLUMN "background_image" text;

ALTER TABLE "achievement_definitions" DROP CONSTRAINT IF EXISTS "achievement_definitions_metric_check";
ALTER TABLE "achievement_definitions"
  ADD CONSTRAINT "achievement_definitions_metric_check"
  CHECK ("metric" IN ('performance_points', 'verified_submissions', 'world_records', 'games_played', 'team_records'));

INSERT INTO "achievement_definitions" ("slug", "name", "description", "metric", "threshold") VALUES
  ('first-record', 'First Blood', 'Earn your first verified record.', 'verified_submissions', 1),
  ('ten-records', 'Run Builder', 'Reach 10 verified records.', 'verified_submissions', 10),
  ('fifty-records', 'Record Hunter', 'Reach 50 verified records.', 'verified_submissions', 50),
  ('hundred-records', 'The Centurion', 'Reach 100 verified records.', 'verified_submissions', 100),
  ('first-100-pp', 'On the Board', 'Reach 100 performance points.', 'performance_points', 100),
  ('one-thousand-pp', 'Contender', 'Reach 1,000 performance points.', 'performance_points', 1000),
  ('five-thousand-pp', 'Elite', 'Reach 5,000 performance points.', 'performance_points', 5000),
  ('ten-thousand-pp', 'Legend', 'Reach 10,000 performance points.', 'performance_points', 10000),
  ('first-world-record', 'World Beater', 'Hold a current world record.', 'world_records', 1),
  ('ten-world-records', 'WR Machine', 'Hold 10 current world records.', 'world_records', 10),
  ('three-games', 'Tourist', 'Set verified records in 3 different games.', 'games_played', 3),
  ('eight-games', 'Historian', 'Set verified records in 8 different games.', 'games_played', 8),
  ('first-team-record', 'Squad Up', 'Earn a verified team record.', 'team_records', 1),
  ('twenty-team-records', 'Dream Team', 'Earn 20 verified team records.', 'team_records', 20)
ON CONFLICT ("slug") DO NOTHING;
