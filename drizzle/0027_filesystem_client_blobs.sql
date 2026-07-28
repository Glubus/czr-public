ALTER TABLE "client_runs"
  ADD COLUMN "blob_state" text DEFAULT 'active' NOT NULL,
  ADD COLUMN "blobs_deleted_at" timestamptz;

-- Pre-launch migration: bytea chunks cannot be moved safely to a host filesystem from SQL.
-- Existing development chunks are discarded and their runs remain recoverable through heartbeats.
DELETE FROM "client_run_chunks";
UPDATE "client_runs" SET
  "latest_chunk_sequence" = 0,
  "latest_chunk_end_elapsed_ms" = 0,
  "chunk_chain_head_sha256" = NULL,
  "blob_state" = CASE WHEN "status" IN ('finalized', 'abandoned') THEN 'deleted' ELSE 'active' END,
  "blobs_deleted_at" = CASE WHEN "status" IN ('finalized', 'abandoned') THEN now() ELSE NULL END;

ALTER TABLE "client_run_chunks"
  DROP COLUMN "compressed_payload",
  ADD COLUMN "storage_key" text NOT NULL;

CREATE INDEX "client_runs_blob_cleanup_idx"
  ON "client_runs" ("blob_state", "status", "finalized_at")
  WHERE "blob_state" = 'retained';
