-- Team-rank achievements were previously calculated from an individual
-- multiplayer rank. Remove those stale unlocks once so the corrected global
-- roster calculation can award only the qualifying players.
DELETE FROM "user_achievements"
WHERE "achievement_id" IN (
  SELECT "id"
  FROM "achievement_definitions"
  WHERE "series" = 'team-rank'
     OR "slug" = 'game-high-round-top15'
);

-- Tour of Duty is the final game-mastery step after completing every category
-- on an eligible map, rather than a standalone one-level series. Its service
-- metric also requires the preceding completion step before it can unlock.
UPDATE "achievement_definitions"
SET
  "series" = 'map-completionist',
  "tier" = 5,
  "updated_at" = now()
WHERE "slug" = 'game-high-round-top15';
