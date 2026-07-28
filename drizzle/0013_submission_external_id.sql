ALTER TABLE "submissions" ADD COLUMN "external_id" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_external_id_unique" ON "submissions" USING btree ("external_id");
