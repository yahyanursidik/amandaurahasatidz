import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const path = fileURLToPath(new URL("../drizzle/0010_event_communications.sql", import.meta.url));
const content = readFileSync(path, "utf8");
const statements = content.split("--> statement-breakpoint").map((item) => item.trim()).filter(Boolean);
if (!process.argv.includes("--apply")) {
  // Safe offline dry-run: no dotenv, credentials, network or database client loaded.
  console.log(JSON.stringify({ mode: "dry-run", path, statementCount: statements.length,
    message: "Tidak ada akses database. Periksa cadangan dan database tujuan sebelum menjalankan --apply." }, null, 2));
  console.log(content);
} else {
  await import("dotenv/config");
  const { neon } = await import("@neondatabase/serverless");
  const url = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_MIGRATION_URL atau DATABASE_URL belum dikonfigurasi.");
  const target = new URL(url);
  console.log(JSON.stringify({ mode: "apply", host: target.hostname, database: target.pathname.slice(1) }));
  const sql = neon(url);
  await sql.transaction(statements.map((statement) => sql(statement, [])));
  const columns = await sql(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND (
    (table_name = 'event_announcements' AND column_name IN ('email_subject', 'send_email_notification', 'content_format')) OR
    (table_name = 'announcement_recipients' AND column_name IN ('rendered_title', 'rendered_body')) OR
    (table_name = 'event_communication_templates' AND column_name IN ('id', 'event_id', 'name', 'category', 'title', 'body',
      'email_subject', 'audience_type', 'send_email_notification', 'created_by', 'created_at', 'updated_at', 'archived_at')))
    ORDER BY table_name, column_name`, []);
  if (columns.length !== 18) throw new Error("Verifikasi skema komunikasi gagal.");
  console.log(JSON.stringify({ ready: true, columns }, null, 2));
}