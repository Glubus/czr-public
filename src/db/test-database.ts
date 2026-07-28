import { Effect, Schedule } from "effect";
import { sql } from "drizzle-orm";
import { createDatabase } from "./client.ts";
import { migrateDatabase } from "./migrate.ts";

const db = createDatabase(
  Deno.env.get("TEST_DATABASE_URL") ?? "postgresql://zwr:zwr@localhost:5433/zwr_test",
);
/** Container startup can briefly accept TCP before PostgreSQL accepts DDL. */
const migrated = Effect.runPromise(
  migrateDatabase(db).pipe(
    Effect.retry({ times: 10, schedule: Schedule.spaced("500 millis") }),
  ),
);

export function createTestDatabase() {
  return {
    db,
    ready: migrated.then(() =>
      Effect.runPromise(
        Effect.tryPromise({
          try: () =>
            db.execute(sql`TRUNCATE TABLE users, sessions, accounts, verifications, games, maps,
                map_sources, categories, category_assignments, mods, submissions, best_records,
                submission_participants, submission_proofs, client_run_chunks, client_runs,
                client_installations, client_versions, user_goals, user_achievements,
                achievement_definitions, challenges, performance_point_snapshots
                RESTART IDENTITY CASCADE`),
          catch: (cause) => new Error(`could not reset test data: ${String(cause)}`),
        }),
      )
    ),
  };
}
