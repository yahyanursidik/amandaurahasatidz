import { boolean, date, doublePrecision, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./foundation";
import { institutions } from "./master_data";

export const ukhuwahLocations = pgTable("ukhuwah_locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id").references(() => institutions.id, { onDelete: "set null" }),
  name: text("name").notNull(), type: text("type").notNull(), address: text("address").notNull(),
  cityCode: text("city_code").notNull(), district: text("district").notNull(),
  latitude: doublePrecision("latitude"), longitude: doublePrecision("longitude"),
  programs: text("programs").notNull().default(""), needs: text("needs").notNull().default(""),
  isPublished: boolean("is_published").notNull().default(false), isVerified: boolean("is_verified").notNull().default(false),
  officialPhone: text("official_phone").notNull().default(""), picName: text("pic_name").notNull().default(""), picPhone: text("pic_phone").notNull().default(""),
  officialContactShared: boolean("official_contact_shared").notNull().default(false), picContactShared: boolean("pic_contact_shared").notNull().default(false),
  contactConsentConfirmed: boolean("contact_consent_confirmed").notNull().default(false), contactConsentSource: text("contact_consent_source").notNull().default(""),
  contactConfirmedAt: timestamp("contact_confirmed_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
  createdBy: uuid("created_by").notNull().references(() => users.id), updatedBy: uuid("updated_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("idx_ukhuwah_locations_scope").on(t.isPublished, t.cityCode, t.updatedAt, t.id)]);

export const ukhuwahReports = pgTable("ukhuwah_reports", {
  id: uuid("id").primaryKey().defaultRandom(), authorUserId: uuid("author_user_id").notNull().references(() => users.id),
  title: text("title").notNull(), body: text("body").notNull().default(""), category: text("category").notNull(),
  cityCode: text("city_code").notNull(), district: text("district").notNull(),
  locationId: uuid("location_id").references(() => ukhuwahLocations.id, { onDelete: "set null" }),
  observedAt: date("observed_at").notNull(), source: text("source").notNull().default(""), urgency: text("urgency").notNull().default("NORMAL"),
  audience: text("audience").notNull().default("SHARED"), hideAuthor: boolean("hide_author").notNull().default(false),
  publicationStatus: text("publication_status").notNull().default("DRAFT"), workStatus: text("work_status").notNull().default("OPEN"),
  moderationReason: text("moderation_reason"), moderatedBy: uuid("moderated_by").references(() => users.id),
  followupSummary: text("followup_summary").notNull().default(""), coordinatorName: text("coordinator_name").notNull().default(""), dueDate: date("due_date"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("idx_ukhuwah_reports_author").on(t.authorUserId, t.updatedAt, t.id),
  index("idx_ukhuwah_reports_board").on(t.audience, t.publicationStatus, t.cityCode, t.updatedAt, t.id)]);