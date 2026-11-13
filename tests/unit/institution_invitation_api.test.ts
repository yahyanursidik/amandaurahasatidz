import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HandlerContext, HandlerEvent } from "@netlify/functions";
import type { UserContext } from "../../netlify/functions/lib/middleware/rbac";
import type { RoleCode } from "../../src/config/permissions";

const mocks = vi.hoisted(() => ({ session: vi.fn(), edit: vi.fn(), options: vi.fn(), ustadzOptions: vi.fn(), list: vi.fn(), send: vi.fn(), revoke: vi.fn(), regenerate: vi.fn(), accessCode: vi.fn(), audit: vi.fn() }));
vi.mock("../../netlify/functions/lib/services/authService", async (original) => ({
  ...await original<typeof import("../../netlify/functions/lib/services/authService")>(), getUserSession: mocks.session,
}));
vi.mock("../../netlify/functions/lib/services/invitationService", () => ({
  editInvitationService: mocks.edit, getInvitationInstitutionsService: mocks.options, getInvitationsService: mocks.list,
  getInvitationUstadzOptionsService: mocks.ustadzOptions,
  sendInvitationService: mocks.send, revokeInvitationService: mocks.revoke, regenerateInvitationLinkService: mocks.regenerate,
  getInstitutionInvitationAccessCodeService: mocks.accessCode,
}));
vi.mock("../../netlify/functions/lib/services/auditService", () => ({ createAuditLog: mocks.audit }));
import { handler } from "../../netlify/functions/api";
const eventId = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
const actorId = "33333333-3333-4333-8333-333333333333";
const root = `/events/${eventId}/invitations`;
function actor(role: RoleCode = "EVENT_ADMIN", scope: string | null = eventId): UserContext {
  return { userId: actorId, email: "test@example.invalid", assignments: [{ roleCode: role, eventId: scope }] };
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.session.mockResolvedValue(actor());
  mocks.edit.mockResolvedValue({ invitation: { id, quota: 1, allowGroup: false } });
  mocks.options.mockResolvedValue([]); mocks.ustadzOptions.mockResolvedValue([]); mocks.list.mockResolvedValue([]);
  mocks.accessCode.mockResolvedValue({ invitationId: id, accessCode: "ABCD-2345" });
  vi.stubEnv("DATABASE_URL", "");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network disabled in invitation API tests"); }));
});
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
async function request(method: string, suffix = "", body?: unknown, query?: Record<string, string>) {
  const response = await handler({ path: `/api/v1${root}${suffix}`, rawUrl: `https://example.invalid/api/v1${root}${suffix}`,
    httpMethod: method, headers: { "x-request-id": "invitation-api-test" }, body: body === undefined ? null : JSON.stringify(body),
    queryStringParameters: query || {}, multiValueHeaders: {}, multiValueQueryStringParameters: {}, rawQuery: "", isBase64Encoded: false,
  } as HandlerEvent, {} as HandlerContext, vi.fn());
  if (!response || typeof response.body !== "string") throw new Error("JSON response expected");
  return { ...response, json: JSON.parse(response.body) };
}

describe("API undangan lembaga (handler dan RBAC sebenarnya)", () => {
  it("mengambil daftar biasa tanpa kode atau audit akses kode", async () => {
    expect((await request("GET")).statusCode).toBe(200);
    expect(mocks.list).toHaveBeenCalledExactlyOnceWith(eventId);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("mengambil kode lembaga bersamaan daftar hanya untuk pengelola dan mencatat audit", async () => {
    mocks.list.mockResolvedValueOnce([{ id, invitationType: "INSTITUTION", accessCode: "ABCD-2345" }]);
    const response = await request("GET", "", undefined, { includeAccessCodes: "true" });
    expect(response.statusCode).toBe(200);
    expect(response.json.data).toEqual([{ id, invitationType: "INSTITUTION", accessCode: "ABCD-2345" }]);
    expect(mocks.list).toHaveBeenCalledExactlyOnceWith(eventId, true);
    expect(mocks.audit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      actorUserId: actorId, eventId, action: "INVITATION_ACCESS_CODES_VIEWED", requestId: "invitation-api-test",
    }));
  });
  it("menjaga izin baca daftar biasa tanpa memberi kode kepada petugas baca", async () => {
    mocks.session.mockResolvedValue(actor("COMMITTEE_ADMIN"));
    expect((await request("GET")).statusCode).toBe(200);
    mocks.list.mockClear();
    expect((await request("GET", "", undefined, { includeAccessCodes: "true" })).statusCode).toBe(403);
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("menolak pemuatan kode massal lintas event", async () => {
    mocks.session.mockResolvedValue(actor("EVENT_ADMIN", id));
    expect((await request("GET", "", undefined, { includeAccessCodes: "true" })).statusCode).toBe(403);
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("memuat kembali kode lembaga untuk pengelola undangan tanpa membuat tautan baru", async () => {
    const response = await request("GET", `/${id}/access-code`);
    expect(response.statusCode).toBe(200);
    expect(response.json.data).toEqual({ invitationId: id, accessCode: "ABCD-2345" });
    expect(mocks.accessCode).toHaveBeenCalledExactlyOnceWith(eventId, id, actorId, "invitation-api-test");
    expect(mocks.regenerate).not.toHaveBeenCalled();
  });
  it.each([null, "USTADZ", "INSTITUTION_REPRESENTATIVE", "REPORT_VIEWER", "COMMITTEE_ADMIN"] as const)("tidak membocorkan kode unik ke %s", async (role) => {
    mocks.session.mockResolvedValue(role ? actor(role) : null);
    expect((await request("GET", `/${id}/access-code`)).statusCode).toBe(role ? 403 : 401);
    expect(mocks.accessCode).not.toHaveBeenCalled();
  });
  it("menolak akses kode untuk admin event lain", async () => {
    mocks.session.mockResolvedValue(actor("EVENT_ADMIN", id));
    expect((await request("GET", `/${id}/access-code`)).statusCode).toBe(403);
    expect(mocks.accessCode).not.toHaveBeenCalled();
  });
  it("meneruskan event dari URL, ID undangan, payload, dan aktor pada PATCH", async () => {
    expect((await request("PATCH", `/${id}`, { allowGroup: false })).statusCode).toBe(200);
    expect(mocks.edit).toHaveBeenCalledExactlyOnceWith(eventId, id, { allowGroup: false }, actorId, "invitation-api-test");
  });
  it.each([null, "USTADZ", "INSTITUTION_REPRESENTATIVE", "REPORT_VIEWER"] as const)("menolak edit dan picker untuk %s", async (role) => {
    mocks.session.mockResolvedValue(role ? actor(role) : null);
    expect((await request("PATCH", `/${id}`, { quota: 3 })).statusCode).toBe(role ? 403 : 401);
    expect((await request("GET", "/institutions")).statusCode).toBe(role ? 403 : 401);
    expect((await request("GET", "/ustadz")).statusCode).toBe(role ? 403 : 401);
    expect(mocks.edit).not.toHaveBeenCalled(); expect(mocks.options).not.toHaveBeenCalled(); expect(mocks.ustadzOptions).not.toHaveBeenCalled();
  });
  it("tidak mensyaratkan akses direktori global bagi admin event untuk mengambil pilihan lembaga", async () => {
    expect((await request("GET", "/institutions")).statusCode).toBe(200);
    expect(mocks.options).toHaveBeenCalledExactlyOnceWith(eventId, 1, 100);
  });
  it("memberikan picker asatidz terlingkup event dan memvalidasi pencarian", async () => {
    expect((await request("GET", "/ustadz", undefined, { search: "Ustadz", page: "2" })).statusCode).toBe(200);
    expect(mocks.ustadzOptions).toHaveBeenCalledExactlyOnceWith(eventId, "Ustadz", 2, 20);
    expect((await request("GET", "/ustadz", undefined, { pageSize: "1000" })).statusCode).toBe(422);
  });
  it("memvalidasi pagination picker dan payload edit", async () => {
    expect((await request("GET", "/institutions", undefined, { pageSize: "1000" })).statusCode).toBe(422);
    expect((await request("PATCH", `/${id}`, { status: "ACCEPTED", quota: 1 })).statusCode).toBe(422);
    expect((await request("PATCH", `/${id}`, { quota: 1.5 })).statusCode).toBe(422);
    expect(mocks.edit).not.toHaveBeenCalled(); expect(mocks.options).not.toHaveBeenCalled();
  });
  it.each([null, id])("menolak admin tanpa penugasan event yang sesuai (%s)", async (scope) => {
    mocks.session.mockResolvedValue(actor("EVENT_ADMIN", scope));
    expect((await request("PATCH", `/${id}`, { quota: 3 })).statusCode).toBe(403);
    expect((await request("GET", "/institutions")).statusCode).toBe(403);
    expect((await request("GET", "/ustadz")).statusCode).toBe(403);
  });
  it.each([["send", "send"], ["revoke", "revoke"], ["regenerate-link", "regenerate"]] as const)("mengirim scope event ke aksi %s", async (path, key) => {
    expect((await request("POST", `/${id}/${path}`)).statusCode).toBe(200);
    expect(mocks[key]).toHaveBeenCalledExactlyOnceWith(eventId, id, actorId, "invitation-api-test");
  });
  it("daftar admin tidak bocor ke perwakilan lembaga", async () => {
    mocks.session.mockResolvedValue(actor("INSTITUTION_REPRESENTATIVE"));
    expect((await request("GET")).statusCode).toBe(403); expect(mocks.list).not.toHaveBeenCalled();
    mocks.session.mockResolvedValue({ ...actor("INSTITUTION_REPRESENTATIVE"), assignments: [
      { roleCode: "INSTITUTION_REPRESENTATIVE", eventId }, { roleCode: "EVENT_ADMIN", eventId },
    ] });
    expect((await request("GET")).statusCode).toBe(200);
  });
});
