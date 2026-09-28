import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_MIGRATION_URL atau DATABASE_URL belum dikonfigurasi.");

const sql = neon(url);
// Keep this repair idempotent for environments that already have some or all columns.
await sql('ALTER TABLE public.events ADD COLUMN IF NOT EXISTS regular_quota integer', []);
await sql('ALTER TABLE public.events ADD COLUMN IF NOT EXISTS invitation_quota integer', []);
await sql('ALTER TABLE public.event_participants ADD COLUMN IF NOT EXISTS public_group_id uuid', []);
await sql('ALTER TABLE public.event_announcements ADD COLUMN IF NOT EXISTS target_institution_id uuid', []);
await sql(`DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_announcements_target_institution_id_institutions_id_fk') THEN
    ALTER TABLE public.event_announcements
      ADD CONSTRAINT event_announcements_target_institution_id_institutions_id_fk
      FOREIGN KEY (target_institution_id) REFERENCES public.institutions(id);
  END IF;
END $$`, []);
await sql('CREATE INDEX IF NOT EXISTS idx_participants_public_group ON public.event_participants (event_id, public_group_id)', []);

const columns = await sql(`SELECT table_name, column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND
  ((table_name = 'events' AND column_name IN ('regular_quota', 'invitation_quota')) OR
   (table_name = 'event_participants' AND column_name = 'public_group_id') OR
   (table_name = 'event_announcements' AND column_name = 'target_institution_id'))
  ORDER BY table_name, column_name`, []);
console.log(JSON.stringify({ ready: columns.length === 4, columns }, null, 2));
