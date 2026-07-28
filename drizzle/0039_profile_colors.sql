ALTER TABLE "users" ADD COLUMN "profile_color" text DEFAULT '#101311' NOT NULL;
ALTER TABLE "users" ADD COLUMN "profile_gradient_color" text;
ALTER TABLE "users" ADD COLUMN "profile_gradient_angle" integer DEFAULT 135 NOT NULL;
