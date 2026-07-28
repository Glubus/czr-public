WITH competitor_counts AS (
  SELECT
    s.map_id,
    s.category_assignment_id,
    s.player_count,
    count(DISTINCT s.competitor_key)::double precision AS competitors
  FROM submissions s
  WHERE s.status = 'verified'
  GROUP BY s.map_id, s.category_assignment_id, s.player_count
), ranked AS (
  SELECT
    b.submission_id,
    s.map_id,
    s.category_assignment_id,
    s.player_count,
    s.score_value,
    c.ranking_direction,
    first_value(s.score_value) OVER board AS wr_score
  FROM best_records b
  JOIN submissions s ON s.id = b.submission_id
  JOIN categories c ON c.id = s.category_id
  WINDOW board AS (
    PARTITION BY s.map_id, s.category_assignment_id, s.player_count
    ORDER BY
      CASE WHEN c.score_type = 'round' OR c.ranking_direction = 'higher_is_better' THEN s.score_value END DESC,
      CASE WHEN c.score_type <> 'round' AND c.ranking_direction = 'lower_is_better' THEN s.score_value END ASC,
      CASE WHEN c.score_type = 'round' THEN s.run_duration_ms END ASC NULLS LAST,
      s.verified_at ASC,
      s.id ASC
  )
), calculated AS (
  SELECT
    r.submission_id,
    round((50 + 150 * sqrt(greatest(0, cc.competitors - 1)))::numeric, 2)::double precision AS pool,
    CASE WHEN r.ranking_direction = 'higher_is_better'
      THEN r.score_value::double precision / greatest(1, r.wr_score)::double precision
      ELSE greatest(1, r.wr_score)::double precision / greatest(1, r.score_value)::double precision
    END AS proximity
  FROM ranked r
  JOIN competitor_counts cc
    ON cc.map_id = r.map_id
    AND cc.category_assignment_id = r.category_assignment_id
    AND cc.player_count = r.player_count
)
UPDATE best_records b
SET points = round((c.pool * power(c.proximity, 2))::numeric, 2)::double precision
FROM calculated c
WHERE b.submission_id = c.submission_id;

WITH target_ranked AS (
  SELECT
    sp.user_id,
    sp.submission_id,
    b.points,
    row_number() OVER (
      PARTITION BY sp.user_id, s.map_id, s.category_assignment_id, s.player_count
      ORDER BY
        CASE WHEN c.score_type = 'round' OR c.ranking_direction = 'higher_is_better' THEN s.score_value END DESC,
        CASE WHEN c.score_type <> 'round' AND c.ranking_direction = 'lower_is_better' THEN s.score_value END ASC,
        CASE WHEN c.score_type = 'round' THEN s.run_duration_ms END ASC NULLS LAST,
        s.verified_at ASC,
        s.id ASC
    ) AS target_position
  FROM submission_participants sp
  JOIN best_records b ON b.submission_id = sp.submission_id
  JOIN submissions s ON s.id = sp.submission_id
  JOIN categories c ON c.id = s.category_id
  WHERE sp.is_personal_best = true
), point_order AS (
  SELECT
    user_id,
    points,
    row_number() OVER (PARTITION BY user_id ORDER BY points DESC, submission_id) AS point_position
  FROM target_ranked
  WHERE target_position = 1
), blocks AS (
  SELECT
    user_id,
    sum(CASE WHEN point_position <= 50 THEN points * power(0.98, point_position - 1) ELSE 0 END) AS top_points,
    sum(CASE WHEN point_position > 50 THEN points * 0.5 * power(0.9, point_position - 51) ELSE 0 END) AS tail_points
  FROM point_order
  GROUP BY user_id
), totals AS (
  SELECT
    user_id,
    top_points + least(tail_points, top_points / 9) AS performance_points
  FROM blocks
)
UPDATE users u
SET performance_points = round(coalesce(t.performance_points, 0)::numeric, 2)::double precision
FROM totals t
WHERE u.id = t.user_id;

UPDATE users
SET performance_points = 0
WHERE NOT EXISTS (
  SELECT 1 FROM submission_participants sp
  JOIN best_records b ON b.submission_id = sp.submission_id
  WHERE sp.user_id = users.id AND sp.is_personal_best = true
);
