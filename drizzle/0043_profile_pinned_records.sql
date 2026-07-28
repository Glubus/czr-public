CREATE TABLE "profile_pinned_records" (
	"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"submission_id" integer NOT NULL REFERENCES "submissions"("id") ON DELETE CASCADE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_pinned_records_pk" PRIMARY KEY("user_id", "submission_id")
);

CREATE INDEX "profile_pinned_records_user_created_idx"
	ON "profile_pinned_records" ("user_id", "created_at");
