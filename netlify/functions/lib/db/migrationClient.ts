import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export function getMigrationDbClient() {
  const migrationUrl = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
  if (!migrationUrl) {
    throw new Error("DATABASE_MIGRATION_URL environment variable is missing.");
  }
  const sql = neon(migrationUrl);
  return drizzle(sql, { schema });
}
