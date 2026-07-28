import { Data, Effect } from "effect";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { Database } from "./client.ts";

export class DatabaseMigrationError extends Data.TaggedError("DatabaseMigrationError")<{
  cause: unknown;
}> {
  override get message() {
    return this.cause instanceof Error ? this.cause.message : String(this.cause);
  }
}

/** Applies the checked-in Drizzle migrations exactly once, tracked in __drizzle_migrations. */
export function migrateDatabase(db: Database) {
  return Effect.tryPromise({
    try: () => migrate(db, { migrationsFolder: "./drizzle" }),
    catch: (cause) => new DatabaseMigrationError({ cause }),
  });
}
