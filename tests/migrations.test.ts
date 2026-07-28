import { assertEquals } from "@std/assert";
import { sql } from "drizzle-orm";
import { Effect } from "effect";
import { createTestDatabase } from "../src/db/test-database.ts";
import { migrateDatabase } from "../src/db/migrate.ts";

Deno.test("checked-in migrations are idempotent", async () => {
  const { db, ready } = createTestDatabase();
  await ready;
  await Effect.runPromise(migrateDatabase(db));
  await Effect.runPromise(migrateDatabase(db));
  const result = await db.execute<{ table_name: string }>(
    sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
  );
  const names = new Set(result.map((row) => row.table_name));
  assertEquals(names.has("submissions"), true);
  assertEquals(names.has("best_records"), true);
  assertEquals(names.has("submission_proofs"), true);
});

Deno.test("competitor-key migration backfills a legacy submission", async () => {
  const { db, ready } = createTestDatabase();
  await ready;
  const schemaName = `migration_${crypto.randomUUID().replaceAll("-", "")}`;
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql.raw(`CREATE SCHEMA "${schemaName}"`));
      await tx.execute(sql.raw(`SET LOCAL search_path TO "${schemaName}"`));
      await tx.execute(sql.raw(`
        CREATE TABLE submissions (
          id integer PRIMARY KEY,
          user_id text NOT NULL,
          competitor_key text,
          map_id integer NOT NULL,
          category_assignment_id integer,
          status text NOT NULL
        )
      `));
      await tx.execute(sql.raw(`
        CREATE TABLE submission_participants (
          submission_id integer NOT NULL,
          user_id text NOT NULL
        )
      `));
      await tx.execute(sql.raw(`
        INSERT INTO submissions (id, user_id, map_id, category_assignment_id, status)
        VALUES (1, 'owner', 10, 20, 'verified')
      `));
      await tx.execute(sql.raw(`
        INSERT INTO submission_participants (submission_id, user_id)
        VALUES (1, 'teammate-b'), (1, 'owner'), (1, 'teammate-a')
      `));
      const migration = await Deno.readTextFile("drizzle/0007_add_competitor_key.sql");
      for (const statement of migration.split("--> statement-breakpoint").map((part) => part.trim())) {
        if (statement) await tx.execute(sql.raw(statement));
      }
      const result = await tx.execute<{ competitor_key: string }>(
        sql.raw("SELECT competitor_key FROM submissions WHERE id = 1"),
      );
      assertEquals(result[0]?.competitor_key, "team:owner:teammate-a:teammate-b");
    });
  } finally {
    await db.execute(sql.raw(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`));
  }
});
