import "dotenv/config";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL belum dikonfigurasi.");
}

const sql = neon(process.env.DATABASE_URL);
const duplicates = await sql(
  `select event_id, user_id, committee_role, count(1)::int as total
   from event_committee_assignments
   group by event_id, user_id, committee_role
   having count(1) > 1`,
  [],
);

if (duplicates.length > 0) {
  throw new Error(`Migrasi dihentikan: ditemukan ${duplicates.length} penugasan panitia duplikat.`);
}

await sql(
  `alter table events
   add column if not exists invitation_response_deadline timestamp with time zone`,
  [],
);
await sql(
  `alter table events
   add column if not exists attendance_confirmation_deadline timestamp with time zone`,
  [],
);
await sql(
  `alter table events
   add column if not exists attendance_confirmation_required boolean not null default true`,
  [],
);
await sql(
  `alter table events
   add column if not exists late_confirmation_policy text not null default 'BLOCK'`,
  [],
);
await sql(
  `create unique index if not exists uniq_committee_event_user_role
   on event_committee_assignments (event_id, user_id, committee_role)`,
  [],
);

const columns = await sql(
  `select column_name
   from information_schema.columns
   where table_name = 'events'
     and column_name in (
       'invitation_response_deadline',
       'attendance_confirmation_deadline',
       'attendance_confirmation_required',
       'late_confirmation_policy'
     )
   order by column_name`,
  [],
);

console.log(JSON.stringify({
  applied: true,
  columns: columns.map((column) => column.column_name),
  duplicateAssignments: duplicates.length,
}, null, 2));
