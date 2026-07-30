import { pgTable, uuid, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { users } from "./foundation";
import { institutions } from "./master_data";
import { events } from "./events";
import { eventParticipants } from "./participants";

// 21. event_announcements
export const eventAnnouncements = pgTable(
  "event_announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    audienceType: text("audience_type").notNull().default("ALL"),
    status: text("status").notNull().default("DRAFT"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

// 22. announcement_recipients
export const announcementRecipients = pgTable(
  "announcement_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    announcementId: uuid("announcement_id").notNull().references(() => eventAnnouncements.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id),
    participantId: uuid("participant_id").references(() => eventParticipants.id),
    institutionId: uuid("institution_id").references(() => institutions.id),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

// 23. email_templates
export const emailTemplates = pgTable(
  "email_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").unique().notNull(),
    name: text("name").notNull(),
    subjectTemplate: text("subject_template").notNull(),
    bodyTemplate: text("body_template").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

// 24. email_jobs
export const emailJobs = pgTable(
  "email_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").references(() => events.id),
    templateId: uuid("template_id").notNull().references(() => emailTemplates.id),
    recipientEmail: text("recipient_email").notNull(),
    recipientName: text("recipient_name"),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("QUEUED"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    idempotencyKey: text("idempotency_key").unique().notNull(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_email_jobs_status_sched").on(table.status, table.scheduledAt),
  ]
);

// 25. email_deliveries
export const emailDeliveries = pgTable(
  "email_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    emailJobId: uuid("email_job_id").notNull().references(() => emailJobs.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerMessageId: text("provider_message_id"),
    status: text("status").notNull().default("PENDING"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    bouncedAt: timestamp("bounced_at", { withTimezone: true }),
    complainedAt: timestamp("complained_at", { withTimezone: true }),
    providerPayload: jsonb("provider_payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_email_deliv_msg_id").on(table.providerMessageId),
  ]
);
