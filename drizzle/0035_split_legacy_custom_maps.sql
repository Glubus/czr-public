DO $$
DECLARE
  legacy_game_id integer;
  black_ops_id integer;
  world_at_war_id integer;
BEGIN
  SELECT id INTO legacy_game_id FROM games WHERE slug = 'custom-waw-bo1';
  IF legacy_game_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO black_ops_id FROM games WHERE slug = 'bo';
  SELECT id INTO world_at_war_id FROM games WHERE slug = 'waw';
  IF black_ops_id IS NULL OR world_at_war_id IS NULL THEN
    RAISE EXCEPTION 'Black Ops and World at War must exist before custom maps are migrated';
  END IF;

  UPDATE maps
  SET game_id = CASE
    WHEN slug IN ('perish', 'kowloon', 'battery', 'winter-wunderland2') THEN black_ops_id
    ELSE world_at_war_id
  END,
  metadata = jsonb_set(
    metadata,
    '{zwrExternalId}',
    to_jsonb('zwr:map:' || CASE
      WHEN slug IN ('perish', 'kowloon', 'battery', 'winter-wunderland2') THEN 'bo'
      ELSE 'waw'
    END || ':' || slug)
  )
  WHERE game_id = legacy_game_id;

  UPDATE category_assignments assignment
  SET game_id = map.game_id,
      specific_rules = jsonb_set(assignment.specific_rules, '{tags}', '["community"]'::jsonb, true)
  FROM maps map
  WHERE assignment.map_id = map.id AND assignment.game_id = legacy_game_id;

  UPDATE submissions record SET game_id = map.game_id
  FROM maps map WHERE record.map_id = map.id AND record.game_id = legacy_game_id;
  UPDATE personal_runs run SET game_id = map.game_id
  FROM maps map WHERE run.map_id = map.id AND run.game_id = legacy_game_id;
  UPDATE client_runs run SET game_id = map.game_id
  FROM maps map WHERE run.map_id = map.id AND run.game_id = legacy_game_id;
  UPDATE user_goals goal SET game_id = map.game_id
  FROM maps map WHERE goal.map_id = map.id AND goal.game_id = legacy_game_id;

  UPDATE user_goals SET game_id = world_at_war_id
  WHERE game_id = legacy_game_id AND map_id IS NULL;
  UPDATE mods SET game_id = world_at_war_id WHERE game_id = legacy_game_id;

  DELETE FROM games WHERE id = legacy_game_id;
END $$;
