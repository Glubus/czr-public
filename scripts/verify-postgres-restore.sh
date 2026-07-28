#!/usr/bin/env sh
set -eu

: "${BACKUP_FILE:?BACKUP_FILE must point to a pg_dump custom archive}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL must point to a disposable PostgreSQL database}"

pg_restore --list "$BACKUP_FILE" >/dev/null
pg_restore --clean --if-exists --no-owner --dbname "$RESTORE_DATABASE_URL" "$BACKUP_FILE"
psql "$RESTORE_DATABASE_URL" --set ON_ERROR_STOP=1 --tuples-only --command \
  "SELECT CASE WHEN to_regclass('public.submissions') IS NOT NULL
    AND to_regclass('public.best_records') IS NOT NULL
    AND to_regclass('public.submission_proofs') IS NOT NULL
    THEN 'restore-ok' ELSE 'restore-incomplete' END" |
  grep -q "restore-ok"

echo "backup restored and critical tables verified"
