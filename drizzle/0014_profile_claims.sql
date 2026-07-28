CREATE TABLE "profile_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"claimant_user_id" text NOT NULL,
	"profile_user_id" text,
	"profile_external_id" text NOT NULL,
	"proof_url" text NOT NULL,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "profile_claims" ADD CONSTRAINT "profile_claims_claimant_user_id_users_id_fk" FOREIGN KEY ("claimant_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "profile_claims" ADD CONSTRAINT "profile_claims_profile_user_id_users_id_fk" FOREIGN KEY ("profile_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "profile_claims" ADD CONSTRAINT "profile_claims_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "profile_claims_claimant_idx" ON "profile_claims" USING btree ("claimant_user_id", "created_at");
--> statement-breakpoint
CREATE INDEX "profile_claims_status_idx" ON "profile_claims" USING btree ("status", "created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "profile_claims_active_profile_unique" ON "profile_claims" USING btree ("profile_external_id") WHERE "profile_claims"."status" IN ('pending', 'approved');
--> statement-breakpoint
CREATE UNIQUE INDEX "profile_claims_active_claimant_unique" ON "profile_claims" USING btree ("claimant_user_id") WHERE "profile_claims"."status" IN ('pending', 'approved');
