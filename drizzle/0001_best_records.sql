DROP TABLE IF EXISTS "historical_records";
--> statement-breakpoint
ALTER TABLE "records" RENAME TO "best_records";
--> statement-breakpoint
ALTER INDEX IF EXISTS "records_player_leaderboard_unique" RENAME TO "best_records_player_leaderboard_unique";
--> statement-breakpoint
ALTER INDEX IF EXISTS "records_leaderboard_score_idx" RENAME TO "best_records_leaderboard_score_idx";
