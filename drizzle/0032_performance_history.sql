CREATE TABLE IF NOT EXISTS "performance_point_snapshots" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "points" double precision NOT NULL,
  "delta" double precision NOT NULL,
  "source" text NOT NULL CHECK ("source" IN ('baseline', 'submission', 'daily', 'formula_change')),
  "source_submission_id" integer,
  "formula_version" integer NOT NULL,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "recorded_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "performance_point_snapshots_user_time_idx"
  ON "performance_point_snapshots" ("user_id", "recorded_at");
CREATE INDEX IF NOT EXISTS "performance_point_snapshots_source_submission_idx"
  ON "performance_point_snapshots" ("source_submission_id");

INSERT INTO "performance_point_snapshots"
  ("user_id", "points", "delta", "source", "formula_version", "metadata")
SELECT "id", "performance_points", 0, 'baseline', 5, '{"note":"history_tracking_started"}'::jsonb
FROM "users"
WHERE "deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "performance_point_snapshots" snapshot WHERE snapshot."user_id" = "users"."id"
  );
