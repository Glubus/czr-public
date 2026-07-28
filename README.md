# CZR - Call of Duty Zombies Records

CZR is a community leaderboard for Call of Duty Zombies. It provides verified record boards, player and team
rankings, clans, profile claims, comments, personal runs, achievements, and moderation tools.

The repository contains:

- a Deno API built with Hono, Effect, Drizzle, PostgreSQL, and Redis;
- a server-rendered SvelteKit frontend;
- a background worker for asynchronous maintenance;
- a Caddy reverse proxy and a production-oriented Docker Compose stack.

The public instance is available at [czr.prism.am](https://czr.prism.am).
The documentation index is available in [docs/README.md](docs/README.md).

## Status

CZR is a public alpha. Data, scoring rules, and moderation workflows can still change. Report security issues
privately as described in [SECURITY.md](SECURITY.md). Use GitHub issues for reproducible bugs and feature
requests.

## Quick start

Requirements:

- Docker with the Compose plugin;
- or Deno 2, Node.js 24, PostgreSQL, and Redis for a native development setup.

Start the complete local stack:

```sh
cp .env.example .env
# Replace BETTER_AUTH_SECRET with a random value of at least 32 characters.
docker compose up --build
```

Open `http://localhost:8888`. Caddy serves the frontend and proxies `/v1` to the API. PostgreSQL, Redis, and
the API are not exposed directly by the default production topology.

For frontend hot reload:

```sh
cd web
cp .env.example .env
npm install
npm run dev
```

The frontend uses `API_BASE_URL` for server-side requests. Its local default is `http://localhost:8888/v1`;
Compose uses `http://api:3000/v1` on the internal network.

## Architecture

```text
Browser
  |
Caddy :8888
  |-- SvelteKit frontend
  `-- /v1 and /health -> Deno API
                           |-- PostgreSQL
                           |-- Redis
                           `-- file-backed media storage

Background worker ----------^
```

Domain code lives under `src/modules`. HTTP route registration lives under `src/http/routes`. Database
migrations are stored in `drizzle`. Frontend features live under `web/src/lib/features`, while reusable UI
primitives live under `web/src/lib/components`.

See [docs/architecture.md](docs/architecture.md) for dependency boundaries, write paths, caching, and
background processing.

## Commands

Backend:

```sh
deno task check
deno lint
deno task test
deno task migrate
deno task dev
```

Frontend:

```sh
cd web
npm run check
npm run lint
npm test
npm run build
npm run test:e2e
```

Useful maintenance commands:

```sh
deno task pp:backfill
deno task achievements:recalculate
deno task benchmark
```

`pp:backfill` rebuilds stored performance points after a scoring migration.
`achievements:recalculate` reevaluates all achievement progress from verified records.

## API documentation

The public Scalar documentation is served at `GET /docs`; its OpenAPI document is available at
`GET /v1/openapi.json`. It contains only anonymous operations.

All business routes are versioned under `/v1`. `GET /health` is intentionally unversioned. API failures use
`application/problem+json` with stable codes such as `validation_failed`, `unauthorized`, `forbidden`,
`not_found`, and `conflict`.

## Authentication and permissions

Sign-up and sign-in return bearer tokens. Protected routes expect `Authorization: Bearer <token>`. Roles are
always read from PostgreSQL; identity or role headers are never trusted.

New accounts can sign in immediately because email verification is disabled. Password reset requires a
configured email provider. `EMAIL_MODE=log` is intended for local development and closed alpha deployments,
not public password recovery.

The first real account receives `ROLE_ADMIN` atomically. Imported profiles do not count as registered
accounts. Later registrations receive `ROLE_USER`.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Changes must preserve module
boundaries, include tests for changed behavior, and pass backend and frontend checks.

Do not add third-party datasets, artwork, or branding unless their redistribution terms are known.
