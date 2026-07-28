ALTER TABLE "games" ADD COLUMN "cover_image" text;
ALTER TABLE "users" ADD COLUMN "country_code" text;
ALTER TABLE "users" ADD COLUMN "country_changed_at" timestamp with time zone;

ALTER TABLE "users"
  ADD CONSTRAINT "users_country_code_format"
  CHECK ("country_code" IS NULL OR "country_code" ~ '^[A-Z]{2}$');

CREATE TABLE "badge_definitions" (
  "id" serial PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "color" text DEFAULT '#e45735' NOT NULL,
  "icon" text,
  "system" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "badge_definitions_slug_unique" UNIQUE("slug")
);

CREATE TABLE "user_badges" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "badge_id" integer NOT NULL,
  "awarded_by" text,
  "awarded_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "user_badges"
  ADD CONSTRAINT "user_badges_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
ALTER TABLE "user_badges"
  ADD CONSTRAINT "user_badges_badge_id_badge_definitions_id_fk"
  FOREIGN KEY ("badge_id") REFERENCES "public"."badge_definitions"("id") ON DELETE cascade;
ALTER TABLE "user_badges"
  ADD CONSTRAINT "user_badges_awarded_by_users_id_fk"
  FOREIGN KEY ("awarded_by") REFERENCES "public"."users"("id") ON DELETE set null;
CREATE UNIQUE INDEX "user_badges_user_badge_uidx" ON "user_badges" ("user_id", "badge_id");
CREATE INDEX "user_badges_user_idx" ON "user_badges" ("user_id");

INSERT INTO "badge_definitions" ("slug", "name", "description", "color", "icon", "system")
VALUES
  ('admin', 'Admin', 'Platform administrator', '#ef4444', 'shield', true),
  ('moderator', 'Moderator', 'Community moderator', '#8b5cf6', 'gavel', true),
  ('map-nominator', 'Map Nominator', 'Community map curator', '#22c55e', 'map', true),
  ('verified', 'Verified', 'Verified community member', '#3b82f6', 'check', true)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "user_badges" ("user_id", "badge_id")
SELECT u."id", b."id"
FROM "users" u
JOIN "badge_definitions" b ON
  (b."slug" = 'admin' AND u."roles" @> '["ROLE_ADMIN"]'::jsonb)
  OR (b."slug" = 'moderator' AND u."roles" @> '["ROLE_MODERATOR"]'::jsonb)
  OR (b."slug" = 'map-nominator' AND u."roles" @> '["ROLE_MAP_NOMINATOR"]'::jsonb)
ON CONFLICT ("user_id", "badge_id") DO NOTHING;

UPDATE "games"
SET "cover_image" = '/v1/game-images/' || "slug" || '.webp'
WHERE "slug" IN (
  'aw', 'bo', 'bo2', 'bo3', 'bo4', 'bo6', 'bo7', 'bocw', 'cod4-mw',
  'ghosts', 'iw', 'mw', 'mw2', 'mw2022', 'mw3', 'vanguard', 'waw', 'wwii'
);
