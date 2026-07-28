ALTER TABLE games ADD COLUMN game_type text NOT NULL DEFAULT 'zombies';
ALTER TABLE games ADD COLUMN studio text NOT NULL DEFAULT 'Unknown';
ALTER TABLE games ADD CONSTRAINT games_game_type_check CHECK (game_type IN ('zombies', 'non_zombies'));

UPDATE games SET game_type = 'non_zombies'
WHERE slug IN ('cod4-mw', 'ghosts', 'mw', 'mw2', 'mw2022', 'mw3');

UPDATE games SET studio = CASE slug
  WHEN 'aw' THEN 'Sledgehammer Games'
  WHEN 'bo' THEN 'Treyarch'
  WHEN 'bo2' THEN 'Treyarch'
  WHEN 'bo3' THEN 'Treyarch'
  WHEN 'bo4' THEN 'Treyarch'
  WHEN 'bo6' THEN 'Treyarch · Raven Software'
  WHEN 'bo7' THEN 'Treyarch · Raven Software'
  WHEN 'bocw' THEN 'Treyarch · Raven Software'
  WHEN 'cod4-mw' THEN 'Infinity Ward'
  WHEN 'ghosts' THEN 'Infinity Ward'
  WHEN 'iw' THEN 'Infinity Ward'
  WHEN 'mw' THEN 'Infinity Ward'
  WHEN 'mw2' THEN 'Infinity Ward'
  WHEN 'mw2022' THEN 'Infinity Ward'
  WHEN 'mw3' THEN 'Infinity Ward · Sledgehammer Games'
  WHEN 'vanguard' THEN 'Sledgehammer Games'
  WHEN 'waw' THEN 'Treyarch'
  WHEN 'wwii' THEN 'Sledgehammer Games'
  ELSE studio
END;

DO $$
DECLARE
  black_ops_id integer;
  black_ops_3_id integer;
  world_at_war_id integer;
  uem_game_id integer;
  sker_game_id integer;
BEGIN
  SELECT id INTO black_ops_id FROM games WHERE slug = 'bo';
  SELECT id INTO black_ops_3_id FROM games WHERE slug = 'bo3';
  SELECT id INTO world_at_war_id FROM games WHERE slug = 'waw';

  UPDATE maps SET game_id = black_ops_id
  WHERE game_id = world_at_war_id AND slug IN ('ftg', 'tg');
  UPDATE category_assignments assignment SET game_id = map.game_id
  FROM maps map WHERE assignment.map_id = map.id AND map.slug IN ('ftg', 'tg');
  UPDATE submissions record SET game_id = map.game_id
  FROM maps map WHERE record.map_id = map.id AND map.slug IN ('ftg', 'tg');
  UPDATE personal_runs run SET game_id = map.game_id
  FROM maps map WHERE run.map_id = map.id AND map.slug IN ('ftg', 'tg');
  UPDATE client_runs run SET game_id = map.game_id
  FROM maps map WHERE run.map_id = map.id AND map.slug IN ('ftg', 'tg');
  UPDATE user_goals goal SET game_id = map.game_id
  FROM maps map WHERE goal.map_id = map.id AND map.slug IN ('ftg', 'tg');

  SELECT id INTO uem_game_id FROM games WHERE slug = 'uem';
  IF uem_game_id IS NOT NULL THEN
    UPDATE maps SET game_id = black_ops_3_id, type = 'uem' WHERE game_id = uem_game_id;
    UPDATE category_assignments assignment
    SET game_id = map.game_id,
        specific_rules = jsonb_set(assignment.specific_rules, '{tags}', '["community", "uem"]'::jsonb, true)
    FROM maps map WHERE assignment.map_id = map.id AND assignment.game_id = uem_game_id;
    UPDATE submissions record SET game_id = map.game_id
    FROM maps map WHERE record.map_id = map.id AND record.game_id = uem_game_id;
    UPDATE personal_runs run SET game_id = map.game_id
    FROM maps map WHERE run.map_id = map.id AND run.game_id = uem_game_id;
    UPDATE client_runs run SET game_id = map.game_id
    FROM maps map WHERE run.map_id = map.id AND run.game_id = uem_game_id;
    UPDATE user_goals goal SET game_id = map.game_id
    FROM maps map WHERE goal.map_id = map.id AND goal.game_id = uem_game_id;
    UPDATE user_goals SET game_id = black_ops_3_id WHERE game_id = uem_game_id AND map_id IS NULL;
    UPDATE mods SET game_id = black_ops_3_id WHERE game_id = uem_game_id;
    DELETE FROM games WHERE id = uem_game_id;
  END IF;

  SELECT id INTO sker_game_id FROM games WHERE slug = 'sker-ritual';
  IF sker_game_id IS NOT NULL THEN
    DELETE FROM best_records WHERE submission_id IN (SELECT id FROM submissions WHERE game_id = sker_game_id);
    DELETE FROM personal_runs WHERE game_id = sker_game_id;
    DELETE FROM client_runs WHERE game_id = sker_game_id;
    DELETE FROM submissions WHERE game_id = sker_game_id;
    DELETE FROM user_goals WHERE game_id = sker_game_id;
    DELETE FROM category_assignments WHERE game_id = sker_game_id;
    DELETE FROM maps WHERE game_id = sker_game_id;
    DELETE FROM mods WHERE game_id = sker_game_id;
    DELETE FROM games WHERE id = sker_game_id;
  END IF;
END $$;
