import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import WebSocket from "ws";
import * as schema from "./schema";

// HTTP remains the default for one-shot queries. Interactive writes use a
// request-local WebSocket connection; never share it across serverless requests.
neonConfig.webSocketConstructor = WebSocket;

export function createTransactionClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL environment variable is missing.");
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 });
  return { db: drizzle(pool, { schema }), close: () => pool.end() };
}
