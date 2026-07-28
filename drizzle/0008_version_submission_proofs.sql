ALTER TABLE "submission_proofs" ADD COLUMN IF NOT EXISTS "format_version" integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE "submission_proofs" ADD COLUMN IF NOT EXISTS "provider" text NOT NULL DEFAULT 'other';
