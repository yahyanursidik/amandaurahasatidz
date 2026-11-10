import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HandlerContext, HandlerEvent } from "@netlify/functions";
const mocks = vi.hoisted(() => ({ session: vi.fn(), page: vi.fn(), legacy: vi.fn(), settings: vi.fn(), options: vi.fn(), programs: vi.fn(), policy: vi.fn() }));
vi.mock("../../netlify/functions/lib/services/authService", async (original) => ({ ...await original<typeof import("../../netlify/functions/lib/services/authService")>(), getUserSession: mocks.session }));
vi.mock("../../netlify/functions/lib/services/participantService", async (original) => ({ ...await original<typeof import("../../netlify/functions/lib/services/participantService")>(), getParticipantPageService: mocks.page, getParticipantsService: mocks.legacy }));
vi.mock("../../netlify/functions/lib/services/eventService", async (original) => ({ ...await original<typeof import("../../netlify/functions/lib/services/eventService")>(), getRegistrationEventService: mocks.settings, getEventOptionsService: mocks.options, getPublicEventsService: mocks.programs }));
vi.mock("../../netlify/functions/lib/services/invitationService", async (original) => ({ ...await original<typeof import("../../netlify/functions/lib/services/invitationService")>(), getPublicInvitationPolicyService: mocks.policy }));
import { handler } from "../../netlify/functions/api";
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("DATABASE_URL", "");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network disabled in API unit tests"); }));
  mocks.session.mockResolvedValue({ userId: id, email: "audit@example.invalid", assignments: [{ roleCode: "REPORT_VIEWER" }] });
  mocks.page.mockResolvedValue({ data: [{ id }], meta: { total: 55, page: 2, pageSize: 25, pageCount: 3 } });
  mocks.legacy.mockResolvedValue([]); mocks.settings.mockResolvedValue({ id, name: "Audit" });
  mocks.options.mockResolvedValue([{ id, name: "Audit" }]);
  mocks.programs.mockResolvedValue({ data: [], meta: { total: 0, page: 1, pageSize: 3, pageCount: 1 } });
  mocks.policy.mockResolvedValue({ quota: 2, allowGroup: true });
});
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
async function get(path: string, query: Record<string, string> = {}) {
  const response = await handler({ path: `/api/v1${path}`, httpMethod: "GET", headers: { "x-request-id": "performance-api" },
    queryStringParameters: query, multiValueHeaders: {}, multiValueQueryStringParameters: {}, rawUrl: `https://example.invalid/api/v1${path}`, rawQuery: "", body: null, isBase64Encoded: false,
  } as HandlerEvent, {} as HandlerContext, vi.fn());
  if (!response || typeof response.body !== "string") throw new Error("JSON response expected");
  return { ...response, json: JSON.parse(response.body) };
}
describe("performance read API preserves authorization", () => {
  it("lets REPORT_VIEWER read a bounded participant page and settings without invitation privileges", async () => {
    const response = await get(`/events/${id}/participants`, { page: "2", pageSize: "25" });
    expect(response.statusCode).toBe(200); expect(response.json.meta).toMatchObject({ total: 55, page: 2 });
    expect(mocks.page).toHaveBeenCalledExactlyOnceWith(id, expect.objectContaining({ page: 2, pageSize: 25, projection: "full" }));
    expect((await get(`/events/${id}/registration-settings`)).statusCode).toBe(200);
    expect((await get(`/events/${id}/invitations`)).statusCode).toBe(403);
    expect((await get(`/events/${id}/invitations/institutions`)).statusCode).toBe(403);
  });
  it("keeps older list callers compatible and rejects invalid page inputs", async () => {
    expect((await get(`/events/${id}/participants`)).statusCode).toBe(200); expect(mocks.legacy).toHaveBeenCalledWith(id);
    expect((await get(`/events/${id}/participants`, { pageSize: "100000" })).statusCode).toBe(422);
    expect(mocks.page).not.toHaveBeenCalled();
  });
  it("requires event read permission for the narrow event picker", async () => {
    expect((await get("/events/options")).json.data).toEqual([{ id, name: "Audit" }]);
    mocks.session.mockResolvedValue({ userId: id, assignments: [{ roleCode: "DATA_STEWARD" }] });
    expect((await get("/events/options")).statusCode).toBe(403);
    mocks.session.mockResolvedValue(null);
    expect((await get("/events/options")).statusCode).toBe(401);
    expect(mocks.options).toHaveBeenCalledTimes(1);
  });
  it.each(["USTADZ", "INSTITUTION_REPRESENTATIVE"])("does not grant staff participant reads to %s", async (roleCode) => {
    mocks.session.mockResolvedValue({ userId: id, email: "audit@example.invalid", assignments: [{ roleCode, eventId: id }] });
    expect((await get(`/events/${id}/participants`, { page: "1" })).statusCode).toBe(403); expect(mocks.page).not.toHaveBeenCalled();
  });
  it("enforces event scope on both paginated reads and settings", async () => {
    mocks.session.mockResolvedValue({ userId: id, email: "audit@example.invalid", assignments: [{ roleCode: "EVENT_ADMIN", eventId: "22222222-2222-4222-8222-222222222222" }] });
    expect((await get(`/events/${id}/participants`, { page: "1" })).statusCode).toBe(403);
    expect((await get(`/events/${id}/registration-settings`)).statusCode).toBe(403);
  });
  it("returns public catalog metadata without resolving a staff session", async () => {
    const response = await get("/events/public", { view: "featured", pageSize: "3" });
    expect(response.statusCode).toBe(200); expect(response.json.meta.pageSize).toBe(3); expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.programs).toHaveBeenCalledWith(expect.objectContaining({ view: "featured", pageSize: 3 }));
  });
  it("provides uncached policy revalidation on the token route, without session access", async () => {
    const response = await get("/invitations/public/institution/inv_inst_fixture/policy");
    expect(response.statusCode).toBe(200); expect(response.headers).toMatchObject({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    expect(mocks.policy).toHaveBeenCalledWith("inv_inst_fixture", "institution"); expect(mocks.session).not.toHaveBeenCalled();
  });
});
