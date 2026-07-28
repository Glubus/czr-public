DROP TABLE IF EXISTS "ingestion_packages";
DROP TABLE IF EXISTS "ingestion_sessions";

ALTER TABLE "submissions" ALTER COLUMN "run_duration_ms" TYPE bigint;
ALTER TABLE "personal_runs" ALTER COLUMN "run_duration_ms" TYPE bigint;

CREATE TABLE "client_runs" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "installation_id" text NOT NULL REFERENCES "client_installations"("id") ON DELETE CASCADE,
  "client_version_id" integer NOT NULL REFERENCES "client_versions"("id") ON DELETE RESTRICT,
  "game_id" integer NOT NULL REFERENCES "games"("id") ON DELETE RESTRICT,
  "map_id" integer NOT NULL REFERENCES "maps"("id") ON DELETE RESTRICT,
  "platform" text,
  "game_version" text,
  "map_version" text,
  "mod_id" integer REFERENCES "mods"("id") ON DELETE RESTRICT,
  "mod_version" text,
  "participant_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "run_token_hash" text NOT NULL,
  "start_payload_sha256" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "latest_heartbeat_sequence" integer DEFAULT 0 NOT NULL,
  "latest_game_elapsed_ms" bigint DEFAULT 0 NOT NULL,
  "latest_round" integer,
  "last_heartbeat_at" timestamptz,
  "heartbeat_gap_count" integer DEFAULT 0 NOT NULL,
  "max_heartbeat_gap_ms" bigint DEFAULT 0 NOT NULL,
  "latest_chunk_sequence" integer DEFAULT 0 NOT NULL,
  "latest_chunk_end_elapsed_ms" bigint DEFAULT 0 NOT NULL,
  "chunk_chain_head_sha256" text,
  "finalization_sha256" text,
  "finalization_payload" jsonb,
  "finalization_issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "submission_group_id" text,
  "finalized_at" timestamptz,
  "abandoned_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "client_runs_user_created_idx" ON "client_runs" ("user_id", "created_at");
CREATE INDEX "client_runs_installation_status_idx" ON "client_runs" ("installation_id", "status");

CREATE TABLE "client_run_chunks" (
  "id" serial PRIMARY KEY,
  "run_id" text NOT NULL REFERENCES "client_runs"("id") ON DELETE CASCADE,
  "sequence" integer NOT NULL,
  "start_elapsed_ms" bigint NOT NULL,
  "end_elapsed_ms" bigint NOT NULL,
  "previous_chunk_sha256" text,
  "compressed_sha256" text NOT NULL,
  "uncompressed_sha256" text NOT NULL,
  "compression" text NOT NULL,
  "payload_format" text NOT NULL,
  "compressed_payload" bytea NOT NULL,
  "uncompressed_bytes" integer NOT NULL,
  "event_count" integer NOT NULL,
  "signature" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "client_run_chunks_sequence_unique" UNIQUE ("run_id", "sequence"),
  CONSTRAINT "client_run_chunks_hash_unique" UNIQUE ("run_id", "compressed_sha256")
);
