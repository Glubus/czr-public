-- Keep mastery achievements rewarding without letting one series dominate AP totals.
UPDATE "achievement_definitions"
SET
  "points" = CASE "slug"
    WHEN 'map-completionist-2' THEN 15
    WHEN 'map-completionist-3' THEN 30
    WHEN 'map-completionist-5' THEN 55
    WHEN 'map-completionist-all' THEN 100
    WHEN 'game-high-round-top15' THEN 100
    WHEN 'total-domination-top5' THEN 75
    WHEN 'total-domination-top3' THEN 125
    WHEN 'total-domination-top1' THEN 300
    ELSE "points"
  END,
  "updated_at" = now()
WHERE "slug" IN (
  'map-completionist-2',
  'map-completionist-3',
  'map-completionist-5',
  'map-completionist-all',
  'game-high-round-top15',
  'total-domination-top5',
  'total-domination-top3',
  'total-domination-top1'
);
