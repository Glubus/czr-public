# Contributing

Thanks for helping improve CZR. Keep pull requests focused and describe the user-visible behavior they change.

## Development

Start dependencies and run the backend:

```sh
docker compose up -d postgres postgres-test redis
deno task migrate
deno task dev
```

Run the frontend separately for hot reload:

```sh
cd web
npm install
npm run dev
```

## Required checks

Before opening a pull request:

```sh
deno fmt --check
deno task check
deno lint
deno task text:check
deno task test

cd web
npm run check
npm run lint
npm test
npm run build
```

Run Playwright tests for changes to authentication, navigation, forms, or critical user flows:

```sh
docker compose up -d --build
cd web
npm run test:e2e
```

## Code rules

- Keep HTTP transport, domain rules, persistence, and provider adapters separate.
- Reuse shared frontend controls and record cards instead of adding page-specific alternatives.
- Validate all external input at the boundary.
- Keep writes transactional when partial success would break an invariant.
- Add or update tests for every behavior change and bug fix.
- Add a migration for schema changes; never edit a migration already deployed.
- Write code, comments, API descriptions, commit messages, and documentation in English.
- Use the regular hyphen character (`-`) instead of typographic dash characters.
- Do not commit secrets, production environment files, private datasets, uploaded media, or test database
  state.

Avoid comments that repeat the code. Document invariants, provider constraints, and decisions that a future
maintainer could not infer locally.

## Database changes

Generate a new Drizzle migration, inspect its SQL, and test both a clean migration and an upgrade from the
previous schema. Derived projections such as best records, PP, ranks, and achievements may require an explicit
backfill.

## Reporting issues

Use a minimal reproduction, expected behavior, actual behavior, and relevant logs with secrets removed.
Security reports must follow [SECURITY.md](SECURITY.md).
