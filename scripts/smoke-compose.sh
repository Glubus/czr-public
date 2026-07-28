#!/usr/bin/env bash
set -euo pipefail

project_name="${COMPOSE_PROJECT_NAME:-zwr-smoke}"
http_port="${CADDY_HTTP_PORT:-18888}"
https_port="${CADDY_HTTPS_PORT:-18443}"
docs_token="${DOCS_TOKEN:-smoke-docs-token-at-least-32-characters}"

export POSTGRES_DB="${POSTGRES_DB:-zwr_smoke}"
export POSTGRES_USER="${POSTGRES_USER:-zwr_smoke}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-smoke-database-password-at-least-32-characters}"
export PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-http://localhost:${http_port}}"
export BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-smoke-auth-secret-at-least-32-characters}"
export DOCS_TOKEN="$docs_token"
export FRONTEND_URL="${FRONTEND_URL:-http://localhost:${http_port}}"
export RESEND_API_KEY="${RESEND_API_KEY:-re_smoke_key_not_used}"
export EMAIL_FROM="${EMAIL_FROM:-ZWR Smoke <smoke@example.test>}"
export CADDY_ADDRESS="${CADDY_ADDRESS:-:80}"
export CADDY_HTTP_PORT="$http_port"
export CADDY_HTTPS_PORT="$https_port"

compose=(
  docker compose
  --project-name "$project_name"
  -f compose.yml
  -f compose.production.yml
)

cleanup() {
  "${compose[@]}" down --volumes --remove-orphans
}
trap cleanup EXIT

"${compose[@]}" config --quiet
"${compose[@]}" up -d --build

base_url="http://localhost:${http_port}"
health=""
for _ in $(seq 1 60); do
  if health="$(curl --fail --silent --show-error "${base_url}/health" 2>/dev/null)"; then
    break
  fi
  sleep 2
done

if [[ "$health" != *'"status":"ok"'* ]] ||
  [[ "$health" != *'"database":true'* ]] ||
  [[ "$health" != *'"redis":true'* ]]; then
  "${compose[@]}" ps
  "${compose[@]}" logs api migrate postgres redis caddy
  echo "Health check did not report a ready stack" >&2
  exit 1
fi

public_docs="$(curl --fail --silent --show-error "${base_url}/docs")"
[[ "$public_docs" == *"ZWR API Documentation"* ]]

public_openapi="$(curl --fail --silent --show-error "${base_url}/v1/openapi.json")"
for hidden_path in \
  '"/admin/' \
  '"/auth/session"' \
  '"/auth/sign-out"' \
  '"/maps/preview"' \
  '"/submissions"' \
  '"/me/submissions"' \
  '"/metrics"'; do
  if [[ "$public_openapi" == *"$hidden_path"* ]]; then
    echo "Public OpenAPI unexpectedly exposes ${hidden_path}" >&2
    exit 1
  fi
done

internal_status="$(
  curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
    "${base_url}/docs/internal"
)"
[[ "$internal_status" == "401" ]]

internal_docs="$(
  curl --fail --silent --show-error \
    --user "docs:${docs_token}" \
    "${base_url}/docs/internal"
)"
[[ "$internal_docs" == *"ZWR Internal API Documentation"* ]]

internal_openapi="$(
  curl --fail --silent --show-error \
    --user "docs:${docs_token}" \
    "${base_url}/v1/openapi.internal.json"
)"
[[ "$internal_openapi" == *'"/admin/'* ]]

metrics_status="$(
  curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
    "${base_url}/metrics"
)"
[[ "$metrics_status" == "404" ]]

config_json="$("${compose[@]}" --profile operations config --format json)"
python3 -c '
import json
import sys

services = json.load(sys.stdin)["services"]
for service in ("api", "worker", "postgres", "redis"):
    if services[service].get("ports"):
        raise SystemExit(f"{service} must not publish host ports in production")

if not services["caddy"].get("ports"):
    raise SystemExit("caddy must publish the production HTTP/HTTPS ports")

for service in ("api", "worker", "web", "caddy", "postgres", "redis"):
    config = services[service]
    if config.get("restart") != "unless-stopped":
        raise SystemExit(f"{service} must use restart: unless-stopped")
    limits = config.get("deploy", {}).get("resources", {}).get("limits", {})
    if not limits.get("cpus") or not limits.get("memory"):
        raise SystemExit(f"{service} must define CPU and memory limits")
    logging = config.get("logging", {})
    options = logging.get("options", {})
    if logging.get("driver") != "json-file" or not options.get("max-size") or not options.get("max-file"):
        raise SystemExit(f"{service} must rotate json-file logs")

backup = services.get("media-backup", {})
if "client_blobs" not in str(backup.get("volumes", [])):
    raise SystemExit("media-backup must mount client_blobs")
' <<<"$config_json"

worker_id="$("${compose[@]}" ps --quiet worker)"
[[ -n "$worker_id" ]]
worker_running="$(docker inspect --format '{{.State.Running}}' "$worker_id")"
[[ "$worker_running" == "true" ]]

echo "Compose production smoke test passed"
