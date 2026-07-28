import { Effect } from "effect";
import { closeDatabase, createDatabase } from "../db/client.ts";
import { migrateDatabase } from "../db/migrate.ts";

const db = createDatabase();
try {
  await Effect.runPromise(migrateDatabase(db));
  console.log(JSON.stringify({ event: "database_migrated" }));
} finally {
  await closeDatabase(db);
}
