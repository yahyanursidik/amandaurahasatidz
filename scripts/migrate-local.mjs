import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local" });
const url = new URL(process.env.DATABASE_URL || "");
if (process.env.DATABASE_DRIVER !== "postgres" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
  throw new Error("db:migrate:local hanya menerima DATABASE_DRIVER=postgres dengan database localhost.");
}
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
try {
  // Include hand-authored migrations after 0008, which are absent from Drizzle's journal.
  await client.query("CREATE TABLE IF NOT EXISTS _local_migrations (name text PRIMARY KEY, hash text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
  for (const name of (await readdir("drizzle")).filter(name => /^\d+.*\.sql$/.test(name)).sort()) {
    const sql = await readFile(resolve("drizzle", name), "utf8");
    const hash = createHash("sha256").update(sql).digest("hex");
    const { rows } = await client.query("SELECT hash FROM _local_migrations WHERE name = $1", [name]);
    if (rows.length) {
      if (rows[0].hash !== hash) throw new Error(`Migrasi yang sudah diterapkan berubah: ${name}`);
      continue;
    }
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO _local_migrations (name, hash) VALUES ($1, $2)", [name, hash]);
      await client.query("COMMIT");
      console.log(`Applied ${name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.end();
}
