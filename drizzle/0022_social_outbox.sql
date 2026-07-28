CREATE TABLE IF NOT EXISTS "follows" (
  "id" serial PRIMARY KEY,
  "follower_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "follows_target_unique"
ON "follows" ("follower_user_id", "target_type", "target_id");
CREATE INDEX IF NOT EXISTS "follows_target_idx" ON "follows" ("target_type", "target_id");

CREATE TABLE IF NOT EXISTS "outbox_events" (
  "id" serial PRIMARY KEY,
  "event_key" text NOT NULL UNIQUE,
  "type" text NOT NULL,
  "actor_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "recipient_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "subjects" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "occurred_at" timestamptz DEFAULT now() NOT NULL,
  "processed_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "outbox_events_pending_idx" ON "outbox_events" ("id")
WHERE "processed_at" IS NULL;

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" serial PRIMARY KEY,
  "recipient_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "outbox_event_id" integer NOT NULL REFERENCES "outbox_events"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "actor_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "read_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_event_recipient_unique"
ON "notifications" ("outbox_event_id", "recipient_user_id");
CREATE INDEX IF NOT EXISTS "notifications_recipient_cursor_idx"
ON "notifications" ("recipient_user_id", "id");

CREATE TABLE IF NOT EXISTS "feed_entries" (
  "id" serial PRIMARY KEY,
  "viewer_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "outbox_event_id" integer NOT NULL REFERENCES "outbox_events"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "actor_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "feed_entries_event_viewer_unique"
ON "feed_entries" ("outbox_event_id", "viewer_user_id");
CREATE INDEX IF NOT EXISTS "feed_entries_viewer_cursor_idx"
ON "feed_entries" ("viewer_user_id", "id");
