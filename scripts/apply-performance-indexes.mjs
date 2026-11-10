import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../drizzle/0015_performance_read_indexes.sql', import.meta.url));
const statements = readFileSync(file, 'utf8').split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean);
if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({ mode: 'dry-run', file, statements, message: 'Tidak mengakses database. Uji dahulu pada branch terisolasi; aplikasi tetap dapat berjalan tanpa indeks ini.' }, null, 2));
} else {
  await import('dotenv/config');
  const connection = process.env.DATABASE_MIGRATION_URL;
  const expectedHost = process.argv.find(value => value.startsWith('--expected-host='))?.slice('--expected-host='.length);
  if (!connection || !expectedHost) throw new Error('DATABASE_MIGRATION_URL dan --expected-host=<host> wajib diisi secara eksplisit.');
  const target = new URL(connection);
  if (target.hostname !== expectedHost || target.hostname.includes('-pooler')) throw new Error('Host harus sama dengan --expected-host dan memakai koneksi langsung, bukan pooled.');
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(connection);
  // One index at a time, without a long transaction holding all table locks.
  // CONCURRENTLY avoids blocking operational writes on a busy production database.
  for (const statement of statements) await sql(statement.replace('CREATE INDEX IF NOT EXISTS', 'CREATE INDEX CONCURRENTLY IF NOT EXISTS'), []);
  const indexes = await sql("SELECT c.relname as indexname, i.indisvalid as valid, i.indisready as ready FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('idx_participants_ustadz','idx_participants_event_created','idx_participant_history_latest','idx_ustadz_norm_name','idx_ustadz_phone')", []);
  if (indexes.length !== 5 || indexes.some(index => !index.valid || !index.ready)) throw new Error('Kelima indeks harus tersedia, valid, dan siap. Periksa indeks CONCURRENTLY yang mungkin terputus; jangan hapus otomatis.');
  console.log(JSON.stringify({ ready: true, host: target.hostname, indexes: indexes.map(row => row.indexname) }, null, 2));
}
