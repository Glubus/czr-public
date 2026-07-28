ALTER TABLE "submissions" ADD COLUMN "player_count" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE INDEX "submissions_map_assignment_player_count_idx" ON "submissions" USING btree ("map_id", "category_assignment_id", "player_count");
