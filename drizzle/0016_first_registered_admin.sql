CREATE OR REPLACE FUNCTION assign_first_registered_admin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.email !~* '@import\.local$' THEN
    PERFORM pg_advisory_xact_lock(hashtext('zwr:first-registered-admin'));

    IF NOT EXISTS (
      SELECT 1 FROM users WHERE email !~* '@import\.local$'
    ) THEN
      NEW.roles := NEW.roles || '["ROLE_ADMIN"]'::jsonb;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_first_registered_admin ON users;
CREATE TRIGGER users_first_registered_admin
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION assign_first_registered_admin();

DO $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('zwr:first-registered-admin'));

  IF NOT EXISTS (
    SELECT 1 FROM users WHERE roles @> '["ROLE_ADMIN"]'::jsonb
  ) THEN
    UPDATE users
    SET roles = roles || '["ROLE_ADMIN"]'::jsonb,
        updated_at = now()
    WHERE id = (
      SELECT id
      FROM users
      WHERE email !~* '@import\.local$' AND deleted_at IS NULL
      ORDER BY created_at, id
      LIMIT 1
    );
  END IF;
END;
$$;
