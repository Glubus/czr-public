UPDATE "achievement_definitions"
SET
  "name" = 'Serious Company',
  "description" = 'Reach the top 50 of a global team leaderboard.',
  "series" = 'team-rank',
  "tier" = 3,
  "updated_at" = now()
WHERE "slug" = 'team-rank-50';

UPDATE "achievement_definitions"
SET "tier" = CASE "slug"
    WHEN 'team-rank-10' THEN 4
    WHEN 'team-rank-3' THEN 5
    WHEN 'team-rank-1' THEN 6
  END,
  "updated_at" = now()
WHERE "slug" IN ('team-rank-10', 'team-rank-3', 'team-rank-1');

INSERT INTO "achievement_definitions"
  ("slug", "name", "description", "metric", "threshold", "direction", "category", "series", "tier", "points")
VALUES
  ('team-rank-250', 'Party Crashers', 'Reach the top 250 of a global team leaderboard.', 'team_best_rank', 250, 'lower_is_better', 'Teamwork', 'team-rank', 1, 10),
  ('team-rank-100', 'On the Guest List', 'Reach the top 100 of a global team leaderboard.', 'team_best_rank', 100, 'lower_is_better', 'Teamwork', 'team-rank', 2, 20)
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
