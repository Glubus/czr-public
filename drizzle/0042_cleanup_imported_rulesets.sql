UPDATE "category_assignments"
SET "specific_rules" = "specific_rules" - 'zwrSubrecord'
WHERE lower(coalesce("specific_rules"->>'zwrSubrecord', '')) IN ('all', 'default')
   OR "specific_rules"->>'zwrSubrecord' ~ '^(custom|official|uem)-.*-(bo1|bo2|bo3|bo4|bocw|bo6|bo7|waw|aw|iw|wwii|ghosts)-ALL$';
