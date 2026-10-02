import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./foundation";

export const ruangThreadCategories = ["SUGGESTION", "EXPERIENCE", "NEED", "QUESTION"] as const;
export const ruangThreadStatuses = ["NEW", "READ", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
export const ruangPublicationStatuses = ["PRIVATE", "PENDING", "PUBLISHED", "HIDDEN"] as const;
export type ThreadCategory = typeof ruangThreadCategories[number];
export type ThreadStatus = typeof ruangThreadStatuses[number];
export type PublicationStatus = typeof ruangPublicationStatuses[number];

export const ruangAsatidzThreads = pgTable("ruang_asatidz_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  category: text("category", { enum: ruangThreadCategories }).notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  shareExperience: boolean("share_experience").notNull().default(false),
  status: text("status", { enum: ruangThreadStatuses }).notNull().default("NEW"),
  publicationStatus: text("publication_status", { enum: ruangPublicationStatuses }).notNull().default("PRIVATE"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check("ruang_threads_category_check", sql`${t.category} IN ('SUGGESTION', 'EXPERIENCE', 'NEED', 'QUESTION')`),
  check("ruang_threads_status_check", sql`${t.status} IN ('NEW', 'READ', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')`),
  check("ruang_threads_publication_check", sql`${t.publicationStatus} IN ('PRIVATE', 'PENDING', 'PUBLISHED', 'HIDDEN')`),
  check("ruang_threads_consent_check", sql`(NOT ${t.shareExperience} OR ${t.category} = 'EXPERIENCE') AND (${t.publicationStatus} = 'PRIVATE' OR (${t.shareExperience} AND ${t.category} = 'EXPERIENCE'))`),
  check("ruang_threads_published_at_check", sql`${t.publicationStatus} <> 'PUBLISHED' OR ${t.publishedAt} IS NOT NULL`),
  check("ruang_threads_content_check", sql`length(trim(${t.subject})) BETWEEN 5 AND 160 AND length(trim(${t.body})) BETWEEN 10 AND 5000`),
  index("idx_ruang_threads_user_created").on(t.userId, t.createdAt, t.id),
  index("idx_ruang_threads_status_created").on(t.status, t.createdAt, t.id),
  index("idx_ruang_threads_category_created").on(t.category, t.createdAt, t.id),
  index("idx_ruang_threads_board").on(t.publishedAt, t.id).where(sql`${t.publicationStatus} = 'PUBLISHED' AND ${t.category} = 'EXPERIENCE' AND ${t.shareExperience} = true`),
]);

export const ruangAsatidzReplies = pgTable("ruang_asatidz_replies", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id").notNull().references(() => ruangAsatidzThreads.id, { onDelete: "cascade" }),
  authorUserId: uuid("author_user_id").notNull().references(() => users.id),
  authorRole: text("author_role", { enum: ["ASATIDZ", "YTS"] }).notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check("ruang_replies_role_check", sql`${t.authorRole} IN ('ASATIDZ', 'YTS')`),
  check("ruang_replies_body_check", sql`length(trim(${t.body})) BETWEEN 2 AND 5000`),
  index("idx_ruang_replies_thread_created").on(t.threadId, t.createdAt, t.id),
  index("idx_ruang_replies_author").on(t.authorUserId),
]);

export const ruangAsatidzGreetings = pgTable("ruang_asatidz_greetings", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  isPublished: boolean("is_published").notNull().default(false),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check("ruang_greetings_content_check", sql`length(trim(${t.title})) BETWEEN 5 AND 160 AND length(trim(${t.body})) BETWEEN 10 AND 5000`),
  index("idx_ruang_greetings_published_created").on(t.isPublished, t.createdAt, t.id),
  index("idx_ruang_greetings_created_by").on(t.createdBy),
  index("idx_ruang_greetings_updated_by").on(t.updatedBy),
]);