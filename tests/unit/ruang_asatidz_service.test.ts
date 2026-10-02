import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { and, eq, ne, sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

const mocks = vi.hoisted(() => ({ db: vi.fn(), audit: vi.fn() }));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: mocks.db }));
vi.mock("../../netlify/functions/lib/services/auditService", () => ({ createAuditLog: mocks.audit }));

import {
  listMyThreads, createThread, getThread, addReply, listAdminThreads, updateThread,
  listExperienceBoard, listGreetings, saveGreeting,
} from "../../netlify/functions/lib/services/ruangAsatidzService";
import {
  createRuangThreadSchema, ruangReplySchema, updateRuangThreadSchema,
  ruangGreetingSchema, ruangListQuerySchema,
} from "../../netlify/functions/lib/validations/ruangAsatidzValidation";
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from "../../netlify/functions/lib/utils/errors";
import { ruangAsatidzThreads, ruangAsatidzReplies, ruangAsatidzGreetings } from "../../netlify/functions/lib/db/schema";

const actor = "11111111-1111-4111-8111-111111111111";
const threadId = "22222222-2222-4222-8222-222222222222";
const requestId = "ruang-test";
const date = new Date("2026-01-01T00:00:00Z");
const summary = { id: threadId, userId: actor, category: "EXPERIENCE", subject: "Pengalaman",
  status: "NEW", publicationStatus: "PRIVATE", shareExperience: false, createdAt: date, updatedAt: date };
const reply = { id: "reply", threadId, authorRole: "ASATIDZ", body: "Balasan", createdAt: date };
const greeting = { id: "greeting", title: "Sapaan", body: "Selamat datang", isPublished: false, createdAt: date, updatedAt: date };
const input = { category: "EXPERIENCE" as const, subject: " Pengalaman ", body: " Cerita privat " };
const paging = { page: 2, pageSize: 2 };

interface Query {
  kind: string; selection?: Record<string, unknown>; table?: unknown;
  filter?: SQL; changes?: Record<string, unknown>;
  source?: Query; returningFields?: Record<string, unknown>; order?: unknown[]; limitValue?: number; offsetValue?: number;
  from(table: unknown): Query; leftJoin(...args: unknown[]): Query; innerJoin(...args: unknown[]): Query;
  where(filter?: SQL): Query; orderBy(...args: unknown[]): Query; limit(value: number): Query; offset(value: number): Query;
  values(value: Record<string, unknown>): Query; set(value: Record<string, unknown>): Query;
  select(source: Query): Query; returning(fields: Record<string, unknown>): Query;
}
let queries: Query[];
let results: unknown[][];
function builder(kind: string, selection?: Record<string, unknown>, table?: unknown): Query {
  const q = {
    kind, selection, table,
    from(value: unknown) { q.table = value; return q; },
    leftJoin() { return q; }, innerJoin() { return q; },
    where(value?: SQL) { q.filter = value; return q; },
    orderBy(...value: unknown[]) { q.order = value; return q; },
    limit(value: number) { q.limitValue = value; return q; },
    offset(value: number) { q.offsetValue = value; return q; },
    values(value: Record<string, unknown>) { q.valuesData = value; return q; },
    set(value: Record<string, unknown>) { q.changes = value; return q; },
    select(value: Query) { q.source = value; return q; },
    returning(value: Record<string, unknown>) { q.returningFields = value; return q; },
    then(resolve: (data: unknown[]) => unknown, reject: (error: unknown) => unknown) {
      return Promise.resolve(results.shift() ?? []).then(resolve, reject);
    },
  } as unknown as Query & { valuesData?: Record<string, unknown> };
  queries.push(q);
  return q;
}
function values(q: Query) { return (q as Query & { valuesData: Record<string, unknown> }).valuesData; }
function compiled(q: Query) { return new PgDialect().sqlToQuery(q.filter!); }

beforeEach(() => {
  vi.resetAllMocks(); queries = []; results = [];
  mocks.audit.mockResolvedValue(undefined);
  mocks.db.mockReturnValue({
    select: (fields: Record<string, unknown>) => builder("select", fields),
    insert: (table: unknown) => builder("insert", undefined, table),
    update: (table: unknown) => builder("update", undefined, table),
  });
});

describe("validation", () => {
  it("defaults, coerces and bounds paging", () => {
    expect(ruangListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(ruangListQuerySchema.parse({ page: "2", pageSize: "50" })).toEqual({ page: 2, pageSize: 50 });
    for (const invalid of [{ page: 0 }, { page: 100001 }, { pageSize: 51 }, { pageSize: 1.5 }, { category: "OTHER" }]) {
      expect(ruangListQuerySchema.safeParse(invalid).success).toBe(false);
    }
  });
  it("trims text, rejects whitespace, oversized content, forged fields and invalid consent", () => {
    expect(createRuangThreadSchema.parse(input)).toEqual({ category: "EXPERIENCE", subject: "Pengalaman", body: "Cerita privat", shareExperience: false });
    for (const invalid of [{ ...input, subject: " " }, { ...input, body: "x".repeat(10001) },
      { ...input, userId: actor }, { ...input, publicationStatus: "PUBLISHED" },
      { ...input, category: "QUESTION", shareExperience: true }, { ...input, subject: "abc", body: "x" },
      { ...input, subject: "x".repeat(161) }, { ...input, body: "x".repeat(5001) }]) {
      expect(createRuangThreadSchema.safeParse(invalid).success).toBe(false);
    }
    expect(ruangReplySchema.safeParse({ body: " ", authorRole: "YTS" }).success).toBe(false);
    expect(ruangReplySchema.safeParse({ body: "ok", authorUserId: actor }).success).toBe(false);
    expect(updateRuangThreadSchema.safeParse({}).success).toBe(false);
    expect(updateRuangThreadSchema.safeParse({ publicationStatus: "PRIVATE" }).success).toBe(false);
    expect(ruangGreetingSchema.safeParse({ title: "Hi", body: "Hi", isPublished: "true" }).success).toBe(false);
  });
});

describe("ownership and private threads", () => {
  it("requires authenticated user for portal operations before DB access", async () => {
    await expect(listMyThreads("", {})).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(createThread("", input, requestId)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(getThread(threadId, null, false)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(addReply(threadId, "", false, { body: "Hi" }, requestId)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("lists own summaries with scoped count, stable ordering, offset and no private body/email", async () => {
    results.push([summary], [{ total: 5 }]);
    const response = await listMyThreads(actor, { ...paging, category: "EXPERIENCE", status: "NEW" });
    expect(response.meta).toEqual({ ...paging, total: 5, totalPages: 3 });
    expect(Object.keys(queries[0].selection!)).not.toContain("body");
    expect(Object.keys(queries[0].selection!)).not.toContain("authorEmail");
    expect(compiled(queries[0]).params).toEqual([actor, "EXPERIENCE", "NEW"]);
    expect(compiled(queries[1])).toEqual(compiled(queries[0]));
    expect(queries[0].offsetValue).toBe(2);
    expect(queries[0].limitValue).toBe(2);
    expect(queries[0].order).toHaveLength(2);
  });
  it.each([false, true])("creates only PRIVATE/PENDING depending on explicit consent %s", async (consent) => {
    results.push([{ ...summary, shareExperience: consent, publicationStatus: consent ? "PENDING" : "PRIVATE" }]);
    const response = await createThread(actor, { ...input, shareExperience: consent }, requestId);
    expect(values(queries[0])).toMatchObject({ userId: actor, body: "Cerita privat", shareExperience: consent,
      status: "NEW", publicationStatus: consent ? "PENDING" : "PRIVATE" });
    expect(response).not.toHaveProperty("body");
    const audit = mocks.audit.mock.calls[0][0];
    expect(audit).not.toHaveProperty("eventId");
    expect(JSON.stringify(audit)).not.toContain("Cerita privat");
    expect(JSON.stringify(audit)).not.toContain("Pengalaman");
  });
  it("denies foreign detail using SQL ownership predicate without fetching replies", async () => {
    results.push([]);
    await expect(getThread(threadId, actor, false)).rejects.toBeInstanceOf(NotFoundError);
    expect(compiled(queries[0]).params).toEqual([threadId, actor]);
    expect(queries).toHaveLength(1);
  });
  it("scopes both portal detail and reply queries and excludes author IDs/email", async () => {
    results.push([{ ...summary, body: "Private" }], [reply]);
    const result = await getThread(threadId, actor, false);
    expect(result.replies).toEqual([reply]);
    for (const q of queries) expect(compiled(q).params).toEqual([threadId, actor]);
    expect(queries[0].selection).not.toHaveProperty("authorEmail");
    expect(queries[1].selection).not.toHaveProperty("authorUserId");
  });
  it("admin detail includes author name/email only in admin selection", async () => {
    results.push([{ ...summary, body: "Private", authorEmail: "private@example.test" }], []);
    await getThread(threadId, null, true);
    expect(queries[0].selection).toHaveProperty("authorName");
    expect(queries[0].selection).toHaveProperty("authorEmail");
    expect(compiled(queries[0]).params).toEqual([threadId]);
  });
});

describe("guarded replies", () => {
  it("compiles guarded insert-select using actual Drizzle without connecting to DB", () => {
    const db = drizzle("postgres://test:test@localhost/test");
    const t = ruangAsatidzThreads;
    const statement = db.insert(ruangAsatidzReplies).select(db.select({
      id: sql<string>`gen_random_uuid()`.as("id"), threadId: t.id,
      authorUserId: sql<string>`${actor}::uuid`.as("author_user_id"),
      authorRole: sql<"ASATIDZ" | "YTS">`${"ASATIDZ"}::text`.as("author_role"),
      body: sql<string>`${"Balasan"}::text`.as("body"),
      createdAt: sql<Date>`now()`.as("created_at"),
    }).from(t).where(and(eq(t.id, threadId), eq(t.userId, actor), ne(t.status, "CLOSED"))))
      .returning({ id: ruangAsatidzReplies.id }).toSQL();
    expect(statement.sql).toContain('insert into "ruang_asatidz_replies"');
    expect(statement.sql).toContain('"ruang_asatidz_threads"."user_id" =');
    expect(statement.params).toEqual([actor, "ASATIDZ", "Balasan", threadId, actor, "CLOSED"]);
  });
  it.each([false, true])("guards insert-select CLOSED and ownership (admin %s), without implicit thread update", async (admin) => {
    results.push([{ ...reply, authorRole: admin ? "YTS" : "ASATIDZ" }]);
    const result = await addReply(threadId, actor, admin, { body: " Balasan " }, requestId);
    const source = queries[0].source!;
    expect(compiled(source).params).toEqual(admin ? [threadId, "CLOSED"] : [threadId, actor, "CLOSED"]);
    expect(new PgDialect().sqlToQuery((source.selection!.authorRole as SQL.Aliased).sql).params).toEqual([admin ? "YTS" : "ASATIDZ"]);
    expect(queries.some((q) => q.kind === "update")).toBe(false);
    expect(result).not.toHaveProperty("authorUserId");
    expect(mocks.audit.mock.calls[0][0].afterData).toEqual({ threadId, authorRole: admin ? "YTS" : "ASATIDZ" });
  });
  it("denies foreign reply on write and diagnostic read", async () => {
    results.push([], []);
    await expect(addReply(threadId, actor, false, { body: "Hi" }, requestId)).rejects.toBeInstanceOf(NotFoundError);
    expect(compiled(queries[0].source!).params).toEqual([threadId, actor, "CLOSED"]);
    expect(compiled(queries[2]).params).toEqual([threadId, actor]);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("denies CLOSED for user and admin, allowing RESOLVED (only CLOSED excluded)", async () => {
    for (const admin of [false, true]) {
      results.push([], [{ status: "CLOSED" }]);
      await expect(addReply(threadId, actor, admin, { body: "Hi" }, requestId)).rejects.toBeInstanceOf(ConflictError);
    }
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});

describe("admin moderation and consent-safe board", () => {
  it("admin list returns summaries without body and includes admin contact metadata", async () => {
    results.push([summary], [{ total: 1 }]);
    await listAdminThreads({});
    expect(queries[0].selection).toHaveProperty("authorEmail");
    expect(queries[0].selection).not.toHaveProperty("body");
  });
  it("status-only update never changes publication status or timestamp", async () => {
    results.push([{ ...summary, status: "CLOSED" }]);
    await updateThread(threadId, actor, { status: "CLOSED" }, requestId);
    expect(queries[0].changes).toMatchObject({ status: "CLOSED" });
    expect(queries[0].changes).not.toHaveProperty("publicationStatus");
    expect(queries[0].changes).not.toHaveProperty("publishedAt");
    expect(compiled(queries[0]).params).toEqual([threadId]);
  });
  it.each(["PUBLISHED", "HIDDEN", "PENDING"] as const)("guards %s moderation with SQL consent/category checks independently of status", async (publicationStatus) => {
    results.push([{ ...summary, publicationStatus, shareExperience: true }]);
    await updateThread(threadId, actor, { publicationStatus }, requestId);
    expect(compiled(queries[0]).params).toEqual([threadId, "EXPERIENCE", true]);
    expect(queries[0].changes).not.toHaveProperty("status");
    expect(compiled(queries[0]).sql).not.toContain("closed");
    if (publicationStatus === "PUBLISHED") expect(queries[0].changes).toHaveProperty("publishedAt");
  });
  it("rejects publication of nonconsenting/non-experience threads, and missing threads separately", async () => {
    results.push([], [{ id: threadId }]);
    await expect(updateThread(threadId, actor, { publicationStatus: "PUBLISHED" }, requestId)).rejects.toBeInstanceOf(ValidationError);
    results.push([], []);
    await expect(updateThread(threadId, actor, { status: "READ" }, requestId)).rejects.toBeInstanceOf(NotFoundError);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("board projection is exactly safe fields and list/count both enforce consent/category/publication", async () => {
    results.push([], [{ total: 0 }]);
    const response = await listExperienceBoard(paging);
    expect(Object.keys(queries[0].selection!)).toEqual(["id", "subject", "body", "authorName", "createdAt", "publishedAt"]);
    expect(compiled(queries[0]).params).toEqual(["EXPERIENCE", true, "PUBLISHED"]);
    expect(compiled(queries[1])).toEqual(compiled(queries[0]));
    expect(response.meta.totalPages).toBe(0);
    expect(queries[0].order).toHaveLength(2);
  });
});

describe("sapaan", () => {
  it.each([false, true])("lists only published for portal, all for admin %s", async (admin) => {
    results.push([greeting], [{ total: 1 }]);
    await listGreetings(admin, {});
    if (admin) expect(queries[0].filter).toBeUndefined();
    else {
      expect(compiled(queries[0]).params).toEqual([true]);
      expect(compiled(queries[1])).toEqual(compiled(queries[0]));
    }
    expect(Object.keys(queries[0].selection!)).toEqual(["id", "title", "body", "isPublished", "createdAt", "updatedAt"]);
  });
  it("creates and updates greetings with actor metadata and no sensitive audit content", async () => {
    const payload = { title: " Sapaan ", body: " Selamat datang ", isPublished: true };
    results.push([greeting]);
    await saveGreeting(actor, null, payload, requestId);
    expect(queries[0].table).toBe(ruangAsatidzGreetings);
    expect(values(queries[0])).toEqual({ title: "Sapaan", body: "Selamat datang", isPublished: true, createdBy: actor, updatedBy: actor });
    results.push([greeting]);
    await saveGreeting(actor, "greeting", payload, requestId);
    expect(queries[1].changes).toMatchObject({ updatedBy: actor, isPublished: true });
    expect(queries[1].changes).not.toHaveProperty("createdBy");
    expect(compiled(queries[1]).params).toEqual(["greeting"]);
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain("Selamat datang");
  });
  it("rejects missing greeting and unauthenticated admin mutations", async () => {
    const payload = { title: "Sapaan", body: "Selamat datang", isPublished: false };
    await expect(saveGreeting("", null, payload, requestId)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(updateThread(threadId, "", { status: "READ" }, requestId)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(mocks.db).not.toHaveBeenCalled();
    results.push([]);
    await expect(saveGreeting(actor, "missing", payload, requestId)).rejects.toBeInstanceOf(NotFoundError);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("rejects invalid direct-service payloads before SQL writes", async () => {
    await expect(createThread(actor, { ...input, body: " " }, requestId)).rejects.toBeInstanceOf(ValidationError);
    await expect(addReply(threadId, actor, false, { body: " " }, requestId)).rejects.toBeInstanceOf(ValidationError);
    await expect(updateThread(threadId, actor, {}, requestId)).rejects.toBeInstanceOf(ValidationError);
    expect(mocks.db).not.toHaveBeenCalled();
    expect(queries.some((q) => q.table === ruangAsatidzThreads)).toBe(false);
  });
});