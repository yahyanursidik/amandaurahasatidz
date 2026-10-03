import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const path = fileURLToPath(new URL('../drizzle/0011_peta_ukhuwah.sql', import.meta.url));
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
  const columns = await query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('ukhuwah_locations','ukhuwah_reports') ORDER BY table_name,column_name", []);
  const indexes = await query("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN ('idx_ukhuwah_locations_scope','idx_ukhuwah_reports_author','idx_ukhuwah_reports_board')", []);
  if (columns.filter(c => c.table_name === 'ukhuwah_locations').length !== 26 || columns.filter(c => c.table_name === 'ukhuwah_reports').length !== 23 || indexes.length !== 3) throw new Error('Verifikasi skema Peta Ukhuwah gagal. Jangan gunakan fitur sebelum skema diperiksa.');
  console.log(JSON.stringify({ ready: true, columnCount: columns.length, indexCount: indexes.length }, null, 2));
}