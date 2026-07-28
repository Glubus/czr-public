CREATE TABLE IF NOT EXISTS "client_versions" (
  "id" serial PRIMARY KEY,
  "client_name" text NOT NULL,
  "version" text NOT NULL,
  "protocol_version" integer NOT NULL,
  "status" text DEFAULT 'allowed' NOT NULL,
  "release_notes" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "client_versions_identity_unique" UNIQUE ("client_name", "version")
);

CREATE TABLE IF NOT EXISTS "client_installations" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "public_key_spki" text NOT NULL,
  "revoked_at" timestamptz,
  "last_used_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "client_installations_user_idx" ON "client_installations" ("user_id", "created_at");

CREATE TABLE IF NOT EXISTS "ingestion_sessions" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "installation_id" text NOT NULL REFERENCES "client_installations"("id") ON DELETE CASCADE,
  "client_version_id" integer NOT NULL REFERENCES "client_versions"("id") ON DELETE RESTRICT,
  "nonce_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "consumed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ingestion_sessions_user_expiry_idx" ON "ingestion_sessions" ("user_id", "expires_at");

CREATE TABLE IF NOT EXISTS "ingestion_packages" (
  "id" serial PRIMARY KEY,
  "package_id" text NOT NULL UNIQUE,
  "session_id" text NOT NULL UNIQUE REFERENCES "ingestion_sessions"("id") ON DELETE RESTRICT,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "canonical_sha256" text NOT NULL,
  "signature" text NOT NULL,
  "payload" jsonb NOT NULL,
  "analysis_status" text NOT NULL,
  "analysis_issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "submission_group_id" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ingestion_packages_user_idx" ON "ingestion_packages" ("user_id", "id");
