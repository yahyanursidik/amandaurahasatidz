import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HandlerContext, HandlerEvent } from "@netlify/functions";
import type { RoleCode } from "../../src/config/permissions";
const mocks = vi.hoisted(() => ({ session: vi.fn(), waitlist: vi.fn(), decline: vi.fn(), cancel: vi.fn(), replace: vi.fn(), status: vi.fn(), options: vi.fn(), list: vi.fn() }));
vi.mock("../../netlify/functions/lib/services/authService", async (original) => ({
  ...await original<typeof import("../../netlify/functions/lib/services/authService")>(), getUserSession: mocks.session,
}));
vi.mock("../../netlify/functions/lib/services/participantService", () => ({
  waitlistParticipantService: mocks.waitlist, declineParticipantService: mocks.decline, cancelParticipantService: mocks.cancel,
  replaceParticipantService: mocks.replace, updateParticipantStatusService: mocks.status, getParticipantReplacementOptionsService: mocks.options,
  getParticipantsService: mocks.list,
}));
import { handler } from "../../netlify/functions/api";
const eventId = "11111111-1111-4111-8111-111111111111", id = "22222222-2222-4222-8222-222222222222";
const actorId = "33333333-3333-4333-8333-333333333333", replacement = "44444444-4444-4444-8444-444444444444";
const root = `/events/${eventId}/participants/${id}`;
const actor = (roleCode: RoleCode = "EVENT_ADMIN", scope: string | null = eventId) => ({ userId: actorId, email: "qa@example.invalid", assignments: [{ roleCode, eventId: scope }] });
beforeEach(() => {
  vi.clearAllMocks(); mocks.session.mockResolvedValue(actor());
  for (const key of ["waitlist", "decline", "cancel", "replace", "status", "options", "list"] as const) mocks[key].mockResolvedValue({ id });
  vi.stubEnv("DATABASE_URL", ""); vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network disabled in API unit tests"); }));
});
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
async function request(suffix: string, method = "POST", body: unknown = { reason: "  Alasan perubahan  " }, search = "Ahmad") {
  const response = await handler({ path: `/api/v1${root}/${suffix}`, rawUrl: `https://example.invalid/api/v1${root}/${suffix}`, httpMethod: method,
    headers: { "x-request-id": "participant-command-test" }, body: body === undefined ? null : JSON.stringify(body),
    queryStringParameters: { search }, rawQuery: "", multiValueHeaders: {}, multiValueQueryStringParameters: {}, isBase64Encoded: false,
  } as HandlerEvent, {} as HandlerContext, vi.fn());
  if (!response || typeof response.body !== "string") throw new Error("JSON response expected");
  return { ...response, json: JSON.parse(response.body) };
}

describe("endpoint command peserta", () => {
  it.each(["waitlist", "decline", "cancel"] as const)("meneruskan event, aktor dan alasan bersih pada %s", async (action) => {
    expect((await request(action)).statusCode).toBe(200);
    expect(mocks[action]).toHaveBeenCalledExactlyOnceWith(id, "Alasan perubahan", actorId, "participant-command-test", eventId);
  });
  it("penggantian memakai peserta lama dari URL, bukan identitas yang disisipkan browser", async () => {
    expect((await request("replace", "POST", { newUstadzId: replacement, oldParticipantId: replacement, reason: "Pergantian delegasi" })).statusCode).toBe(200);
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(id, replacement, "Pergantian delegasi", actorId, "participant-command-test", eventId);
  });
  it("picker pengganti terbatas izin penggantian pada event", async () => {
    expect((await request("replacement-options", "GET")).statusCode).toBe(200);
    expect(mocks.options).toHaveBeenCalledWith(eventId, id, "Ahmad");
    expect((await request("replacement-options", "GET", undefined, "a")).statusCode).toBe(422);
  });
  it.each(["waitlist", "decline", "cancel", "replace", "replacement-options"])("menolak anonim dan perwakilan lembaga: %s", async (action) => {
    mocks.session.mockResolvedValue(null);
    expect((await request(action, action.endsWith("options") ? "GET" : "POST")).statusCode).toBe(401);
    mocks.session.mockResolvedValue(actor("INSTITUTION_REPRESENTATIVE"));
    expect((await request(action, action.endsWith("options") ? "GET" : "POST")).statusCode).toBe(403);
  });
  it("menolak penugasan event yang salah sebelum service dipanggil", async () => {
    mocks.session.mockResolvedValue(actor("EVENT_ADMIN", replacement));
    expect((await request("cancel")).statusCode).toBe(403); expect(mocks.cancel).not.toHaveBeenCalled();
  });
  it("PATCH status tidak dapat memintas persetujuan atau role pembatalan", async () => {
    expect((await request("status", "PATCH", { toStatus: "APPROVED" })).statusCode).toBe(422);
    mocks.session.mockResolvedValue(actor("INSTITUTION_REPRESENTATIVE"));
    expect((await request("status", "PATCH", { toStatus: "CANCELLED" })).statusCode).toBe(403);
    expect(mocks.status).not.toHaveBeenCalled();
  });
  it.each(["waitlist", "decline", "cancel"])("alasan wajib pada %s", async (action) => {
    expect((await request(action, "POST", { reason: "  " })).statusCode).toBe(422);
  });
});
