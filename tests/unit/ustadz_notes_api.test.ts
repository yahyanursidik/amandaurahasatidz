import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HandlerContext, HandlerEvent } from "@netlify/functions";
import type { UserContext } from "../../netlify/functions/lib/middleware/rbac";
const mocks = vi.hoisted(() => ({ session: vi.fn(), createYtsNote: vi.fn(), getYtsNoteSummaries: vi.fn(), listYtsNotes: vi.fn(), updateYtsNote: vi.fn(),
  db: vi.fn(() => { throw new Error("Unexpected database access"); }), overview: vi.fn(), profile: vi.fn() }));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: mocks.db }));
vi.mock("../../netlify/functions/lib/services/authService", async original => ({ ...await original<typeof import("../../netlify/functions/lib/services/authService")>(), getUserSession: mocks.session }));
vi.mock("../../netlify/functions/lib/services/ustadzNotesService", async original => ({ ...await original<typeof import("../../netlify/functions/lib/services/ustadzNotesService")>(),
  createYtsNote: mocks.createYtsNote, getYtsNoteSummaries: mocks.getYtsNoteSummaries, listYtsNotes: mocks.listYtsNotes, updateYtsNote: mocks.updateYtsNote }));
vi.mock("../../netlify/functions/lib/services/portalService", async original => ({ ...await original<typeof import("../../netlify/functions/lib/services/portalService")>(), getPortalOverviewService: mocks.overview }));
vi.mock("../../netlify/functions/lib/services/ustadzService", async original => ({ ...await original<typeof import("../../netlify/functions/lib/services/ustadzService")>(), getUstadzByIdService: mocks.profile }));
import { handler } from "../../netlify/functions/api";
const profileId = "22222222-2222-4222-8222-222222222222", noteId = "33333333-3333-4333-8333-333333333333";
const actor = (roleCode: UserContext["assignments"][number]["roleCode"] = "SYSTEM_ADMIN"): UserContext => ({ userId: "11111111-1111-4111-8111-111111111111", email: "mock@example.invalid", assignments: [{ roleCode }] });
async function request(path: string, method = "GET", body?: unknown, query?: Record<string, string>) {
  const response = await handler({ rawUrl: `https://unit.invalid/api/v1${path}`, rawQuery: "", path: `/api/v1${path}`, httpMethod: method,
    headers: { authorization: "Bearer mock", "x-request-id": "yts-notes-api" }, multiValueHeaders: {}, queryStringParameters: query ?? null, multiValueQueryStringParameters: null,
    body: body === undefined ? null : JSON.stringify(body), isBase64Encoded: false } as HandlerEvent, {} as HandlerContext, vi.fn());
  if (!response || typeof response.body !== "string") throw new Error("Expected handler response");
  return { ...response, json: JSON.parse(response.body) };
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("DATABASE_URL", ""); vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network"); }));
  mocks.session.mockResolvedValue(actor()); mocks.listYtsNotes.mockResolvedValue({ data: [{ id: noteId, body: "YTS INTERNAL ONLY" }], meta: { total: 1 } });
  mocks.createYtsNote.mockResolvedValue({ id: noteId }); mocks.getYtsNoteSummaries.mockResolvedValue([{ ustadzId: profileId, activeCount: 1, flag: "RED" }]);
  mocks.overview.mockResolvedValue({ profile: { id: profileId, fullName: "Uji" }, participations: [] }); mocks.profile.mockResolvedValue({ id: profileId, fullName: "Uji" });
});
afterEach(() => { expect(mocks.db).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("YTS notes through actual API handler", () => {
  it("anonymous gets 401, including summaries", async () => {
    mocks.session.mockResolvedValue(null);
    for (const path of ["/admin/ustadz-notes/summary", `/admin/ustadz-notes/${profileId}`]) expect((await request(path)).statusCode).toBe(401);
    expect(mocks.listYtsNotes).not.toHaveBeenCalled(); expect(mocks.getYtsNoteSummaries).not.toHaveBeenCalled();
  });
  it.each(["USTADZ", "DATA_STEWARD", "EVENT_ADMIN", "COMMITTEE_LEAD", "REPORT_VIEWER"] as const)("%s cannot read flag/count/body or create note", async role => {
    mocks.session.mockResolvedValue(actor(role));
    for (const path of ["/admin/ustadz-notes/summary", `/admin/ustadz-notes/${profileId}`]) {
      const response = await request(path); expect(response.statusCode).toBe(403); expect(response.body).not.toContain("YTS INTERNAL ONLY"); expect(response.json.data).toBeNull();
    }
    expect((await request(`/admin/ustadz-notes/${profileId}`, "POST", { title: "test", body: "test", flag: "RED" })).statusCode).toBe(403);
    expect(mocks.listYtsNotes).not.toHaveBeenCalled(); expect(mocks.getYtsNoteSummaries).not.toHaveBeenCalled(); expect(mocks.createYtsNote).not.toHaveBeenCalled();
  });
  it.each(["SYSTEM_ADMIN", "SUPER_ADMIN"] as const)("global %s can read protected no-store response", async role => {
    const user = actor(role); mocks.session.mockResolvedValue(user); const response = await request(`/admin/ustadz-notes/${profileId}`);
    expect(response.statusCode).toBe(200); expect(response.json.data.data[0].body).toBe("YTS INTERNAL ONLY"); expect(response.headers?.["Cache-Control"]).toBe("no-store");
    expect(mocks.listYtsNotes).toHaveBeenCalledWith(user, profileId, {});
  });
  it("event/institution-scoped SYSTEM_ADMIN still cannot read notes", async () => {
    for (const scope of [{ eventId: profileId }, { institutionId: profileId }]) {
      const user = actor(); Object.assign(user.assignments[0], scope); mocks.session.mockResolvedValue(user);
      expect((await request(`/admin/ustadz-notes/${profileId}`)).statusCode).toBe(403);
    }
  });
  it("does not add notes to portal overview or generic ustadz profile", async () => {
    mocks.session.mockResolvedValue(actor("USTADZ")); const overview = await request("/portal/overview");
    expect(overview.statusCode).toBe(200); expect(overview.body).not.toContain("YTS INTERNAL ONLY"); expect(overview.json.data.profile).not.toHaveProperty("flag");
    mocks.session.mockResolvedValue(actor("DATA_STEWARD")); const profile = await request(`/ustadz/${profileId}`);
    expect(profile.statusCode).toBe(200); expect(profile.json.data).not.toHaveProperty("notes"); expect(profile.json.data).not.toHaveProperty("flag");
    expect(mocks.listYtsNotes).not.toHaveBeenCalled(); expect(mocks.getYtsNoteSummaries).not.toHaveBeenCalled();
  });
});