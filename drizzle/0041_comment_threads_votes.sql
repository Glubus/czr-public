ALTER TABLE "submission_comments" ADD COLUMN "parent_id" integer REFERENCES "submission_comments"("id") ON DELETE CASCADE;
CREATE TABLE "submission_comment_votes" (
  "comment_id" integer NOT NULL REFERENCES "submission_comments"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "value" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "submission_comment_votes_comment_id_user_id_pk" PRIMARY KEY("comment_id", "user_id"),
  CONSTRAINT "submission_comment_votes_value_check" CHECK ("value" IN (-1, 1))
);
CREATE INDEX "submission_comment_votes_user_idx" ON "submission_comment_votes" ("user_id");
