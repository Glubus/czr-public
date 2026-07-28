import { Effect } from "effect";
import { closeDatabase, createDatabase } from "../db/client.ts";
import { migrateDatabase } from "../db/migrate.ts";
import { recalculateAllPerformancePoints } from "../modules/submissions/service.ts";

const db = createDatabase();
try {
  const result = await Effect.runPromise(
    migrateDatabase(db).pipe(Effect.flatMap(() => recalculateAllPerformancePoints(db))),
  );
  console.log(`Recalculated performance points for ${result.recalculatedUsers} users.`);
} finally {
  await closeDatabase(db);
}
