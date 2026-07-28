UPDATE submissions
SET submitted_at = submitted_at - INTERVAL '1 year'
WHERE external_id LIKE 'zwr:submission:%'
  AND submitted_at >= TIMESTAMPTZ '2026-12-29 00:00:00+00'
  AND submitted_at < TIMESTAMPTZ '2027-01-01 00:00:00+00';

UPDATE submissions
SET verified_at = verified_at - INTERVAL '1 year'
WHERE external_id LIKE 'zwr:submission:%'
  AND verified_at >= TIMESTAMPTZ '2026-12-29 00:00:00+00'
  AND verified_at < TIMESTAMPTZ '2027-01-01 00:00:00+00';
