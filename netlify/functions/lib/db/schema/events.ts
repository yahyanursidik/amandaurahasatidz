import { pgTable, uuid, text, timestamp, boolean, integer, date, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { users } from "./foundation";
import { ustadzProfiles } from "./master_data";

// 9. events
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").unique().notNull(),
    slug: text("slug").unique().notNull(),
    name: text("name").notNull(),
    subtitle: text("subtitle"),
    description: text("description"),
    posterUrl: text("poster_url"),
    posterAlt: text("poster_alt"),
    posterFocalPoint: text("poster_focal_point").notNull().default("CENTER"),
    audienceMode: text("audience_mode").notNull().default("INSTITUTION_INVITATION"),
    attendanceMode: text("attendance_mode").notNull().default("DAILY_AND_SESSION"),
    timezone: text("timezone").notNull().default("Asia/Jakarta"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    venueName: text("venue_name"),
    venueAddress: text("venue_address"),
    mapsUrl: text("maps_url"),
    registrationOpenAt: timestamp("registration_open_at", { withTimezone: true }),
    registrationCloseAt: timestamp("registration_close_at", { withTimezone: true }),
    invitationResponseDeadline: timestamp("invitation_response_deadline", { withTimezone: true }),
    attendanceConfirmationDeadline: timestamp("attendance_confirmation_deadline", { withTimezone: true }),
    attendanceConfirmationRequired: boolean("attendance_confirmation_required").notNull().default(true),
    lateConfirmationPolicy: text("late_confirmation_policy").notNull().default("BLOCK"),
    defaultInstitutionQuota: integer("default_institution_quota"),
    capacity: integer("capacity"),
    status: text("status").notNull().default("DRAFT"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_events_status_date").on(table.status, table.startDate),
  ]
);

// 10. event_days
export const eventDays = pgTable(
  "event_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    dayNumber: integer("day_number").notNull(),
    date: date("date").notNull(),
    title: text("title"),
    checkinOpenAt: timestamp("checkin_open_at", { withTimezone: true }),
    checkinCloseAt: timestamp("checkin_close_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_event_day_num").on(table.eventId, table.dayNumber),
    uniqueIndex("uniq_event_day_date").on(table.eventId, table.date),
  ]
);

// 11. event_sessions
export const eventSessions = pgTable(
  "event_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventDayId: uuid("event_day_id").notNull().references(() => eventDays.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    sessionType: text("session_type").notNull().default("MATERIAL"),
    speakerUstadzId: uuid("speaker_ustadz_id").references(() => ustadzProfiles.id),
    moderatorName: text("moderator_name"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    room: text("room"),
    attendanceRequired: boolean("attendance_required").notNull().default(true),
    checkinRequired: boolean("checkin_required").notNull().default(true),
    checkinOpenAt: timestamp("checkin_open_at", { withTimezone: true }),
    checkinCloseAt: timestamp("checkin_close_at", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_sessions_day").on(table.eventDayId),
  ]
);

// 12. event_committee_assignments
export const eventCommitteeAssignments = pgTable(
  "event_committee_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    committeeRole: text("committee_role").notNull(),
    permissions: jsonb("permissions"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_committee_event_user_role").on(table.eventId, table.userId, table.committeeRole),
    index("idx_committee_event_user").on(table.eventId, table.userId),
  ]
);
