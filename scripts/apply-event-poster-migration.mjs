import "dotenv/config";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL belum dikonfigurasi.");
}

const sql = neon(process.env.DATABASE_URL);

await sql(`alter table events add column if not exists poster_url text`, []);
await sql(`alter table events add column if not exists poster_alt text`, []);
await sql(`alter table events add column if not exists poster_focal_point text not null default 'CENTER'`, []);

const columns = await sql(
  `select column_name
   from information_schema.columns
   where table_name = 'events'
     and column_name in ('poster_url', 'poster_alt', 'poster_focal_point')
   order by column_name`,
  [],
);

console.log(JSON.stringify({
  applied: true,
  columns: columns.map((column) => column.column_name),
}, null, 2));
