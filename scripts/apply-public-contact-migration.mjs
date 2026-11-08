import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const path = fileURLToPath(new URL("../drizzle/0013_public_contact_whatsapp.sql", import.meta.url));
const statement = readFileSync(path, "utf8").trim();

if (!process.argv.includes("--apply")) {
  console.log(JSON.stringify({ mode: "dry-run", path, statement,
    message: "Tidak ada akses database. Uji migrasi pada cabang Neon sebelum menerapkannya ke produksi." }, null, 2));
} else {
  await import("dotenv/config");
  const { neon } = await import("@neondatabase/serverless");
  const connection = process.env.DATABASE_MIGRATION_URL;
  if (!connection) throw new Error("DATABASE_MIGRATION_URL langsung (bukan pooled) diperlukan untuk migrasi.");
  const target = new URL(connection);
  if (target.hostname.includes("-pooler")) throw new Error("Gunakan endpoint Neon langsung tanpa -pooler untuk migrasi.");
  console.log(JSON.stringify({ mode: "apply", host: target.hostname, database: target.pathname.slice(1) }));
  const sql = neon(connection);
  await sql(statement, []);
  const verified = await sql(`SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'public_contact_whatsapp'`, []);
  if (verified.length !== 1) throw new Error("Verifikasi kolom WhatsApp panitia gagal.");
  console.log(JSON.stringify({ ready: true, column: verified[0].column_name }));
}
