# Architecture

This document describes the runtime components and the code boundaries contributors should preserve.

## Runtime components

| Component    | Responsibility                                                                    |
| ------------ | --------------------------------------------------------------------------------- |
| Caddy        | TLS termination, request-size limits, frontend routing, and API proxying          |
| SvelteKit    | Server-rendered pages, form actions, and browser-facing API composition           |
| Deno API     | Authentication, validation, domain commands, queries, and OpenAPI output          |
| Worker       | Outbox delivery, background cleanup, and asynchronous maintenance                 |
| PostgreSQL   | Source of truth for accounts, catalog data, records, rankings, and social state   |
| Redis        | Distributed rate limits, response caching, cache versions, and request coalescing |
| Blob storage | Optimized profile images, clan images, backgrounds, and signed client artifacts   |

Only Caddy is public in the documented production topology. The API exposes metrics on the private Compose
network.

## Backend boundaries

`src/http/routes` translates HTTP requests into typed domain calls. Routes should not contain SQL or scoring
rules. Cross-cutting HTTP behavior such as rate limits, request IDs, caching, and problem responses lives
under `src/http`.

`src/modules/<domain>` owns the business rules and persistence for one domain. A module may depend on shared
database types and another module's explicit public functions, but it should not duplicate another module's
queries.

`src/db` owns schema access, migrations, and database lifecycle. The Drizzle migrations under `drizzle` are
append-only after deployment.

`src/infra` contains provider adapters. Domain services receive adapters such as blob storage or email rather
than selecting providers themselves.

## Frontend boundaries

Route files under `web/src/routes` load data, define metadata, and compose feature components. Large route
files should be split by user-visible feature.

`web/src/lib/features` owns stateful flows such as record submission, profile settings, discussions, and
moderation. `web/src/lib/components` contains reusable atoms, molecules, and organisms. Shared controls must
be reused instead of implementing native dropdown behavior independently in each route.

Server-side API access goes through `web/src/lib/server/api.ts`. Browser fetch helpers belong to their feature
module and must handle cancellation and stale responses.

## Write path

1. Caddy rejects an oversized body before proxying it.
2. The API applies the route-specific distributed rate limit.
3. The route decodes the request and checks authorization.
4. A domain service validates invariants and writes one transaction.
5. Derived rows and outbox events are updated in the same transaction when consistency requires it.
6. The response-cache middleware increments only the affected namespace versions.
7. The worker processes asynchronous side effects.

API errors use RFC 9457 problem documents. Expected domain failures must use a stable public error code and
must not expose database or stack details.

## Rankings and derived data

Verified submissions are the durable source of truth. Best-record rows, performance points, scoped ranks, and
achievement progress are derived data. Import and administrative review paths must rebuild or incrementally
refresh every affected projection.

Expensive public reads use Redis-backed cache namespaces. Cache invalidation is scoped by resource family so
an unrelated write does not flush every leaderboard.
