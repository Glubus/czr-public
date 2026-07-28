ALTER TABLE "best_records" DROP CONSTRAINT IF EXISTS "records_submission_id_unique";
--> statement-breakpoint
ALTER TABLE "best_records" DROP CONSTRAINT IF EXISTS "records_pkey";
--> statement-breakpoint
ALTER TABLE "best_records" DROP COLUMN IF EXISTS "id";
--> statement-breakpoint
ALTER TABLE "best_records" DROP COLUMN IF EXISTS "user_id";
--> statement-breakpoint
ALTER TABLE "best_records" DROP COLUMN IF EXISTS "map_id";
--> statement-breakpoint
ALTER TABLE "best_records" DROP COLUMN IF EXISTS "category_assignment_id";
--> statement-breakpoint
ALTER TABLE "best_records" DROP COLUMN IF EXISTS "score_value";
--> statement-breakpoint
ALTER TABLE "best_records" DROP COLUMN IF EXISTS "achieved_at";
--> statement-breakpoint
ALTER TABLE "best_records" DROP COLUMN IF EXISTS "created_at";
--> statement-breakpoint
ALTER TABLE "best_records" ADD PRIMARY KEY ("submission_id");
