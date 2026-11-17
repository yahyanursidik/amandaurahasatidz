import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { getPostgresDb } from "./postgresClient";
import type { Database } from "./client";

export function getMigrationDbClient(): Database {
  const migrationUrl = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
  if (!migrationUrl) {
    throw new Error("DATABASE_MIGRATION_URL environment variable is missing.");
  }
  if (process.env.DATABASE_DRIVER === "postgres") return getPostgresDb(migrationUrl);
  const sql = neon(migrationUrl);
  return drizzle(sql, { schema }) as unknown as Database;
}
