UPDATE "achievement_definitions"
SET
  "name" = 'Four-Digit Run',
  "description" = 'Earn 1,000 PP from a single current record.',
  "threshold" = 1000,
  "series" = 'single-record-pp',
  "tier" = 3,
  "points" = 100,
  "updated_at" = now()
WHERE "slug" = 'single-record-1000-pp';

UPDATE "achievement_definitions"
SET
  "name" = 'One Run Army',
  "description" = 'Earn 1,500 PP from a single current record.',
  "threshold" = 1500,
  "series" = 'single-record-pp',
  "tier" = 4,
  "points" = 250,
  "updated_at" = now()
WHERE "slug" = 'single-record-1500-pp';

INSERT INTO "achievement_definitions"
  ("slug", "name", "description", "metric", "threshold", "direction", "category", "series", "tier", "points")
VALUES
  ('single-record-350-pp', 'Big Swing', 'Earn 350 PP from a single current record.', 'record_points', 350, 'higher_is_better', 'Performance', 'single-record-pp', 1, 25),
  ('single-record-500-pp', 'Half a Grand', 'Earn 500 PP from a single current record.', 'record_points', 500, 'higher_is_better', 'Performance', 'single-record-pp', 2, 50),
  ('single-record-2000-pp', 'Beyond Reason', 'Earn 2,000 PP from a single current record.', 'record_points', 2000, 'higher_is_better', 'Performance', 'single-record-pp', 5, 350),
  ('single-record-2500-pp', 'The Unthinkable', 'Earn 2,500 PP from a single current record.', 'record_points', 2500, 'higher_is_better', 'Performance', 'single-record-pp', 6, 500)
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
