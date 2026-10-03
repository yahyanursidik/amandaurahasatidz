import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import type { UserContext } from "../../netlify/functions/lib/middleware/rbac";
import { emptyUkhuwahLocation, emptyUkhuwahReport } from "../../src/lib/ukhuwah";
const mocks = vi.hoisted(() => ({ db: vi.fn(), audit: vi.fn() }));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: mocks.db }));
vi.mock("../../netlify/functions/lib/services/auditService", () => ({ createAuditLog: mocks.audit }));
import { authorizeUkhuwah, locationDto, reportDto, listUkhuwahLocations, listUkhuwahReports, getUkhuwahReport,
  saveUkhuwahLocation, saveUkhuwahReport, submitUkhuwahReport, moderateUkhuwahReport, followupUkhuwahReport } from "../../netlify/functions/lib/services/ukhuwahService";
import { locationSchema, reportSchema, submitSchema, submissionError, listSchema } from "../../netlify/functions/lib/validations/ukhuwahValidation";
import { ukhuwahLocations, ukhuwahReports } from "../../netlify/functions/lib/db/schema";

const userId = "11111111-1111-4111-8111-111111111111", id = "22222222-2222-4222-8222-222222222222";
function actor(roleCode: UserContext["assignments"][number]["roleCode"] = "USTADZ"): UserContext {
  return { userId, name: "Ustadz Uji", email: "mock@example.invalid", assignments: [{ roleCode }] };
}
const date = new Date("2026-10-01T00:00:00Z");
const location = { ...emptyUkhuwahLocation(), id, name: "Lembaga uji", address: "Bandung", version: 2,
  officialPhone: "081234567890", picName: "PIC rahasia", picPhone: "081298765432", contactConsentSource: "Bukti rahasia",
  contactConfirmedAt: date, createdAt: date, updatedAt: date, createdBy: userId, updatedBy: userId };
const report = { ...emptyUkhuwahReport(), id, title: "Laporan uji", body: "Kebutuhan pengajar teramati.", source: "Pengamatan langsung", observedAt: "2026-10-01",
  publicationStatus: "DRAFT", workStatus: "OPEN", version: 2, authorUserId: userId, moderationReason: "Catatan rahasia", moderatedBy: null,
  followupSummary: "", coordinatorName: "", dueDate: null, createdAt: date, updatedAt: date };
type Query = { kind: string; filter?: SQL; table?: unknown; changes?: Record<string, unknown>; limitValue?: number; offsetValue?: number; [key: string]: unknown };
let queries: Query[], results: unknown[][];
function builder(kind: string, table?: unknown) {
  const q: Query = { kind, table };
  const chain = {
    from(value: unknown) { q.table = value; return chain; }, leftJoin() { return chain; },
    where(value?: SQL) { q.filter = value; return chain; }, orderBy() { return chain; },
    limit(value: number) { q.limitValue = value; return chain; }, offset(value: number) { q.offsetValue = value; return chain; },
    values(value: Record<string, unknown>) { q.changes = value; return chain; }, set(value: Record<string, unknown>) { q.changes = value; return chain; },
    returning() { return chain; }, then(resolve: (value: unknown[]) => unknown, reject: (error: unknown) => unknown) { return Promise.resolve(results.shift() ?? []).then(resolve, reject); },
  }; queries.push(q); return chain;
}
const compile = (q: Query) => new PgDialect().sqlToQuery(q.filter!);
beforeEach(() => {
  vi.clearAllMocks(); queries = []; results = [];
  mocks.db.mockReturnValue({ select: () => builder("select"), insert: (table: unknown) => builder("insert", table), update: (table: unknown) => builder("update", table) });
  mocks.audit.mockResolvedValue(undefined);
});
describe("ukhuwah validation", () => {
  it("allows incomplete drafts but forbids client publication/author assignment", () => {
    expect(reportSchema.safeParse({ ...emptyUkhuwahReport(), title: "Draf uji" }).success).toBe(true);
    for (const extra of [{ authorUserId: id }, { publicationStatus: "APPROVED" }, { workStatus: "RESOLVED" }]) expect(reportSchema.safeParse({ ...emptyUkhuwahReport(), title: "Draf uji", ...extra }).success).toBe(false);
  });
  it("locks sensitive reports and validates real dates", () => {
    expect(reportSchema.safeParse({ ...emptyUkhuwahReport(), title: "Uji sensitif", category: "SENSITIVE" }).success).toBe(false);
    expect(reportSchema.safeParse({ ...emptyUkhuwahReport(), title: "Uji sensitif", category: "SENSITIVE", audience: "ADMIN_ONLY" }).success).toBe(true);
    for (const observedAt of ["2026-02-30", "not-a-date", "2026-13-01"]) expect(reportSchema.safeParse({ ...emptyUkhuwahReport(), title: "Uji tanggal", observedAt }).success).toBe(false);
  });
  it("requires named covered Sumedang district", () => {
    for (const district of ["", "Sumedang Selatan"]) expect(reportSchema.safeParse({ ...emptyUkhuwahReport(), title: "Uji wilayah", cityCode: "3211", district }).success).toBe(false);
    expect(reportSchema.parse({ ...emptyUkhuwahReport(), title: "Uji wilayah", cityCode: "3211", district: "Kec. Jatinangor" }).district).toBe("Jatinangor");
  });
  it("requires finite operational coordinate pair and contact consent", () => {
    const input = { ...emptyUkhuwahLocation(), name: "Masjid uji", address: "Alamat uji" };
    expect(locationSchema.safeParse(input).success).toBe(true);
    for (const extra of [{ latitude: -6.9 }, { latitude: Infinity, longitude: 107 }, { latitude: 1, longitude: 107 }, { picContactShared: true }, { officialContactShared: true }]) expect(locationSchema.safeParse({ ...input, ...extra }).success).toBe(false);
    expect(locationSchema.safeParse({ ...input, picName: "PIC Uji", picPhone: "081234567890", picContactShared: true, contactConsentConfirmed: true, contactConsentSource: "Konfirmasi pemilik" }).success).toBe(true);
  });
  it("requires review confirmation and rejects placeholders and future observations", () => {
    expect(submitSchema.safeParse({ expectedVersion: 2 }).success).toBe(false);
    expect(submitSchema.safeParse({ expectedVersion: 2, reviewed: true }).success).toBe(true);
    expect(submissionError(report)).toBeNull();
    expect(submissionError({ ...report, body: "[ISI: kebutuhan]" })).toContain("Placeholder");
    expect(submissionError({ ...report, observedAt: "2099-01-01" })).toContain("masa depan");
  });
  it("bounds pagination and rejects hidden-field query injection", () => {
    for (const query of [{ page: 0 }, { pageSize: 101 }, { authorUserId: id }, { audience: "ADMIN_ONLY" }, { search: "x".repeat(121) }]) expect(listSchema.safeParse(query).success).toBe(false);
  });
});
describe("ukhuwah access and DTO privacy", () => {
  it("denies anonymous, expired and scoped administrative roles before DB", async () => {
    expect(() => authorizeUkhuwah(null, false)).toThrow();
    for (const user of [actor("EVENT_ADMIN"), { ...actor("SYSTEM_ADMIN"), assignments: [{ roleCode: "SYSTEM_ADMIN" as const, eventId: id }] }, { ...actor("SUPER_ADMIN"), assignments: [{ roleCode: "SUPER_ADMIN" as const, institutionId: id }] }, { ...actor(), assignments: [{ roleCode: "USTADZ" as const, endsAt: new Date("2000-01-01") }] }]) {
      await expect(listUkhuwahLocations(user, true, {})).rejects.toMatchObject({ statusCode: 403 });
    }
    await expect(listUkhuwahReports(actor("EVENT_VIEWER"), false, {})).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("omits private contact, owner identifiers and consent evidence from member DTO", () => {
    const result = locationDto(location, false);
    for (const key of ["officialPhone", "picName", "picPhone", "createdBy", "updatedBy", "contactConsentSource", "contactConfirmedAt"]) expect(result).not.toHaveProperty(key);
    expect(JSON.stringify(result)).not.toContain("rahasia");
    expect(locationDto({ ...location, contactConsentConfirmed: true, officialContactShared: true }, false)).toHaveProperty("officialPhone");
    expect(locationDto({ ...location, contactConsentConfirmed: true, picContactShared: true }, false)).toHaveProperty("picName");
    expect(locationDto({ ...location, contactConsentConfirmed: false, picContactShared: true }, false)).not.toHaveProperty("picPhone");
  });
  it("hides authors and moderation data, and obscures unpublished location references", () => {
    const result = reportDto({ ...report, hideAuthor: true, locationId: id }, "Secret author", id, false, false);
    expect(result).toMatchObject({ authorName: null, isOwner: false, locationId: null });
    expect(result).not.toHaveProperty("authorUserId"); expect(result).not.toHaveProperty("moderationReason"); expect(result).not.toHaveProperty("moderatedBy");
    expect(reportDto(report, "Owner", userId, false)).toHaveProperty("moderationReason");
  });
  it("filters location list and count by publication before pagination and avoids contact search", async () => {
    results.push([location], [{ total: 5 }]);
    const response = await listUkhuwahLocations(actor(), false, { page: 2, pageSize: 2, search: "private%" });
    expect(response.meta).toMatchObject({ total: 5, totalPages: 3 });
    expect(compile(queries[0])).toEqual(compile(queries[1]));
    expect(compile(queries[0]).params).toContain(true); expect(compile(queries[0]).sql).not.toContain("pic_phone");
    expect(queries[0]).toMatchObject({ offsetValue: 2, limitValue: 2 });
  });
  it("filters shared list AND count to approved SHARED only", async () => {
    results.push([{ row: report, authorName: "Uji", locationPublished: false }], [{ total: 1 }]);
    await listUkhuwahReports(actor(), false, {});
    expect(compile(queries[0]).params).toEqual(["SHARED", "APPROVED"]);
    expect(compile(queries[0])).toEqual(compile(queries[1]));
  });
  it("scopes my reports independently and foreign private detail returns 404", async () => {
    results.push([], [{ total: 0 }]); await listUkhuwahReports(actor(), false, { mine: "true" });
    expect(compile(queries[0]).params).toEqual([userId]);
    results.push([]); await expect(getUkhuwahReport(actor(), false, id)).rejects.toMatchObject({ statusCode: 404 });
    expect(compile(queries[2]).params).toEqual([id, userId, "SHARED", "APPROVED"]);
  });
});
describe("ukhuwah mutations and concurrency", () => {
  it("saves drafts only as owner and drops prior publication on any edit", async () => {
    results.push([report]); await saveUkhuwahReport(actor(), false, id, { ...emptyUkhuwahReport(), title: "Edit draf", expectedVersion: 2 }, "test");
    expect(queries[0].table).toBe(ukhuwahReports);
    expect(queries[0].changes).toMatchObject({ publicationStatus: "DRAFT", moderationReason: null });
    expect(compile(queries[0]).params).toEqual([id, userId, 2, "PENDING"]);
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain("Kebutuhan pengajar");
  });
  it("rejects stale edit without logging success", async () => {
    results.push([]); await expect(saveUkhuwahReport(actor(), false, id, { ...emptyUkhuwahReport(), title: "Edit draf", expectedVersion: 1 }, "test")).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("submits owner saved revision and rejects unresolved placeholder before mutation", async () => {
    results.push([{ ...report, body: "[ISI: rincian]" }]);
    await expect(submitUkhuwahReport(actor(), false, id, { expectedVersion: 2, reviewed: true }, "test")).rejects.toMatchObject({ statusCode: 422 });
    expect(queries).toHaveLength(1);
    results.push([report], [{ ...report, publicationStatus: "PENDING", version: 3 }], [{ row: { ...report, publicationStatus: "PENDING", version: 3 }, authorName: "Uji", locationPublished: null }]);
    expect(await submitUkhuwahReport(actor(), false, id, { expectedVersion: 2, reviewed: true }, "test")).toMatchObject({ publicationStatus: "PENDING", version: 3 });
    expect(compile(queries[2]).params).toEqual([id, userId, 2, "DRAFT"]);
  });
  it("denies self approval and nonpending approval", async () => {
    results.push([{ ...report, publicationStatus: "PENDING" }]);
    await expect(moderateUkhuwahReport(actor("SYSTEM_ADMIN"), id, { expectedVersion: 2, decision: "APPROVED", reason: "Ditinjau" }, "test")).rejects.toMatchObject({ statusCode: 403 });
    results.push([report]);
    await expect(moderateUkhuwahReport(actor("SYSTEM_ADMIN"), id, { expectedVersion: 2, decision: "APPROVED", reason: "Ditinjau" }, "test")).rejects.toMatchObject({ statusCode: 409 });
    expect(queries.every(q => q.kind === "select")).toBe(true);
  });
  it("approval preserves ADMIN_ONLY audience", async () => {
    const privateReport = { ...report, authorUserId: id, audience: "ADMIN_ONLY", publicationStatus: "PENDING" };
    results.push([privateReport], [{ ...privateReport, publicationStatus: "APPROVED", version: 3 }], [{ row: { ...privateReport, publicationStatus: "APPROVED", version: 3 }, authorName: "Uji", locationPublished: null }]);
    const result = await moderateUkhuwahReport(actor("SYSTEM_ADMIN"), id, { expectedVersion: 2, decision: "APPROVED", reason: "Sudah ditinjau" }, "test");
    expect(result.audience).toBe("ADMIN_ONLY"); expect(queries[1].changes).not.toHaveProperty("audience");
  });
  it("followup and location updates use atomic version predicates", async () => {
    results.push([]); await expect(followupUkhuwahReport(actor("SYSTEM_ADMIN"), id, { expectedVersion: 2, workStatus: "RESOLVED", followupSummary: "Selesai", coordinatorName: "Uji", dueDate: null }, "test")).rejects.toMatchObject({ statusCode: 409 });
    expect(compile(queries[0]).params).toEqual([id, 2]);
    results.push([location]); await saveUkhuwahLocation(actor("SYSTEM_ADMIN"), id, { ...emptyUkhuwahLocation(), name: "Lembaga uji", address: "Bandung", expectedVersion: 2 }, "test");
    expect(queries[1].table).toBe(ukhuwahLocations); expect(compile(queries[1]).params).toEqual([id, 2]);
    expect(queries[1].changes).toMatchObject({ contactConfirmedAt: null });
  });
});