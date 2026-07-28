CREATE TABLE IF NOT EXISTS "user_game_performance" (
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "game_id" integer NOT NULL REFERENCES "games" ("id") ON DELETE CASCADE,
  "performance_points" double precision NOT NULL,
  "record_count" integer NOT NULL,
  "calculated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "user_game_performance_user_id_game_id_pk" PRIMARY KEY ("user_id", "game_id")
);

CREATE INDEX IF NOT EXISTS "user_game_performance_rank_idx"
  ON "user_game_performance" ("game_id", "performance_points", "user_id");

CREATE TABLE IF NOT EXISTS "user_category_performance" (
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "category_id" integer NOT NULL REFERENCES "categories" ("id") ON DELETE CASCADE,
  "performance_points" double precision NOT NULL,
  "record_count" integer NOT NULL,
  "calculated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "user_category_performance_user_id_category_id_pk"
    PRIMARY KEY ("user_id", "category_id")
);

CREATE INDEX IF NOT EXISTS "user_category_performance_rank_idx"
  ON "user_category_performance" ("category_id", "performance_points", "user_id");

WITH ranked AS (
  SELECT participants.user_id, runs.game_id, records.points,
    row_number() OVER (
      PARTITION BY participants.user_id, runs.game_id
      ORDER BY records.points DESC, records.submission_id
    ) AS position
  FROM best_records records
  JOIN submissions runs ON runs.id = records.submission_id
  JOIN submission_participants participants
    ON participants.submission_id = records.submission_id
    AND participants.is_personal_best = true
), totals AS (
  SELECT user_id, game_id, count(*)::integer AS record_count,
    sum(CASE WHEN position <= 50 THEN points * power(0.98, position - 1) ELSE 0 END) AS top_total,
    sum(CASE WHEN position > 50 THEN points * 0.5 * power(0.9, position - 51) ELSE 0 END) AS tail_total
  FROM ranked
  GROUP BY user_id, game_id
)
INSERT INTO user_game_performance (
  user_id, game_id, performance_points, record_count, calculated_at
)
SELECT user_id, game_id,
  round((top_total + least(tail_total, top_total / 9.0))::numeric, 2)::double precision,
  record_count, now()
FROM totals
ON CONFLICT (user_id, game_id) DO UPDATE SET
  performance_points = excluded.performance_points,
  record_count = excluded.record_count,
  calculated_at = excluded.calculated_at;

WITH ranked AS (
  SELECT participants.user_id, runs.category_id, records.points,
    row_number() OVER (
      PARTITION BY participants.user_id, runs.category_id
      ORDER BY records.points DESC, records.submission_id
    ) AS position
  FROM best_records records
  JOIN submissions runs ON runs.id = records.submission_id
  JOIN submission_participants participants
    ON participants.submission_id = records.submission_id
    AND participants.is_personal_best = true
), totals AS (
  SELECT user_id, category_id, count(*)::integer AS record_count,
    sum(CASE WHEN position <= 50 THEN points * power(0.98, position - 1) ELSE 0 END) AS top_total,
    sum(CASE WHEN position > 50 THEN points * 0.5 * power(0.9, position - 51) ELSE 0 END) AS tail_total
  FROM ranked
  GROUP BY user_id, category_id
)
INSERT INTO user_category_performance (
  user_id, category_id, performance_points, record_count, calculated_at
)
SELECT user_id, category_id,
  round((top_total + least(tail_total, top_total / 9.0))::numeric, 2)::double precision,
  record_count, now()
FROM totals
ON CONFLICT (user_id, category_id) DO UPDATE SET
  performance_points = excluded.performance_points,
  record_count = excluded.record_count,
  calculated_at = excluded.calculated_at;
