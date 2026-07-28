#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL must point to the PostgreSQL database to back up}"
backup_dir="${BACKUP_DIR:-./backups}"
mkdir -p "$backup_dir"
pg_dump --format=custom --no-owner --file "$backup_dir/zwr-$(date -u +%Y%m%dT%H%M%SZ).dump" "$DATABASE_URL"
