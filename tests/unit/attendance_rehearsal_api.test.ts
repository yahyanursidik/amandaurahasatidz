import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HandlerContext, HandlerEvent } from "@netlify/functions";
import type { UserContext } from "../../netlify/functions/lib/middleware/rbac";
import { UnauthorizedError, ValidationError } from "../../netlify/functions/lib/utils/errors";
import { signParticipantQrToken } from "../../netlify/functions/lib/utils/token";

const mocks = vi.hoisted(() => ({ session: vi.fn(), gateEvent: vi.fn(), kiosk: vi.fn(), db: vi.fn(),
  issue: vi.fn(), run: vi.fn(), publicIssue: vi.fn(), publicRun: vi.fn(), official: vi.fn() }));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: mocks.db }));
vi.mock("../../netlify/functions/lib/services/authService", async (original) => ({
  ...await original<typeof import("../../netlify/functions/lib/services/authService")>(), getUserSession: mocks.session,
}));
vi.mock("../../netlify/functions/lib/services/eventService", async (original) => ({
  ...await original<typeof import("../../netlify/functions/lib/services/eventService")>(), getPublicGateEventService: mocks.gateEvent,
}));
vi.mock("../../netlify/functions/lib/services/kioskService", async (original) => ({
  ...await original<typeof import("../../netlify/functions/lib/services/kioskService")>(), requireKioskDeviceService: mocks.kiosk,
}));
vi.mock("../../netlify/functions/lib/services/attendanceService", async (original) => ({
  ...await original<typeof import("../../netlify/functions/lib/services/attendanceService")>(), processOnSiteCheckinService: mocks.official,
}));
vi.mock("../../netlify/functions/lib/services/attendanceRehearsalService", () => ({
  issueAttendanceRehearsalQrService: mocks.issue, processAttendanceRehearsalService: mocks.run,
  issueKioskAttendanceRehearsalQrService: mocks.publicIssue, processKioskAttendanceRehearsalService: mocks.publicRun,
}));
import { handler } from "../../netlify/functions/api";

const eventId = "26000000-0000-4000-8000-000000000001", dayId = "26000000-0000-4000-8000-000000000002";
const otherEvent = "26000000-0000-4000-8000-000000000003", deviceId = "26000000-0000-4000-8000-000000000004";
const base = `/events/${eventId}/checkin/rehearsal`, gate = "/gate/events/rehearsal-test";
const cookieValue = `${deviceId}.kdev_${"a".repeat(64)}`, cookie = `ada_kiosk_rehearsal-test=${cookieValue}`;
const token = signParticipantQrToken({ participantId: dayId, eventId, version: 1 }, "api-test-secret");
const testToken = `rqr_${"b".repeat(30)}.${"c".repeat(43)}`;
const unit = { id: `DAY:${dayId}`, type: "DAY", dayId, sessionId: null, date: "2026-11-14",
  title: "Hari pertama", openAt: "2026-11-14T00:00:00Z", closeAt: "2026-11-14T23:00:00Z", isOpen: false };
const result = { mode: "REHEARSAL", status: "TEST_SUCCESS", synthetic: false, recorded: false, liveReady: false,
  checkedAt: "2026-11-13T01:00:00Z", attendanceUnit: unit, blockers: [{ code: "UNIT_WINDOW", message: "Di luar waktu absensi resmi." }],
  notice: "Tidak dicatat.", participant: { id: dayId, participantCode: "PRIVATE-CODE", ustadzName: "Private Name", institutionName: "Private Institution" } };
const officer: UserContext = { userId: deviceId, email: "officer@rehearsal.invalid", assignments: [{ roleCode: "CHECKIN_OFFICER", eventId }] };
let calls = 0;
async function request(path: string, body?: unknown, requestCookie = "", headers: Record<string, string> = {}) {
  const event: HandlerEvent = { path: `/api/v1${path}`, rawUrl: `https://rehearsal.invalid/api/v1${path}`, rawQuery: "", httpMethod: "POST",
    headers: { host: "rehearsal.invalid", origin: "https://rehearsal.invalid", "sec-fetch-site": "same-origin",
      "client-ip": `192.0.2.${++calls}`, cookie: requestCookie, ...headers }, queryStringParameters: null,
    multiValueHeaders: {}, multiValueQueryStringParameters: null, body: body === undefined ? null : JSON.stringify(body), isBase64Encoded: false };
  const response = await handler(event, {} as HandlerContext, vi.fn());
  if (!response?.body) throw new Error("No response");
  return { status: response.statusCode, headers: response.headers, ...JSON.parse(response.body) };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(null);
  mocks.db.mockImplementation(() => { throw new Error("An API guard must not query the database in this suite"); });
  mocks.gateEvent.mockResolvedValue({ id: eventId, slug: "rehearsal-test", code: "TEST", name: "Daurah Uji" });
  mocks.kiosk.mockResolvedValue({ id: deviceId, label: "Perangkat uji" });
  mocks.issue.mockResolvedValue({ ...result, qrToken: testToken }); mocks.run.mockResolvedValue(result);
  mocks.publicIssue.mockResolvedValue({ ...result, qrToken: testToken }); mocks.publicRun.mockResolvedValue(result);
  mocks.official.mockRejectedValue(new ValidationError("QR uji tidak berlaku untuk absensi resmi."));
});

describe("attendance rehearsal API authorization and privacy", () => {
  it("requires authentication on staff issue and scan routes before services or participant reads", async () => {
    expect((await request(`${base}/qr`, { dayId })).status).toBe(401);
    expect((await request(base, { dayId, qrTokenOrCode: "P-TEST" })).status).toBe(401);
    expect(mocks.issue).not.toHaveBeenCalled(); expect(mocks.run).not.toHaveBeenCalled(); expect(mocks.db).not.toHaveBeenCalled();
  });
  it.each([
    { roleCode: "EVENT_VIEWER", eventId }, { roleCode: "CHECKIN_OFFICER", eventId: otherEvent },
    { roleCode: "USTADZ" }, { roleCode: "CHECKIN_OFFICER", eventId, endsAt: new Date("2000-01-01") },
  ] as UserContext["assignments"])("requires the live attendance-record permission and current event scope (%s)", async (assignment) => {
    mocks.session.mockResolvedValue({ ...officer, assignments: [assignment] });
    expect((await request(`${base}/qr`, { dayId })).status).toBe(403);
    expect((await request(base, { dayId, qrTokenOrCode: "P-TEST" })).status).toBe(403);
    expect(mocks.issue).not.toHaveBeenCalled(); expect(mocks.run).not.toHaveBeenCalled(); expect(mocks.db).not.toHaveBeenCalled();
  });
  it("accepts an authorized event officer and exactly one selected attendance unit without calling official attendance", async () => {
    mocks.session.mockResolvedValue(officer);
    const issued = await request(`${base}/qr`, { dayId });
    expect(issued.status).toBe(200); expect(issued.headers?.["Cache-Control"]).toBe("no-store");
    expect(mocks.issue).toHaveBeenCalledWith(eventId, { dayId });
    const scan = await request(base, { dayId, qrTokenOrCode: "P-TEST" });
    expect(scan).toMatchObject({ status: 200, data: { mode: "REHEARSAL", recorded: false } });
    expect(mocks.run).toHaveBeenCalledWith(eventId, "P-TEST", { dayId, qrTokenOrCode: "P-TEST" });
    for (const input of [null, {}, { dayId, sessionId: otherEvent }, { dayId, mode: "LIVE" }, { dayId, now: "2099-01-01" }]) {
      expect((await request(`${base}/qr`, input)).status).toBe(422);
    }
    expect(mocks.official).not.toHaveBeenCalled();
  });
  it("requires a paired device and same-origin request before public rehearsal", async () => {
    expect((await request(`${gate}/rehearsal-qr`, { dayId })).status).toBe(401);
    expect((await request(`${gate}/rehearsal`, { dayId, qrToken: token })).status).toBe(401);
    for (const headers of [{ origin: "https://other.invalid" }, { "sec-fetch-site": "cross-site" }] as Record<string, string>[]) {
      expect((await request(`${gate}/rehearsal`, { dayId, qrToken: token }, cookie, headers)).status).toBe(403);
    }
    expect(mocks.publicIssue).not.toHaveBeenCalled(); expect(mocks.publicRun).not.toHaveBeenCalled(); expect(mocks.official).not.toHaveBeenCalled();
  });
  it("propagates an expired or revoked device rejected by the defense-in-depth service wrapper", async () => {
    mocks.publicIssue.mockRejectedValueOnce(new UnauthorizedError("Akses kiosk kedaluwarsa."));
    mocks.publicRun.mockRejectedValueOnce(new UnauthorizedError("Akses kiosk telah dicabut."));
    expect((await request(`${gate}/rehearsal-qr`, { dayId }, cookie)).status).toBe(401);
    expect((await request(`${gate}/rehearsal`, { dayId, qrToken: token }, cookie)).status).toBe(401);
    expect(mocks.publicRun).toHaveBeenCalledWith(eventId, cookieValue, token, { dayId, qrTokenOrCode: token });
    expect(mocks.official).not.toHaveBeenCalled();
  });
  it("rejects public manual codes, missing selections, null payloads, and forged modes before service calls", async () => {
    for (const input of [null, [], { dayId, qrToken: "P-TEST" }, { qrToken: token },
      { dayId, qrToken: token, mode: "REHEARSAL" }, { dayId, sessionId: otherEvent, qrToken: token }]) {
      expect((await request(`${gate}/rehearsal`, input, cookie)).status).toBe(422);
    }
    expect(mocks.publicRun).not.toHaveBeenCalled(); expect(mocks.official).not.toHaveBeenCalled();
  });
  it("strips participant name, registration code, and identifiers from public real-QR rehearsal responses", async () => {
    const scanned = await request(`${gate}/rehearsal`, { dayId, qrToken: token }, cookie);
    expect(scanned).toMatchObject({ status: 200, data: { mode: "REHEARSAL", status: "TEST_SUCCESS", recorded: false, attendanceUnit: unit } });
    expect(scanned.headers?.["Cache-Control"]).toBe("no-store");
    expect(JSON.stringify(scanned.data)).not.toMatch(/PRIVATE-CODE|Private Name|Private Institution|participant/);
    expect(mocks.publicRun).toHaveBeenCalledWith(eventId, cookieValue, token, { dayId, qrTokenOrCode: token });
    expect(mocks.session).not.toHaveBeenCalled(); expect(mocks.official).not.toHaveBeenCalled();
  });
  it("does not route a forged mode on official endpoints to the rehearsal service", async () => {
    mocks.session.mockResolvedValue(officer);
    const staff = await request(`/events/${eventId}/checkin`, { dayId, qrTokenOrCode: testToken, mode: "REHEARSAL" });
    expect(staff.status).toBe(422);
    expect(mocks.official).not.toHaveBeenCalled(); expect(mocks.run).not.toHaveBeenCalled();
    expect((await request(`/events/${eventId}/checkin`, { dayId, qrTokenOrCode: token, mode: "REHEARSAL" })).status).toBe(422);
    expect(mocks.official).not.toHaveBeenCalled();
    mocks.official.mockClear();
    expect((await request(`${gate}/checkin`, { dayId, qrToken: testToken, mode: "REHEARSAL" }, cookie)).status).toBe(422);
    expect(mocks.official).not.toHaveBeenCalled(); expect(mocks.publicRun).not.toHaveBeenCalled();
  });
});
