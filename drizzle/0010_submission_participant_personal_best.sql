ALTER TABLE "submission_participants" ADD COLUMN "is_personal_best" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE INDEX "submission_participants_personal_best_idx" ON "submission_participants" USING btree ("user_id", "is_personal_best");
