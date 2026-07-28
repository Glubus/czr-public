ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "performance_points" double precision NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_performance_points_idx" ON "users" ("performance_points");
