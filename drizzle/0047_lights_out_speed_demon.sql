DELETE FROM "user_achievements"
WHERE "achievement_id" IN (
  SELECT "id"
  FROM "achievement_definitions"
  WHERE "slug" = 'no-power-round-100'
    OR "series" = '30-speedrun'
);

UPDATE "achievement_definitions"
SET
  "slug" = 'lights-out-200',
  "name" = 'Lights Out',
  "description" = 'Reach round 200 in No Power on Black Ops, Black Ops 2, Black Ops 3 or Black Ops 4.',
  "threshold" = 200,
  "category" = 'Challenges',
  "series" = 'lights-out',
  "tier" = 1,
  "points" = 125,
  "active" = true,
  "updated_at" = now()
WHERE "slug" = 'no-power-round-100';

UPDATE "achievement_definitions"
SET
  "slug" = 'speed-demon-30',
  "name" = 'Speed Demon',
  "description" = 'Finish any 30 Speedrun in 30:00 or faster.',
  "threshold" = 1800000,
  "direction" = 'lower_is_better',
  "category" = 'Speedruns',
  "series" = 'speed-demon',
  "tier" = 3,
  "points" = 75,
  "active" = true,
  "updated_at" = now()
WHERE "slug" = '30sr-sub-30';

INSERT INTO "achievement_definitions"
  ("slug", "name", "description", "metric", "threshold", "direction", "category", "series", "tier", "points")
VALUES
  ('speed-demon-35', 'Speed Demon', 'Finish any 30 Speedrun in 35:00 or faster.', 'speedrun_30', 2100000, 'lower_is_better', 'Speedruns', 'speed-demon', 1, 25),
  ('speed-demon-32', 'Speed Demon', 'Finish any 30 Speedrun in 32:00 or faster.', 'speedrun_30', 1920000, 'lower_is_better', 'Speedruns', 'speed-demon', 2, 50),
  ('speed-demon-28', 'Speed Demon', 'Finish any 30 Speedrun in 28:00 or faster.', 'speedrun_30', 1680000, 'lower_is_better', 'Speedruns', 'speed-demon', 4, 100),
  ('speed-demon-26-30', 'Speed Demon', 'Finish any 30 Speedrun in 26:30 or faster.', 'speedrun_30', 1590000, 'lower_is_better', 'Speedruns', 'speed-demon', 5, 150)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "metric" = EXCLUDED."metric", "threshold" = EXCLUDED."threshold",
  "direction" = EXCLUDED."direction", "category" = EXCLUDED."category",
  "series" = EXCLUDED."series", "tier" = EXCLUDED."tier",
  "points" = EXCLUDED."points", "active" = true, "updated_at" = now();

UPDATE "achievement_definitions"
SET "points" = 75, "updated_at" = now()
WHERE "slug" = 'waw-round-1000';
