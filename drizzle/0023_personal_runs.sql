CREATE TABLE IF NOT EXISTS "personal_runs" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "game_id" integer NOT NULL REFERENCES "games"("id") ON DELETE RESTRICT,
  "map_id" integer NOT NULL REFERENCES "maps"("id") ON DELETE RESTRICT,
  "category_assignment_id" integer NOT NULL REFERENCES "category_assignments"("id") ON DELETE RESTRICT,
  "player_count" integer DEFAULT 1 NOT NULL,
  "score_value" bigint NOT NULL,
  "run_duration_ms" integer,
  "proof_level" text,
  "proof_url" text,
  "visibility" text DEFAULT 'private' NOT NULL,
  "notes" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "promoted_submission_id" integer UNIQUE REFERENCES "submissions"("id") ON DELETE SET NULL,
  "promoted_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "personal_runs_user_cursor_idx" ON "personal_runs" ("user_id", "id");
CREATE INDEX IF NOT EXISTS "personal_runs_user_board_idx"
ON "personal_runs" ("user_id", "map_id", "category_assignment_id", "player_count");
