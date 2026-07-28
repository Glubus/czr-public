UPDATE games
SET studio = CASE
  WHEN slug IN ('waw', 'bo', 'bo2', 'bo3', 'bo4', 'bocw', 'bo6', 'bo7') THEN 'Treyarch'
  ELSE 'Non-Treyarch'
END;
