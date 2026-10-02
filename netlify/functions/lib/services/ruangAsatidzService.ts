import { and, asc, count, desc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { getDbClient } from "../db/client";
import {
  ruangAsatidzThreads as threads, ruangAsatidzReplies as replies,
  ruangAsatidzGreetings as greetings, users,
  type ThreadCategory, type ThreadStatus, type PublicationStatus,
} from "../db/schema";
import {
  createRuangThreadSchema, ruangReplySchema, updateRuangThreadSchema,
  ruangGreetingSchema, ruangListQuerySchema,
  type RuangListQuery, type UpdateRuangThreadInput, type RuangGreetingInput,
} from "../validations/ruangAsatidzValidation";
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from "../utils/errors";
import { createAuditLog } from "./auditService";

export type { ThreadCategory, ThreadStatus, PublicationStatus } from "../db/schema/ruangAsatidz";
export interface ThreadSummary {
  id: string; userId: string; category: ThreadCategory; subject: string;
  status: ThreadStatus; publicationStatus: PublicationStatus; shareExperience: boolean;
  createdAt: Date; updatedAt: Date; authorName?: string | null; authorEmail?: string | null;
}
export interface Reply {
  id: string; threadId: string; authorRole: "ASATIDZ" | "YTS";
  authorName?: string | null; body: string; createdAt: Date;
}
export interface ThreadDetail extends ThreadSummary { body: string; replies: Reply[] }
export interface BoardExperience {
  id: string; subject: string; body: string; authorName: string | null;
  createdAt: Date; publishedAt: Date | null;
}
export interface Greeting {
  id: string; title: string; body: string; isPublished: boolean; createdAt: Date; updatedAt: Date;
}
export interface Paged<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

const summaryColumns = {
  id: threads.id, userId: threads.userId, category: threads.category, subject: threads.subject,
  status: threads.status, publicationStatus: threads.publicationStatus,
  shareExperience: threads.shareExperience, createdAt: threads.createdAt, updatedAt: threads.updatedAt,
};
const replyColumns = {
  id: replies.id, threadId: replies.threadId, authorRole: replies.authorRole,
  body: replies.body, createdAt: replies.createdAt,
};
const greetingColumns = {
  id: greetings.id, title: greetings.title, body: greetings.body, isPublished: greetings.isPublished,
  createdAt: greetings.createdAt, updatedAt: greetings.updatedAt,
};

function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError("Data Ruang Asatidz tidak valid.");
  return result.data;
}
function requireActor(userId: string | null | undefined): asserts userId is string {
  if (!userId?.trim()) throw new UnauthorizedError();
}
function threadScope(threadId: string, userId: string | null, admin: boolean) {
  // admin=true is a trusted capability, never a request-body/query value.
  if (!admin) requireActor(userId);
  return and(eq(threads.id, threadId), admin ? undefined : eq(threads.userId, userId!));
}
function threadFilters(query: RuangListQuery, userId?: string) {
  return and(
    userId ? eq(threads.userId, userId) : undefined,
    query.category ? eq(threads.category, query.category) : undefined,
    query.status ? eq(threads.status, query.status) : undefined,
  );
}
function paged<T>(data: T[], total: number, query: { page: number; pageSize: number }): Paged<T> {
  return { data, meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
}

/** All callers MUST authenticate. Admin operations MUST enforce admin RBAC in the API.
 * The board and published greetings are for authorized USTADZ/admin, never anonymous routes.
 * Actor IDs MUST come from the authenticated principal, not from request input.
 * Writes use single guarded SQL statements; audit is best-effort, not an HTTP transaction.
 */
export async function listMyThreads(userId: string, query: z.input<typeof ruangListQuerySchema>): Promise<Paged<ThreadSummary>> {
  requireActor(userId);
  const paging = parse(ruangListQuerySchema, query);
  const db = getDbClient();
  const filter = threadFilters(paging, userId);
  const [data, totals] = await Promise.all([
    db.select(summaryColumns).from(threads).where(filter)
      .orderBy(desc(threads.createdAt), desc(threads.id)).limit(paging.pageSize).offset((paging.page - 1) * paging.pageSize),
    db.select({ total: count() }).from(threads).where(filter),
  ]);
  return paged(data, Number(totals[0]?.total ?? 0), paging);
}

export async function createThread(
  userId: string, input: z.input<typeof createRuangThreadSchema>, requestId: string,
): Promise<ThreadSummary> {
  requireActor(userId);
  const valid = parse(createRuangThreadSchema, input);
  const [thread] = await getDbClient().insert(threads).values({
    userId, category: valid.category, subject: valid.subject, body: valid.body,
    shareExperience: valid.shareExperience, status: "NEW",
    publicationStatus: valid.shareExperience ? "PENDING" : "PRIVATE",
  }).returning(summaryColumns);
  await createAuditLog({ actorUserId: userId, action: "RUANG_THREAD_CREATED", resourceType: "ruang_asatidz_thread",
    resourceId: thread.id, requestId, afterData: { category: thread.category, shareExperience: thread.shareExperience } });
  return thread;
}

export async function getThread(threadId: string, userId: string | null, admin: boolean): Promise<ThreadDetail> {
  const scope = threadScope(threadId, userId, admin);
  const db = getDbClient();
  const [thread] = await db.select({
    ...summaryColumns, body: threads.body,
    ...(admin ? { authorName: users.name, authorEmail: users.email } : {}),
  }).from(threads).leftJoin(users, eq(threads.userId, users.id)).where(scope).limit(1);
  if (!thread) throw new NotFoundError("Percakapan tidak ditemukan.");
  // Reapply ownership to the reply query itself rather than trusting a prior read.
  const data = await db.select({ ...replyColumns, authorName: users.name }).from(replies)
    .innerJoin(threads, eq(replies.threadId, threads.id))
    .leftJoin(users, eq(replies.authorUserId, users.id)).where(scope)
    .orderBy(asc(replies.createdAt), asc(replies.id));
  return { ...thread, replies: data };
}

export async function addReply(
  threadId: string, actorUserId: string, admin: boolean, input: { body: string }, requestId: string,
): Promise<Reply> {
  requireActor(actorUserId);
  const valid = parse(ruangReplySchema, input);
  const db = getDbClient();
  const scope = threadScope(threadId, actorUserId, admin);
  // INSERT ... SELECT keeps both ownership and CLOSED checks in the write statement.
  // Explicit column order matches Drizzle's insert-select order.
  const [reply] = await db.insert(replies).select(db.select({
    id: sql<string>`gen_random_uuid()`.as("id"),
    threadId: threads.id,
    authorUserId: sql<string>`${actorUserId}::uuid`.as("author_user_id"),
    authorRole: sql<"ASATIDZ" | "YTS">`${admin ? "YTS" : "ASATIDZ"}::text`.as("author_role"),
    body: sql<string>`${valid.body}::text`.as("body"),
    createdAt: sql<Date>`now()`.as("created_at"),
  }).from(threads).where(and(scope, ne(threads.status, "CLOSED")))).returning(replyColumns);
  if (!reply) {
    const [thread] = await db.select({ status: threads.status }).from(threads).where(scope).limit(1);
    if (!thread) throw new NotFoundError("Percakapan tidak ditemukan.");
    throw new ConflictError("Percakapan sudah ditutup.");
  }
  await createAuditLog({ actorUserId, action: "RUANG_REPLY_CREATED", resourceType: "ruang_asatidz_reply",
    resourceId: reply.id, requestId, afterData: { threadId, authorRole: reply.authorRole } });
  return reply;
}

/** Admin-only; authenticate and authorize at the API boundary. */
export async function listAdminThreads(query: z.input<typeof ruangListQuerySchema>): Promise<Paged<ThreadSummary>> {
  const paging = parse(ruangListQuerySchema, query);
  const db = getDbClient();
  const filter = threadFilters(paging);
  const [data, totals] = await Promise.all([
    db.select({ ...summaryColumns, authorName: users.name, authorEmail: users.email }).from(threads)
      .leftJoin(users, eq(threads.userId, users.id)).where(filter)
      .orderBy(desc(threads.createdAt), desc(threads.id)).limit(paging.pageSize).offset((paging.page - 1) * paging.pageSize),
    db.select({ total: count() }).from(threads).where(filter),
  ]);
  return paged(data, Number(totals[0]?.total ?? 0), paging);
}

/** Admin-only; status and publication are independent, including CLOSED published experiences. */
export async function updateThread(
  threadId: string, actorUserId: string, input: UpdateRuangThreadInput, requestId: string,
): Promise<ThreadSummary> {
  requireActor(actorUserId);
  const valid = parse(updateRuangThreadSchema, input);
  const db = getDbClient();
  const filter = and(eq(threads.id, threadId), valid.publicationStatus ? and(
    eq(threads.category, "EXPERIENCE"), eq(threads.shareExperience, true),
  ) : undefined);
  const changes: Partial<typeof threads.$inferInsert> = {
    updatedAt: new Date(),
    ...(valid.status ? { status: valid.status } : {}),
    ...(valid.publicationStatus ? { publicationStatus: valid.publicationStatus } : {}),
  };
  const [thread] = await db.update(threads).set({ ...changes,
    ...(valid.publicationStatus === "PUBLISHED" ? { publishedAt: sql`coalesce(${threads.publishedAt}, now())` } : {}),
  }).where(filter).returning(summaryColumns);
  if (!thread) {
    const [existing] = await db.select({ id: threads.id }).from(threads).where(eq(threads.id, threadId)).limit(1);
    if (!existing) throw new NotFoundError("Percakapan tidak ditemukan.");
    throw new ValidationError("Hanya pengalaman dengan persetujuan berbagi yang dapat dimoderasi.");
  }
  await createAuditLog({ actorUserId, action: "RUANG_THREAD_UPDATED", resourceType: "ruang_asatidz_thread",
    resourceId: threadId, requestId, afterData: {
      ...(valid.status ? { status: valid.status } : {}),
      ...(valid.publicationStatus ? { publicationStatus: valid.publicationStatus } : {}),
    } });
  return thread;
}

/** Authorized USTADZ/admin only. This projection deliberately excludes IDs/contact/replies. */
export async function listExperienceBoard(query: { page?: number; pageSize?: number }): Promise<Paged<BoardExperience>> {
  const paging = parse(ruangListQuerySchema.pick({ page: true, pageSize: true }), query);
  const db = getDbClient();
  const filter = and(eq(threads.category, "EXPERIENCE"), eq(threads.shareExperience, true), eq(threads.publicationStatus, "PUBLISHED"));
  const [data, totals] = await Promise.all([
    db.select({ id: threads.id, subject: threads.subject, body: threads.body, authorName: users.name,
      createdAt: threads.createdAt, publishedAt: threads.publishedAt }).from(threads)
      .leftJoin(users, eq(threads.userId, users.id)).where(filter)
      .orderBy(desc(threads.publishedAt), desc(threads.id)).limit(paging.pageSize).offset((paging.page - 1) * paging.pageSize),
    db.select({ total: count() }).from(threads).where(filter),
  ]);
  return paged(data, Number(totals[0]?.total ?? 0), paging);
}

export async function listGreetings(admin: boolean, query: { page?: number; pageSize?: number }): Promise<Paged<Greeting>> {
  const paging = parse(ruangListQuerySchema.pick({ page: true, pageSize: true }), query);
  const db = getDbClient();
  const filter = admin ? undefined : eq(greetings.isPublished, true);
  const [data, totals] = await Promise.all([
    db.select(greetingColumns).from(greetings).where(filter)
      .orderBy(desc(greetings.createdAt), desc(greetings.id)).limit(paging.pageSize).offset((paging.page - 1) * paging.pageSize),
    db.select({ total: count() }).from(greetings).where(filter),
  ]);
  return paged(data, Number(totals[0]?.total ?? 0), paging);
}

/** Admin-only. */
export async function saveGreeting(
  actorUserId: string, greetingId: string | null, input: RuangGreetingInput, requestId: string,
): Promise<Greeting> {
  requireActor(actorUserId);
  const valid = parse(ruangGreetingSchema, input);
  const db = getDbClient();
  const [greeting] = greetingId
    ? await db.update(greetings).set({ ...valid, updatedBy: actorUserId, updatedAt: new Date() })
      .where(eq(greetings.id, greetingId)).returning(greetingColumns)
    : await db.insert(greetings).values({ ...valid, createdBy: actorUserId, updatedBy: actorUserId }).returning(greetingColumns);
  if (!greeting) throw new NotFoundError("Sapaan tidak ditemukan.");
  await createAuditLog({ actorUserId, action: greetingId ? "RUANG_GREETING_UPDATED" : "RUANG_GREETING_CREATED",
    resourceType: "ruang_asatidz_greeting", resourceId: greeting.id, requestId,
    afterData: { isPublished: greeting.isPublished } });
  return greeting;
}