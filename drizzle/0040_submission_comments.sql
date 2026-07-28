CREATE TABLE "submission_comments" (
  "id" serial PRIMARY KEY NOT NULL,
  "submission_id" integer NOT NULL REFERENCES "submissions"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "submission_comments_submission_created_idx" ON "submission_comments" ("submission_id", "created_at");
CREATE INDEX "submission_comments_user_idx" ON "submission_comments" ("user_id");
