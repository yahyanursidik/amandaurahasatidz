import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const path = fileURLToPath(new URL("../drizzle/0017_regular_registration_group_policy.sql", import.meta.url));
const statement = readFileSync(path, "utf8").trim();

if (!process.argv.includes("--apply")) {
  console.log(JSON.stringify({ mode: "dry-run", path, statement,
    message: "Tidak ada akses database. Untuk PostgreSQL lokal gunakan db:migrate:local. Terapkan migrasi sebelum deploy kode baru." }, null, 2));
} else {
  await import("dotenv/config");
  const { neon } = await import("@neondatabase/serverless");
  const connection = process.env.DATABASE_MIGRATION_URL;
  if (!connection) throw new Error("DATABASE_MIGRATION_URL langsung diperlukan untuk migrasi Neon.");
  const target = new URL(connection);
  if (target.hostname.includes("-pooler")) throw new Error("Gunakan endpoint Neon langsung tanpa -pooler untuk migrasi.");
  console.log(JSON.stringify({ mode: "apply", host: target.hostname, database: target.pathname.slice(1) }));
  const sql = neon(connection);
  await sql(statement, []);
  const columns = await sql(`SELECT is_nullable, data_type, column_default FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'regular_allow_group'`, []);
  if (columns.length !== 1 || columns[0].is_nullable !== "NO" || columns[0].data_type !== "boolean" || columns[0].column_default !== "true") {
    throw new Error("Kolom regular_allow_group harus boolean NOT NULL DEFAULT true.");
  }
  console.log(JSON.stringify({ ready: true, column: "regular_allow_group" }));
}
