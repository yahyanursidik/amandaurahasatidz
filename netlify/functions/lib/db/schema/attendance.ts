import { pgTable, uuid, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { users } from "./foundation";
import { events, eventDays, eventSessions } from "./events";
import { eventParticipants } from "./participants";

// 18. attendance_records
export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    eventDayId: uuid("event_day_id").references(() => eventDays.id),
    eventSessionId: uuid("event_session_id").references(() => eventSessions.id),
    participantId: uuid("participant_id").notNull().references(() => eventParticipants.id, { onDelete: "cascade" }),
    attendanceStatus: text("attendance_status").notNull().default("PRESENT"),
    checkinAt: timestamp("checkin_at", { withTimezone: true }),
    checkoutAt: timestamp("checkout_at", { withTimezone: true }),
    checkinMethod: text("checkin_method"),
    recordedBy: uuid("recorded_by").references(() => users.id),
    sourceDevice: text("source_device"),
    notes: text("notes"),
    correctedAt: timestamp("corrected_at", { withTimezone: true }),
    correctedBy: uuid("corrected_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_attendance_event_part").on(table.eventId, table.participantId),
    index("idx_attendance_sess_status").on(table.eventSessionId, table.attendanceStatus),
  ]
);

// 19. checkin_tokens
export const checkinTokens = pgTable(
  "checkin_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    eventDayId: uuid("event_day_id").references(() => eventDays.id),
    eventSessionId: uuid("event_session_id").references(() => eventSessions.id),
    tokenHash: text("token_hash").unique().notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
    maxUses: integer("max_uses"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

// 20. checkin_logs
export const checkinLogs = pgTable(
  "checkin_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id").references(() => eventParticipants.id),
    eventSessionId: uuid("event_session_id").references(() => eventSessions.id),
    method: text("method").notNull(),
    result: text("result").notNull(),
    failureReason: text("failure_reason"),
    scannedBy: uuid("scanned_by").references(() => users.id),
    requestId: text("request_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_checkin_logs_event_time").on(table.eventId, table.createdAt),
  ]
);
