import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HandlerContext, HandlerEvent } from "@netlify/functions";
import type { RoleCode } from "../../src/config/permissions";
import type { UserContext } from "../../netlify/functions/lib/middleware/rbac";

const mocks = vi.hoisted(() => ({ session: vi.fn(), manual: vi.fn(), share: vi.fn() }));
// Preserve every other auth export and exercise the actual requirePermission.
vi.mock("../../netlify/functions/lib/services/authService", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../netlify/functions/lib/services/authService")>(),
  getUserSession: mocks.session,
}));
vi.mock("../../netlify/functions/lib/services/manualParticipantService", () => ({
  createManualParticipantService: mocks.manual,
}));
vi.mock("../../netlify/functions/lib/services/participantShareService", () => ({
  getParticipantShareService: mocks.share,
}));

import { handler } from "../../netlify/functions/api";

const eventId = "11111111-1111-4111-8111-111111111111";
const otherEventId = "22222222-2222-4222-8222-222222222222";
const participantId = "33333333-3333-4333-8333-333333333333";
const actorId = "44444444-4444-4444-8444-444444444444";
const requestId = "participant-management-api-test";
const manualPath = `/events/${eventId}/participants/manual`;
const sharePath = `/events/${eventId}/participants/${participantId}/share`;
const input = { fullName: "Ahmad Hasan", email: "ahmad@example.org", whatsapp: "081234567890" };
const createdParticipant = Object.freeze({
  participantId, participantCode: "P-1234567890ABCDEF1234567890ABCDEF", reusedProfile: false,
  registrationSource: "ADMIN_ENTRY", approvalStatus: "PENDING_REVIEW", confirmationStatus: "INVITED",
});
const shareSource = Object.freeze({
  participantId, eventId, participantCode: createdParticipant.participantCode,
  fullName: input.fullName, email: input.email, phone: "6281234567890", whatsapp: "6281234567890",
  eventName: "Daurah Asatidz", startDate: "2026-10-10", endDate: "2026-10-12", venueName: "Aula",
  approvalStatus: "PENDING_REVIEW", confirmationStatus: "INVITED", qrToken: null, cardUrl: null,
});
const network = vi.fn(() => { throw new Error("Unexpected network call in API unit test"); });

function session(roleCode: RoleCode, assignedEventId: string | null = eventId): UserContext {
  return { userId: actorId, email: "admin@example.org", assignments: [{ roleCode, eventId: assignedEventId }] };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Fail closed if a regression reaches an unmocked database/network service.
  vi.stubEnv("DATABASE_URL", "");
  vi.stubGlobal("fetch", network);
  mocks.session.mockResolvedValue(session("EVENT_ADMIN"));
  mocks.manual.mockResolvedValue(createdParticipant);
  mocks.share.mockResolvedValue(shareSource);
});
afterEach(() => {
  expect(network).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function request(method: "POST" | "GET", path: string, body?: unknown) {
  const event: HandlerEvent = {
    rawUrl: `https://unit-test.invalid/api/v1${path}`, rawQuery: "",
    path: `/api/v1${path}`, httpMethod: method,
    headers: { authorization: "Bearer mocked-session", cookie: "yts_session=mocked-cookie", "x-request-id": requestId },
    multiValueHeaders: {}, queryStringParameters: null, multiValueQueryStringParameters: null,
    body: body === undefined ? null : JSON.stringify(body), isBase64Encoded: false,
  };
  const response = await handler(event, {} as HandlerContext, vi.fn());
  if (!response || typeof response.body !== "string") throw new Error("Expected a JSON handler response");
  expect(response.headers?.["X-Request-ID"]).toBe(requestId);
  return { ...response, json: JSON.parse(response.body) };
}

function expectNoParticipantServices() {
  expect(mocks.manual).not.toHaveBeenCalled();
  expect(mocks.share).not.toHaveBeenCalled();
}

describe("participant management API authorization (actual handler and RBAC)", () => {
  it.each([
    ["POST", manualPath], ["GET", sharePath],
  ] as const)("returns 401 for unauthenticated %s %s", async (method, path) => {
    mocks.session.mockResolvedValue(null);
    const response = await request(method, path, method === "POST" ? input : undefined);
    expect(response.statusCode).toBe(401);
    expect(response.json).toMatchObject({ data: null, error: { code: "UNAUTHENTICATED" }, requestId });
    expectNoParticipantServices();
  });

  it.each([
    ["POST", manualPath], ["GET", sharePath],
  ] as const)("returns 403 for a role without permission on %s %s", async (method, path) => {
    mocks.session.mockResolvedValue(session("USTADZ"));
    const response = await request(method, path, method === "POST" ? input : undefined);
    expect(response.statusCode).toBe(403);
    expect(response.json.error.code).toBe("FORBIDDEN");
    expectNoParticipantServices();
  });

  it.each([
    ["POST", manualPath, "EVENT_ADMIN"], ["GET", sharePath, "CHECKIN_OFFICER"],
  ] as const)("returns 403 for wrong event scope on %s %s", async (method, path, role) => {
    mocks.session.mockResolvedValue(session(role, otherEventId));
    const response = await request(method, path, method === "POST" ? input : undefined);
    expect(response.statusCode).toBe(403);
    expect(response.json.error.code).toBe("FORBIDDEN");
    expectNoParticipantServices();
  });

  it.each([
    ["POST", manualPath], ["GET", sharePath],
  ] as const)("returns 403 for an event-scoped role with no event assignment on %s", async (method, path) => {
    mocks.session.mockResolvedValue(session("EVENT_ADMIN", null));
    expect((await request(method, path, method === "POST" ? input : undefined)).statusCode).toBe(403);
    expectNoParticipantServices();
  });

  it.each([
    ["POST", manualPath, null], ["GET", sharePath, null],
    ["POST", manualPath, eventId], ["GET", sharePath, eventId],
  ] as const)("denies institution representative %s %s with event assignment %s", async (method, path, assignedEventId) => {
    mocks.session.mockResolvedValue(session("INSTITUTION_REPRESENTATIVE", assignedEventId));
    const response = await request(method, path, method === "POST" ? input : undefined);
    expect(response.statusCode).toBe(403);
    expect(response.json.error.code).toBe("FORBIDDEN");
    expectNoParticipantServices();
  });

  it.each([
    ["POST", manualPath, "SUPER_ADMIN", null], ["GET", sharePath, "SUPER_ADMIN", null],
    ["POST", manualPath, "EVENT_ADMIN", eventId], ["GET", sharePath, "EVENT_ADMIN", eventId],
  ] as const)("allows mixed representative on %s %s with valid %s assignment (%s)", async (method, path, staffRole, staffEventId) => {
    const mixedSession: UserContext = {
      ...session("INSTITUTION_REPRESENTATIVE", eventId),
      assignments: [
        { roleCode: "INSTITUTION_REPRESENTATIVE", eventId },
        { roleCode: staffRole, eventId: staffEventId },
      ],
    };
    const before = JSON.stringify(mixedSession);
    mocks.session.mockResolvedValue(mixedSession);
    const response = await request(method, path, method === "POST" ? input : undefined);
    expect(response.statusCode).toBe(method === "POST" ? 201 : 200);
    if (method === "POST") {
      expect(mocks.manual).toHaveBeenCalledExactlyOnceWith(eventId, {
        ...input, whatsapp: "6281234567890",
      }, actorId, requestId);
      expect(mocks.share).not.toHaveBeenCalled();
    } else {
      expect(mocks.share).toHaveBeenCalledExactlyOnceWith(eventId, participantId);
      expect(mocks.manual).not.toHaveBeenCalled();
      expect(response.headers?.["Cache-Control"]).toBe("no-store");
    }
    expect(JSON.stringify(mixedSession)).toBe(before);
  });

  it.each([
    ["POST", manualPath], ["GET", sharePath],
  ] as const)("does not let a representative bypass wrong staff event scope on %s", async (method, path) => {
    mocks.session.mockResolvedValue({
      ...session("INSTITUTION_REPRESENTATIVE", eventId),
      assignments: [
        { roleCode: "INSTITUTION_REPRESENTATIVE", eventId },
        { roleCode: "EVENT_ADMIN", eventId: otherEventId },
      ],
    } satisfies UserContext);
    expect((await request(method, path, method === "POST" ? input : undefined)).statusCode).toBe(403);
    expectNoParticipantServices();
  });
});

describe("POST /events/:id/participants/manual", () => {
  it.each(["EVENT_ADMIN", "REGISTRATION_OFFICER", "SUPER_ADMIN"] as const)(
    "returns 201 pending review without approval for authorized %s", async (role) => {
      mocks.session.mockResolvedValue(session(role, role === "SUPER_ADMIN" ? null : eventId));
      const response = await request("POST", manualPath, {
        ...input, fullName: " Ahmad Hasan ", email: " AHMAD@example.org ", whatsapp: "81234567890",
        institutionName: " Komunitas Ilmu ", address: " Alamat ", notes: " Catatan ",
        // Unknown status fields must never bypass the schema into the service.
        approvalStatus: "APPROVED", approvedBy: actorId, registrationSource: "DIRECT_PUBLIC",
      });
      expect(response.statusCode).toBe(201);
      expect(response.json).toEqual({ data: createdParticipant, error: null, meta: null, requestId });
      expect(response.json.data.approvalStatus).toBe("PENDING_REVIEW");
      expect(response.json.data.confirmationStatus).toBe("INVITED");
      expect(mocks.manual).toHaveBeenCalledExactlyOnceWith(eventId, {
        fullName: input.fullName, email: input.email, whatsapp: "6281234567890",
        institutionName: "Komunitas Ilmu", address: "Alamat", notes: "Catatan",
      }, actorId, requestId);
      expect(mocks.share).not.toHaveBeenCalled();
      expect(mocks.session).toHaveBeenCalledExactlyOnceWith("Bearer mocked-session", "yts_session=mocked-cookie");
    },
  );

  it("passes an explicit boolean confirmation without promoting pending approval", async () => {
    mocks.manual.mockResolvedValue(Object.freeze({ ...createdParticipant, confirmationStatus: "CONFIRMED" }));
    const response = await request("POST", manualPath, { ...input, attendanceConfirmed: true });
    expect(response.statusCode).toBe(201);
    expect(response.json.data).toMatchObject({ confirmationStatus: "CONFIRMED", approvalStatus: "PENDING_REVIEW" });
    expect(mocks.manual).toHaveBeenCalledExactlyOnceWith(eventId, {
      ...input, whatsapp: "6281234567890", attendanceConfirmed: true,
    }, actorId, requestId);
  });

  it("denies a read-only CHECKIN_OFFICER creation even for its own event", async () => {
    mocks.session.mockResolvedValue(session("CHECKIN_OFFICER"));
    expect((await request("POST", manualPath, input)).statusCode).toBe(403);
    expectNoParticipantServices();
  });

  it.each([
    ["missing fullName", { ...input, fullName: undefined }],
    ["blank fullName", { ...input, fullName: " " }],
    ["missing email", { ...input, email: undefined }],
    ["invalid email", { ...input, email: "not-an-email" }],
    ["missing whatsapp", { ...input, whatsapp: undefined }],
    ["invalid whatsapp", { ...input, whatsapp: "+1 202 555 0199" }],
    ["invalid optional phone", { ...input, phone: "abc" }],
    ["short institutionName", { ...input, institutionName: "ab" }],
    ["oversized address", { ...input, address: "x".repeat(501) }],
    ["oversized notes", { ...input, notes: "x".repeat(2001) }],
    ["string confirmation", { ...input, attendanceConfirmed: "true" }],
    ["numeric confirmation", { ...input, attendanceConfirmed: 1 }],
    ["empty body", undefined],
  ])("returns 422 for %s without calling the creation service", async (_label, body) => {
    const response = await request("POST", manualPath, body);
    expectNoParticipantServices();
    expect(response.json.data).toBeNull();
    expect(response.json.error.code).toBe("VALIDATION_ERROR");
    expect(response.statusCode).toBe(422);
  });
});

describe("GET /events/:id/participants/:pid/share", () => {
  it.each(["EVENT_ADMIN", "CHECKIN_OFFICER", "COMMITTEE_LEAD"] as const)(
    "permits participants.read for %s, returning 200 no-store without mutation", async (role) => {
      mocks.session.mockResolvedValue(session(role));
      const before = JSON.stringify(shareSource);
      const response = await request("GET", sharePath);
      expect(response.statusCode).toBe(200);
      expect(response.headers).toMatchObject({
        "Content-Type": "application/json", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
      });
      expect(response.json).toEqual({ data: shareSource, error: null, meta: null, requestId });
      expect(mocks.share).toHaveBeenCalledExactlyOnceWith(eventId, participantId);
      expect(mocks.manual).not.toHaveBeenCalled();
      expect(Object.isFrozen(shareSource)).toBe(true);
      expect(JSON.stringify(shareSource)).toBe(before);
      expect(response.json.data).toMatchObject({ approvalStatus: "PENDING_REVIEW", confirmationStatus: "INVITED",
        participantCode: shareSource.participantCode, qrToken: null, cardUrl: null });
    },
  );
});