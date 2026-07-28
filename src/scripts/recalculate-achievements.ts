import { Effect } from "effect";
import { closeDatabase, createDatabase } from "../db/client.ts";
import { migrateDatabase } from "../db/migrate.ts";
import { recalculateAllAchievements } from "../modules/engagement/service.ts";

const db = createDatabase();
try {
  const result = await Effect.runPromise(
    migrateDatabase(db).pipe(Effect.flatMap(() => recalculateAllAchievements(db))),
  );
  console.log(JSON.stringify({ event: "achievements_recalculated", ...result }));
} finally {
  await closeDatabase(db);
}
