import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

// Reuse connections across requests; transactions reserve their own connection.
const pools = new Map<string, Pool>();

export function getPostgresDb(connectionString: string) {
  let pool = pools.get(connectionString);
  if (!pool) {
    pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 10_000 });
    pools.set(connectionString, pool);
  }
  return drizzle(pool, { schema });
}
