import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

export type Database = ReturnType<typeof createDatabase>;

export function createDatabase(
  url = Deno.env.get("DATABASE_URL") ?? "postgresql://zwr:zwr@localhost:5432/zwr",
) {
  const client = postgres(url, { onnotice: () => undefined });
  return drizzle(client, { schema });
}

export function closeDatabase(db: Database) {
  return db.$client.end({ timeout: 5 });
}
