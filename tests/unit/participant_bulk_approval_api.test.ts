import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HandlerContext, HandlerEvent } from "@netlify/functions";
import type { RoleCode } from "../../src/config/permissions";
import type { UserContext } from "../../netlify/functions/lib/middleware/rbac";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), bulk: vi.fn(), approve: vi.fn(),
  db: vi.fn(() => { throw new Error("Unexpected database access in API unit test"); }),
  network: vi.fn(() => { throw new Error("Unexpected network access in API unit test"); }),
}));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: mocks.db }));
vi.mock("../../netlify/functions/lib/services/authService", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../netlify/functions/lib/services/authService")>(),
  getUserSession: mocks.session,
}));
vi.mock("../../netlify/functions/lib/services/participantService", () => ({
  bulkApproveParticipantsService: mocks.bulk, approveParticipantService: mocks.approve,
  getParticipantsService: vi.fn(), updateParticipantStatusService: vi.fn(), replaceParticipantService: vi.fn(),
  waitlistParticipantService: vi.fn(), declineParticipantService: vi.fn(), cancelParticipantService: vi.fn(),
  provisionParticipantPortalAccountService: vi.fn(),
}));

import { handler } from "../../netlify/functions/api";
import { NotFoundError } from "../../netlify/functions/lib/utils/errors";

const eventId = "11111111-1111-4111-8111-111111111111";
const otherEventId = "22222222-2222-4222-8222-222222222222";
const participantId = "aaaaaaaa-aaaa-4aaa-8aaa-000000000001";
const actorId = "44444444-4444-4444-8444-444444444444";
const requestId = "participant-bulk-approval-api-test";
const bulkPath = `/events/${eventId}/participants/bulk-approve`;
const singlePath = `/events/${eventId}/participants/${participantId}/approve`;
const bulkInput = { participantIds: [participantId] };
const partialResult = {
  summary: { total: 2, succeeded: 1, failed: 1 },
  results: [
    { participantId, status: "SUCCESS", message: "Peserta berhasil diapprove" },
    { participantId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000002", status: "FAILED", message: "Kuota reguler sudah penuh" },
  ],
};
function session(roleCode: RoleCode, assignedEventId: string | null = eventId): UserContext {
  return { userId: actorId, email: "approver@example.org", assignments: [{ roleCode, eventId: assignedEventId }] };
}
async function request(path = bulkPath, body: unknown = bulkInput) {
  const event: HandlerEvent = {
    rawUrl: `https://unit-test.invalid/api/v1${path}`, rawQuery: "", path: `/api/v1${path}`, httpMethod: "POST",
    headers: { authorization: "Bearer mocked-session", cookie: "yts_session=mocked-cookie", "x-request-id": requestId },
    multiValueHeaders: {}, queryStringParameters: null, multiValueQueryStringParameters: null,
    body: body === undefined ? null : JSON.stringify(body), isBase64Encoded: false,
  };
  const response = await handler(event, {} as HandlerContext, vi.fn());
  if (!response || typeof response.body !== "string") throw new Error("Expected JSON handler response");
  expect(response.headers?.["X-Request-ID"]).toBe(requestId);
  return { ...response, json: JSON.parse(response.body) };
}
function noApprovalCalls() {
  expect(mocks.bulk).not.toHaveBeenCalled();
  expect(mocks.approve).not.toHaveBeenCalled();
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "");
  vi.stubGlobal("fetch", mocks.network);
  mocks.session.mockResolvedValue(session("EVENT_ADMIN"));
  mocks.bulk.mockResolvedValue(partialResult);
  mocks.approve.mockResolvedValue({ id: participantId, eventId, approvalStatus: "APPROVED" });
});
afterEach(() => {
  expect(mocks.db).not.toHaveBeenCalled();
  expect(mocks.network).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("approval API authorization through the actual handler and RBAC", () => {
  it.each([bulkPath, singlePath])("requires authentication for %s", async (path) => {
    mocks.session.mockResolvedValue(null);
    const response = await request(path, {});
    expect(response.statusCode).toBe(401);
    expect(response.json.error.code).toBe("UNAUTHENTICATED");
    noApprovalCalls();
  });

  it.each(["CHECKIN_OFFICER", "USTADZ", "EVENT_VIEWER", "INSTITUTION_REPRESENTATIVE", "SYSTEM_ADMIN"] as const)(
    "denies %s without participants.approve permission", async (role) => {
      mocks.session.mockResolvedValue(session(role));
      for (const path of [bulkPath, singlePath]) {
        const response = await request(path, {});
        expect(response.statusCode).toBe(403);
        expect(response.json.error.code).toBe("FORBIDDEN");
      }
      noApprovalCalls();
    },
  );

  it.each([otherEventId, null])("denies event-scoped approvers with assignment %s", async (assignedEventId) => {
    mocks.session.mockResolvedValue(session("EVENT_ADMIN", assignedEventId));
    expect((await request()).statusCode).toBe(403);
    expect((await request(singlePath, {})).statusCode).toBe(403);
    noApprovalCalls();
  });

  it.each(["EVENT_ADMIN", "COMMITTEE_LEAD", "REGISTRATION_OFFICER", "SUPER_ADMIN"] as const)(
    "allows %s and passes eventId first to bulk approval", async (role) => {
      mocks.session.mockResolvedValue(session(role, role === "SUPER_ADMIN" ? null : eventId));
      const input = { participantIds: partialResult.results.map((result) => result.participantId) };
      const response = await request(bulkPath, input);
      expect(response.statusCode).toBe(200);
      expect(response.json).toEqual({ data: partialResult, error: null, meta: null, requestId });
      expect(mocks.bulk).toHaveBeenCalledExactlyOnceWith(eventId, input.participantIds, actorId, requestId);
      expect(mocks.approve).not.toHaveBeenCalled();
      expect(mocks.session).toHaveBeenCalledExactlyOnceWith("Bearer mocked-session", "yts_session=mocked-cookie");
    },
  );
});

describe("approval API validation and scope forwarding", () => {
  it("accepts exactly 25 UUIDs without splitting or changing the service summary", async () => {
    const participantIds = Array.from({ length: 25 }, (_, i) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(i + 1).padStart(12, "0")}`);
    expect((await request(bulkPath, { participantIds })).statusCode).toBe(200);
    expect(mocks.bulk).toHaveBeenCalledExactlyOnceWith(eventId, participantIds, actorId, requestId);
  });

  it.each([
    ["empty", { participantIds: [] }], ["missing", {}], ["invalid UUID", { participantIds: ["bad-id"] }],
    ["duplicates", { participantIds: [participantId, participantId] }],
    ["case-insensitive duplicates", { participantIds: [participantId, participantId.toUpperCase()] }],
    ["over 25", { participantIds: Array.from({ length: 26 }, (_, i) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(i + 1).padStart(12, "0")}`) }],
  ])("rejects %s before any approval service call", async (_label, body) => {
    const response = await request(bulkPath, body);
    expect(response.statusCode).toBe(422);
    expect(response.json).toMatchObject({ data: null, error: { code: "VALIDATION_ERROR" } });
    noApprovalCalls();
  });

  it.each(["Reviewed", null])("passes optional expectedEventId last on single approval with notes %s", async (notes) => {
    const response = await request(singlePath, { notes });
    expect(response.statusCode).toBe(200);
    expect(mocks.approve).toHaveBeenCalledExactlyOnceWith(participantId, actorId, requestId, notes || undefined, eventId);
    expect(mocks.bulk).not.toHaveBeenCalled();
  });

  it("propagates single-service scope rejection rather than returning success", async () => {
    mocks.approve.mockRejectedValueOnce(new NotFoundError("Peserta tidak ditemukan pada event ini."));
    const response = await request(singlePath, {});
    expect(response.statusCode).toBe(404);
    expect(response.json.data).toBeNull();
    expect(mocks.approve).toHaveBeenCalledExactlyOnceWith(participantId, actorId, requestId, undefined, eventId);
  });
});