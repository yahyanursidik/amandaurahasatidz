import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { events } from "./events";
import { users } from "./foundation";

export const eventKioskDevices = pgTable("event_kiosk_devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  pairingTokenHash: text("pairing_token_hash").notNull().unique(),
  pairingExpiresAt: timestamp("pairing_expires_at", { withTimezone: true }).notNull(),
  deviceTokenHash: text("device_token_hash").unique(),
  deviceExpiresAt: timestamp("device_expires_at", { withTimezone: true }),
  pairedAt: timestamp("paired_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("idx_event_kiosk_devices_event").on(table.eventId)]);
