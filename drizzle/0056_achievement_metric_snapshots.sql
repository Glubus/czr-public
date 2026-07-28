CREATE TABLE IF NOT EXISTS "achievement_metric_snapshots" (
  "user_id" text PRIMARY KEY
    REFERENCES "users" ("id") ON DELETE CASCADE,
  "values" jsonb NOT NULL,
  "calculated_at" timestamp with time zone NOT NULL DEFAULT now()
);
