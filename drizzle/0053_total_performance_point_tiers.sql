DELETE FROM "user_achievements"
WHERE "achievement_id" IN (
  SELECT "id"
  FROM "achievement_definitions"
  WHERE "series" = 'performance-ladder'
);

UPDATE "achievement_definitions"
SET "active" = false, "updated_at" = now()
WHERE "series" = 'performance-ladder';

INSERT INTO "achievement_definitions"
  ("slug", "name", "description", "metric", "threshold", "direction", "category", "series", "tier", "points")
VALUES
  ('total-pp-1250', 'Getting Started', 'Reach 1,250 total PP.', 'performance_points', 1250, 'higher_is_better', 'Performance', 'total-performance-pp', 1, 20),
  ('total-pp-2000', 'Rising Contender', 'Reach 2,000 total PP.', 'performance_points', 2000, 'higher_is_better', 'Performance', 'total-performance-pp', 2, 25),
  ('total-pp-3250', 'On the Grind', 'Reach 3,250 total PP.', 'performance_points', 3250, 'higher_is_better', 'Performance', 'total-performance-pp', 3, 35),
  ('total-pp-4500', 'Established', 'Reach 4,500 total PP.', 'performance_points', 4500, 'higher_is_better', 'Performance', 'total-performance-pp', 4, 45),
  ('total-pp-6000', 'Serious Business', 'Reach 6,000 total PP.', 'performance_points', 6000, 'higher_is_better', 'Performance', 'total-performance-pp', 5, 60),
  ('total-pp-8000', 'Heavyweight', 'Reach 8,000 total PP.', 'performance_points', 8000, 'higher_is_better', 'Performance', 'total-performance-pp', 6, 75),
  ('total-pp-10000', 'Five Figures', 'Reach 10,000 total PP.', 'performance_points', 10000, 'higher_is_better', 'Performance', 'total-performance-pp', 7, 100),
  ('total-pp-15000', 'Elite', 'Reach 15,000 total PP.', 'performance_points', 15000, 'higher_is_better', 'Performance', 'total-performance-pp', 8, 125),
  ('total-pp-20000', 'Powerhouse', 'Reach 20,000 total PP.', 'performance_points', 20000, 'higher_is_better', 'Performance', 'total-performance-pp', 9, 150),
  ('total-pp-25000', 'Quarter Century', 'Reach 25,000 total PP.', 'performance_points', 25000, 'higher_is_better', 'Performance', 'total-performance-pp', 10, 175),
  ('total-pp-30000', 'Top Flight', 'Reach 30,000 total PP.', 'performance_points', 30000, 'higher_is_better', 'Performance', 'total-performance-pp', 11, 200),
  ('total-pp-35000', 'Unrelenting', 'Reach 35,000 total PP.', 'performance_points', 35000, 'higher_is_better', 'Performance', 'total-performance-pp', 12, 225),
  ('total-pp-40000', 'Living Legend', 'Reach 40,000 total PP.', 'performance_points', 40000, 'higher_is_better', 'Performance', 'total-performance-pp', 13, 275),
  ('total-pp-50000', 'Beyond the Limit', 'Reach 50,000 total PP.', 'performance_points', 50000, 'higher_is_better', 'Performance', 'total-performance-pp', 14, 400)
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
