import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { getPostgresDb } from "./postgresClient";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";

// Both drivers expose PostgreSQL builders and { rows } execute results. Keep a
// shared interface so generic returning({...}) calls do not become a union of overloads.
export type Database = PgDatabase<NodePgQueryResultHKT, typeof schema>;

export function getDbClient(): Database {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is missing.");
  }
  if (process.env.DATABASE_DRIVER === "postgres") return getPostgresDb(databaseUrl);
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema }) as unknown as Database;
}
