import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const path = fileURLToPath(new URL('../drizzle/0012_ustadz_yts_notes.sql', import.meta.url));
const content = readFileSync(path, 'utf8');
const statements = content.split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean);
const unknown = process.argv.slice(2).filter(value => value !== '--apply');
if (unknown.length) throw new Error(`Argumen tidak dikenal: ${unknown.join(', ')}`);
if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({ mode: 'dry-run', path, statementCount: statements.length, message: 'Tanpa akses database. Verifikasi cadangan dan target sebelum --apply.' }, null, 2));
  console.log(content);
} else {
  await import('dotenv/config');
  const { neon } = await import('@neondatabase/serverless');
  const url = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_MIGRATION_URL atau DATABASE_URL diperlukan.');
  const target = new URL(url);
  console.log(JSON.stringify({ mode: 'apply', host: target.hostname, database: target.pathname.slice(1) }));
  const query = neon(url);
  await query.transaction(statements.map(statement => query(statement, [])));
  const columns = await query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='ustadz_yts_notes' ORDER BY column_name", []);
  const indexes = await query("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname='idx_ustadz_yts_notes_profile'", []);
  if (columns.length !== 11 || indexes.length !== 1) throw new Error('Verifikasi skema catatan YTS gagal. Periksa skema sebelum menggunakan fitur.');
  console.log(JSON.stringify({ ready: true, columnCount: columns.length, indexCount: indexes.length }, null, 2));
}