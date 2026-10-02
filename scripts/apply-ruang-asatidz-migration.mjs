import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const path = fileURLToPath(new URL("../drizzle/0009_ruang_asatidz.sql", import.meta.url));
const content = readFileSync(path, "utf8");
const statements = content.split("--> statement-breakpoint").map((item) => item.trim()).filter(Boolean);
const apply = process.argv.includes("--apply");
if (!apply) {
  console.log(JSON.stringify({ mode: "dry-run", path, statementCount: statements.length,
    message: "Tidak ada perubahan database. Tambahkan --apply setelah memeriksa database tujuan dan cadangan." }, null, 2));
  console.log(content);
} else {
  const url = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_MIGRATION_URL atau DATABASE_URL belum dikonfigurasi.");
  const target = new URL(url);
  // Never log credentials or connection-string query parameters.
  console.log(JSON.stringify({ mode: "apply", host: target.hostname, database: target.pathname.slice(1) }));
  const sql = neon(url);
  await sql.transaction(statements.map((statement) => sql(statement, [])));
  const tables = await sql(`SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('ruang_asatidz_threads', 'ruang_asatidz_replies', 'ruang_asatidz_greetings')
    ORDER BY table_name`, []);
  if (tables.length !== 3) throw new Error("Verifikasi tabel Ruang Asatidz gagal.");
  console.log(JSON.stringify({ ready: true, tables }, null, 2));
}