import { count, isNull } from "drizzle-orm";
import { Effect } from "effect";
import type { Database } from "../../db/client.ts";
import { categories, games, maps, submissions, users } from "../../db/schema.ts";

export function getPlatformStats(db: Database) {
  return Effect.tryPromise({
    try: async () => {
      const [[players], [submissionTotal], [gameTotal], [mapTotal], [categoryTotal]] = await Promise.all([
        db.select({ value: count() }).from(users).where(isNull(users.deletedAt)),
        db.select({ value: count() }).from(submissions),
        db.select({ value: count() }).from(games),
        db.select({ value: count() }).from(maps),
        db.select({ value: count() }).from(categories),
      ]);

      return {
        playerCount: Number(players?.value ?? 0),
        submissionCount: Number(submissionTotal?.value ?? 0),
        gameCount: Number(gameTotal?.value ?? 0),
        mapCount: Number(mapTotal?.value ?? 0),
        categoryCount: Number(categoryTotal?.value ?? 0),
      };
    },
    catch: (error) => error,
  });
}
