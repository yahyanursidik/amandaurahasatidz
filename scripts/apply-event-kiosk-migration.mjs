import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const path = fileURLToPath(new URL("../drizzle/0014_event_kiosk_devices.sql", import.meta.url));
const statement = readFileSync(path, "utf8").trim();
const statements = statement.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean);

if (!process.argv.includes("--apply")) {
  console.log(JSON.stringify({ mode: "dry-run", path, statementCount: statements.length, statement,
    message: "Tidak ada akses database. Uji migrasi pada cabang Neon sebelum produksi." }, null, 2));
} else {
  await import("dotenv/config");
  const { neon } = await import("@neondatabase/serverless");
  const connection = process.env.DATABASE_MIGRATION_URL;
  if (!connection) throw new Error("DATABASE_MIGRATION_URL langsung (bukan pooled) diperlukan.");
  const target = new URL(connection);
  if (target.hostname.includes("-pooler")) throw new Error("Gunakan endpoint Neon langsung tanpa -pooler.");
  console.log(JSON.stringify({ mode: "apply", host: target.hostname, database: target.pathname.slice(1) }));
  const sql = neon(connection);
  await sql.transaction(statements.map((part) => sql(part, [])));
  const verified = await sql("SELECT to_regclass('public.event_kiosk_devices') AS table_name", []);
  if (!verified[0]?.table_name) throw new Error("Verifikasi tabel kiosk gagal.");
  console.log(JSON.stringify({ ready: true, table: verified[0].table_name }));
}
