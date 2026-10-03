import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import type { UserContext } from "../../netlify/functions/lib/middleware/rbac";
const mocks = vi.hoisted(() => ({ db: vi.fn(), audit: vi.fn(), execute: vi.fn() }));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: mocks.db }));
vi.mock("../../netlify/functions/lib/services/auditService", () => ({ createAuditLog: mocks.audit }));
import { createYtsNote, getYtsNoteSummaries, listYtsNotes, requireYtsNotes, updateYtsNote, ytsNoteProfileScope } from "../../netlify/functions/lib/services/ustadzNotesService";
import { parseYtsNotes, ytsNoteArchive, ytsNoteCreate, ytsNoteList, ytsNoteSummaryQuery, ytsNoteUpdate } from "../../netlify/functions/lib/validations/ustadzNotesValidation";
import { ustadzYtsNotes } from "../../netlify/functions/lib/db/schema";

const userId = "11111111-1111-4111-8111-111111111111", profileId = "22222222-2222-4222-8222-222222222222", noteId = "33333333-3333-4333-8333-333333333333";
const actor = (roleCode: UserContext["assignments"][number]["roleCode"] = "SYSTEM_ADMIN"): UserContext => ({ userId, email: "test@example.invalid", assignments: [{ roleCode }] });
const input = { title: "Catatan privat", body: "Isi internal rahasia untuk koordinasi.", flag: "RED" };
const profile = { id: profileId, deletedAt: null, mergedIntoId: null };
const note = { id: noteId, ustadzId: profileId, ...input, version: 2, createdByName: "YTS", updatedByName: "YTS", archivedAt: null };
type Query = { kind: string; table?: unknown; filter?: SQL; selection?: Record<string, unknown>; changes?: Record<string, unknown>; offset?: number; limit?: number };
let queries: Query[], results: unknown[][];
function builder(kind: string, table?: unknown, selection?: Record<string, unknown>) {
  const q: Query = { kind, table, selection };
  const chain = {
    from(t: unknown) { q.table = t; return chain; }, leftJoin() { return chain; }, innerJoin() { return chain; },
    where(filter: SQL) { q.filter = filter; return chain; }, orderBy() { return chain; },
    limit(value: number) { q.limit = value; return chain; }, offset(value: number) { q.offset = value; return chain; },
    set(changes: Record<string, unknown>) { q.changes = changes; return chain; }, values(changes: Record<string, unknown>) { q.changes = changes; return chain; },
    returning() { return chain; }, then(resolve: (data: unknown[]) => unknown, reject: (error: unknown) => unknown) { return Promise.resolve(results.shift() ?? []).then(resolve, reject); },
  }; queries.push(q); return chain;
}
const compiled = (value: SQL) => new PgDialect().sqlToQuery(value);
beforeEach(() => {
  vi.clearAllMocks(); queries = []; results = [];
  mocks.db.mockReturnValue({ select: (fields: Record<string, unknown>) => builder("select", undefined, fields), insert: (table: unknown) => builder("insert", table), update: (table: unknown) => builder("update", table), execute: mocks.execute });
  mocks.audit.mockResolvedValue(undefined);
});
describe("YTS notes strict input validation", () => {
  it("trims text and permits all four explicit flags", () => {
    for (const flag of ["BLUE", "YELLOW", "RED", "GREEN"]) expect(parseYtsNotes(ytsNoteCreate, { ...input, title: "  Catatan  ", flag })).toMatchObject({ title: "Catatan", flag });
  });
  it.each([{ title: " " }, { body: "x" }, { flag: "BLACK" }, { title: "x".repeat(201) }, { body: "x".repeat(10001) }, { ustadzId: profileId }, { createdBy: userId }, { archivedAt: "2026-01-01" }])("rejects invalid/privileged field %j", extra => expect(ytsNoteCreate.safeParse({ ...input, ...extra }).success).toBe(false));
  it("requires exact positive revision and boolean archive state", () => {
    for (const expectedVersion of [0, -1, "2", 1.5, 2147483647]) expect(ytsNoteUpdate.safeParse({ ...input, expectedVersion }).success).toBe(false);
    expect(ytsNoteArchive.safeParse({ expectedVersion: 2, archived: "true" }).success).toBe(false);
    expect(ytsNoteUpdate.safeParse({ ...input, expectedVersion: 2, updatedBy: userId }).success).toBe(false);
  });
  it("limits list and batch inputs without allowing note text search", () => {
    expect(ytsNoteList.parse({})).toEqual({ page: 1, pageSize: 20, archived: "false" });
    for (const query of [{ page: 0 }, { pageSize: 51 }, { archived: "yes" }, { search: "secret" }]) expect(ytsNoteList.safeParse(query).success).toBe(false);
    for (const ids of ["", "not-a-uuid", Array(51).fill(profileId).join(",")]) expect(ytsNoteSummaryQuery.safeParse({ ids }).success).toBe(false);
  });
});
describe("YTS note privacy and scoped authorization", () => {
  it("requires authentication before touching the database", async () => {
    expect(() => requireYtsNotes(null)).toThrow(); await expect(listYtsNotes(null, profileId, {})).rejects.toMatchObject({ statusCode: 401 }); expect(mocks.db).not.toHaveBeenCalled();
  });
  it.each(["USTADZ", "DATA_STEWARD", "EVENT_ADMIN", "COMMITTEE_LEAD", "REPORT_VIEWER"] as const)("rejects %s for all note operations", async role => {
    const user = actor(role);
    await expect(getYtsNoteSummaries(user, { ids: profileId })).rejects.toMatchObject({ statusCode: 403 });
    await expect(listYtsNotes(user, profileId, {})).rejects.toMatchObject({ statusCode: 403 });
    await expect(createYtsNote(user, profileId, input, "test")).rejects.toMatchObject({ statusCode: 403 });
    await expect(updateYtsNote(user, profileId, noteId, { ...input, expectedVersion: 2 }, "test")).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("denies scoped, future, expired and invalid dated assignments", () => {
    for (const extra of [{ eventId: profileId }, { institutionId: profileId }, { startsAt: new Date("2099-01-01") }, { endsAt: new Date("2000-01-01") }, { endsAt: new Date("invalid") }]) {
      const user = actor(); Object.assign(user.assignments[0], extra); expect(() => requireYtsNotes(user)).toThrow();
    }
    expect(requireYtsNotes(actor("SUPER_ADMIN"))).toMatchObject({ userId });
  });
  it("batch summary only returns flag/count, deduplicates ids and ignores archived notes", async () => {
    mocks.execute.mockResolvedValue({ rows: [{ ustadz_id: profileId, active_count: 2, priority: 4, body: "SHOULD NOT LEAK" }, { ustadz_id: noteId, active_count: 0, priority: 0 }] });
    const response = await getYtsNoteSummaries(actor(), { ids: `${profileId},${profileId},${noteId}` });
    expect(response).toEqual([{ ustadzId: profileId, activeCount: 2, flag: "RED" }, { ustadzId: noteId, activeCount: 0, flag: null }]);
    const query = compiled(mocks.execute.mock.calls[0][0]); expect(query.params).toEqual([profileId, noteId]); expect(query.sql).toContain("n.archived_at IS NULL"); expect(query.sql).not.toContain("n.body");
  });
  it("lists/counts only matching profile graph, archive and flag before pagination", async () => {
    results.push([profile], [note], [{ total: 3 }]);
    const response = await listYtsNotes(actor(), profileId, { page: 2, pageSize: 2, flag: "RED" });
    expect(response.meta).toMatchObject({ total: 3, totalPages: 2 });
    expect(compiled(queries[1].filter!)).toEqual(compiled(queries[2].filter!));
    expect(compiled(queries[1].filter!).params).toEqual([profileId, "RED"]);
    expect(compiled(queries[1].filter!).sql).toContain('"archived_at" is null'); expect(queries[1]).toMatchObject({ limit: 2, offset: 2 });
    expect(queries[1].selection).not.toHaveProperty("createdBy"); expect(queries[1].selection).not.toHaveProperty("email");
  });
  it("merged notes retain original attribution and cycle-safe UNION scope", () => {
    const query = compiled(ytsNoteProfileScope(profileId)); expect(query.params).toEqual([profileId]); expect(query.sql).toContain("p.merged_into_id = r.id"); expect(query.sql).not.toContain("UNION ALL");
    expect(query.sql).toMatch(/^\(WITH RECURSIVE/); expect(query.sql).toMatch(/SELECT id FROM related\)$/);
  });
});
describe("YTS note mutation lifecycle", () => {
  it("creates attributed notes without sensitive data in general audit log", async () => {
    results.push([profile], [{ id: noteId, version: 1 }], [note]);
    expect(await createYtsNote(actor(), profileId, input, "test")).toEqual(note);
    expect(queries[1]).toMatchObject({ table: ustadzYtsNotes, changes: { ...input, ustadzId: profileId, createdBy: userId, updatedBy: userId } });
    const audit = mocks.audit.mock.calls[0][0]; expect(audit.afterData).toEqual({ version: 1 }); expect(JSON.stringify(audit)).not.toContain("rahasia"); expect(audit).not.toHaveProperty("body");
  });
  it("refuses adding notes to nonexistent or merged profiles", async () => {
    results.push([]); await expect(createYtsNote(actor(), profileId, input, "test")).rejects.toMatchObject({ statusCode: 404 });
    results.push([{ ...profile, mergedIntoId: noteId }]); await expect(createYtsNote(actor(), profileId, input, "test")).rejects.toMatchObject({ statusCode: 409 });
    expect(queries.every(q => q.kind === "select")).toBe(true);
  });
  it.each([false, true])("atomic revision prevents foreign/stale %s archive update", async archive => {
    results.push([]);
    await expect(updateYtsNote(actor(), profileId, noteId, archive ? { expectedVersion: 2, archived: true } : { ...input, expectedVersion: 2 }, "test", archive)).rejects.toMatchObject({ statusCode: 409 });
    expect(compiled(queries[0].filter!).params).toEqual([noteId, profileId, 2]); expect(compiled(queries[0].filter!).sql).toContain('"archived_at" is null'); expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("archives and restores without deleting text or changing profile status", async () => {
    for (const archived of [true, false]) {
      results.push([{ id: noteId, version: 3 }], [note]);
      await updateYtsNote(actor(), profileId, noteId, { expectedVersion: 2, archived }, "test", true);
    }
    expect(queries[0].changes?.archivedAt).toBeInstanceOf(Date); expect(queries[2].changes?.archivedAt).toBeNull();
    expect(queries[2].changes).not.toHaveProperty("body"); expect(queries[2].changes).not.toHaveProperty("profileStatus");
    expect(compiled(queries[2].filter!).sql).toContain('"archived_at" is not null');
    expect(mocks.audit.mock.calls.map(call => call[0].action)).toEqual(["YTS_NOTE_ARCHIVED", "YTS_NOTE_RESTORED"]);
  });
  it("edits only an active revision and preserves original creator", async () => {
    results.push([{ id: noteId, version: 3 }], [note]); await updateYtsNote(actor(), profileId, noteId, { ...input, flag: "GREEN", expectedVersion: 2 }, "test");
    expect(queries[0].changes).toMatchObject({ flag: "GREEN", updatedBy: userId }); expect(queries[0].changes).not.toHaveProperty("createdBy"); expect(queries[0].changes).not.toHaveProperty("ustadzId");
  });
});