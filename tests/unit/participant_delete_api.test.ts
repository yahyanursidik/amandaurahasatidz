import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HandlerContext, HandlerEvent } from "@netlify/functions";
import type { RoleCode } from "../../src/config/permissions";

const mocks = vi.hoisted(() => ({ session: vi.fn(), remove: vi.fn() }));
vi.mock("../../netlify/functions/lib/services/authService", async (original) => ({
  ...await original<typeof import("../../netlify/functions/lib/services/authService")>(), getUserSession: mocks.session,
}));
vi.mock("../../netlify/functions/lib/services/participantService", () => ({ deleteParticipantService: mocks.remove }));
import { handler } from "../../netlify/functions/api";

const eventId = "11111111-1111-4111-8111-111111111111";
const participantId = "22222222-2222-4222-8222-222222222222";
const actorId = "33333333-3333-4333-8333-333333333333";
const otherEventId = "44444444-4444-4444-8444-444444444444";
const actor = (roleCode: RoleCode = "EVENT_ADMIN", scope: string | null = eventId) => ({
  userId: actorId, email: "delete@unit.invalid", assignments: [{ roleCode, eventId: scope }],
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(actor());
  mocks.remove.mockResolvedValue({ participantId, eventId, deleted: true, successorParticipantId: null });
  vi.stubEnv("DATABASE_URL", "");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network is disabled in deletion unit tests"); }));
});
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
async function remove(body: unknown = { reason: "  Pendaftaran ganda  " }, target = participantId) {
  const path = `/api/v1/events/${eventId}/participants/${target}`;
  const response = await handler({ path, rawUrl: `https://unit.invalid${path}`, rawQuery: "", httpMethod: "DELETE",
    headers: { "x-request-id": "participant-delete-test" }, body: body === undefined ? null : JSON.stringify(body),
    queryStringParameters: null, multiValueHeaders: {}, multiValueQueryStringParameters: null, isBase64Encoded: false,
  } as HandlerEvent, {} as HandlerContext, vi.fn());
  if (!response || typeof response.body !== "string") throw new Error("JSON response expected");
  return { ...response, json: JSON.parse(response.body) };
}

describe("DELETE event participant authorization and validation", () => {
  it.each(["SUPER_ADMIN", "EVENT_ADMIN", "COMMITTEE_ADMIN", "COMMITTEE_ORGANIZER"] as const)(
    "allows %s and passes only the scoped identity, actor and cleaned reason", async (role) => {
      mocks.session.mockResolvedValue(actor(role, ["SUPER_ADMIN", "COMMITTEE_ORGANIZER"].includes(role) ? null : eventId));
      const result = await remove();
      expect(result.statusCode).toBe(200);
      expect(result.json.data).toMatchObject({ participantId, eventId, deleted: true });
      expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(eventId, participantId, "Pendaftaran ganda", actorId, "participant-delete-test");
    });

  it("requires authentication before any service call", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await remove()).statusCode).toBe(401);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it.each(["INSTITUTION_REPRESENTATIVE", "USTADZ", "REGISTRATION_OFFICER", "CHECKIN_OFFICER", "COMMITTEE_LEAD", "REPORT_VIEWER"] as const)(
    "denies %s even with a matching event", async (role) => {
      mocks.session.mockResolvedValue(actor(role));
      expect((await remove()).statusCode).toBe(403);
      expect(mocks.remove).not.toHaveBeenCalled();
    });
  it.each([otherEventId, null])("denies an event admin assigned to %s", async (scope) => {
    mocks.session.mockResolvedValue(actor("EVENT_ADMIN", scope));
    expect((await remove()).statusCode).toBe(403);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it.each([{ reason: " " }, { reason: "ab" }, { reason: "x".repeat(1001) }, {},
    { reason: "Pendaftaran ganda", eventId: otherEventId }, null])("requires an explicit bounded reason and rejects identity overrides: %j", async (body) => {
    expect((await remove(body)).statusCode).toBe(422);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("rejects malformed participant UUIDs before deletion", async () => {
    expect((await remove({ reason: "Pendaftaran ganda" }, "abc")).statusCode).toBe(422);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
