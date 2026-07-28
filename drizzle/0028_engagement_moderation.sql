CREATE TABLE "user_goals" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "metric" text NOT NULL CHECK ("metric" IN ('performance_points', 'verified_submissions')),
  "target_value" double precision NOT NULL CHECK ("target_value" > 0),
  "status" text DEFAULT 'active' NOT NULL CHECK ("status" IN ('active', 'completed', 'abandoned')),
  "due_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "user_goals_user_status_idx" ON "user_goals" ("user_id", "status");

CREATE TABLE "achievement_definitions" (
  "id" serial PRIMARY KEY NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "metric" text NOT NULL CHECK ("metric" IN ('performance_points', 'verified_submissions')),
  "threshold" double precision NOT NULL CHECK ("threshold" > 0),
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "user_achievements" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "achievement_id" integer NOT NULL REFERENCES "achievement_definitions"("id") ON DELETE CASCADE,
  "unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_achievements_unique" UNIQUE ("user_id", "achievement_id")
);

CREATE TABLE "challenges" (
  "id" serial PRIMARY KEY NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "metric" text NOT NULL CHECK ("metric" IN ('performance_points', 'verified_submissions')),
  "target_value" double precision NOT NULL CHECK ("target_value" > 0),
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "challenges_valid_window" CHECK ("ends_at" > "starts_at")
);
CREATE INDEX "challenges_window_idx" ON "challenges" ("active", "starts_at", "ends_at");
