import { pgTable, uuid, text, timestamp, boolean, integer, uniqueIndex, index } from "drizzle-orm/pg-core";
import { users } from "./foundation";
import { institutions, institutionRepresentatives, ustadzProfiles } from "./master_data";
import { events } from "./events";

// 13. invitations
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    invitationType: text("invitation_type").notNull(),
    institutionId: uuid("institution_id").references(() => institutions.id),
    ustadzId: uuid("ustadz_id").references(() => ustadzProfiles.id),
    invitationNumber: text("invitation_number").notNull(),
    quota: integer("quota"),
    status: text("status").notNull().default("DRAFT"),
    responseDeadline: timestamp("response_deadline", { withTimezone: true }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_invitation_num").on(table.eventId, table.invitationNumber),
    index("idx_invitations_status").on(table.eventId, table.status),
  ]
);

// 14. invitation_links
export const invitationLinks = pgTable(
  "invitation_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invitationId: uuid("invitation_id").notNull().references(() => invitations.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").unique().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    maxUses: integer("max_uses"),
    usedCount: integer("used_count").notNull().default(0),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_invitation_link_inv").on(table.invitationId),
  ]
);

// 15. invitation_responses
export const invitationResponses = pgTable(
  "invitation_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invitationId: uuid("invitation_id").notNull().references(() => invitations.id, { onDelete: "cascade" }),
    responseStatus: text("response_status").notNull(),
    representativeId: uuid("representative_id").references(() => institutionRepresentatives.id),
    notes: text("notes"),
    isFinal: boolean("is_final").notNull().default(false),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }
);
