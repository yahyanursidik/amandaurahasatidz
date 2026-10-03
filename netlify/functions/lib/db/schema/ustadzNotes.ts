import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./foundation";
import { ustadzProfiles } from "./master_data";

// Deliberately separate from profiles: generic profile reads/exports never include internal notes.
export const ustadzYtsNotes = pgTable("ustadz_yts_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  ustadzId: uuid("ustadz_id").notNull().references(() => ustadzProfiles.id),
  title: text("title").notNull(), body: text("body").notNull(), flag: text("flag").notNull(),
  version: integer("version").notNull().default(1),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  updatedBy: uuid("updated_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("idx_ustadz_yts_notes_profile").on(t.ustadzId, t.archivedAt, t.updatedAt, t.id)]);