import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { HandlerContext, HandlerEvent } from "@netlify/functions";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../netlify/functions/lib/db/schema";
import { hashToken } from "../../netlify/functions/lib/utils/token";
import { createSessionToken } from "../../netlify/functions/lib/services/authService";
import { handler } from "../../netlify/functions/api";
import { querySegmentTargetsService } from "../../netlify/functions/lib/services/reminderService";

// Use the repository's migrations and real PostgreSQL constraints in memory.
// Only connection entry points are replaced; never contact a live database.
const local = vi.hoisted(() => ({ db: undefined as ReturnType<typeof drizzle<typeof schema>> | undefined }));
vi.mock("../../netlify/functions/lib/db/client", () => ({
  getDbClient: () => {
    if (!local.db) throw new Error("Test database was not initialized");
    return local.db;
  },
}));
vi.mock("../../netlify/functions/lib/db/transaction", () => ({
  withTransaction: (work: Parameters<NonNullable<typeof local.db>["transaction"]>[0]) => local.db!.transaction(work),
}));
vi.mock(import("../../netlify/functions/lib/utils/logger"), async (original) => ({
  ...await original(), logInfo: vi.fn(),
}));

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [eventA, eventB, eventSetup] = [1, 2, 3].map(id);
const [dayA, nextDay, dayB] = [10, 11, 12].map(id);
const [sessionA, manualA, optionalA] = [20, 21, 22].map(id);
const [admin, reader, officer, a, b, pending, unconfirmed, withdrawn, newcomer, legacy, ambiguous] =
  [31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41].map(id);
const [pA, pB, pPending, pUnconfirmed, pWithdrawn, pLegacy, pAmbiguous, pUnmarked, pHistorical] =
  [51, 52, 53, 54, 55, 56, 57, 58, 59].map(id);
const attendanceA = `/events/${eventA}/attendance`;
const attendanceB = `/events/${eventB}/attendance`;
const locationA = `/events/${eventA}/location-qr`;
const kioskA = "/gate/events/daurah-a";
const begin = new Date("2026-11-13T01:30:00Z"); // 09.30 WITA
const start = new Date("2026-11-13T01:00:00Z");
const end = new Date("2026-11-13T02:00:00Z");
const fakeEmail = (user: string) => `test-${user.slice(-2)}@gate.invalid`;
const auth = new Map<string, string>();
const pg = new PGlite();
const db = drizzle(pg, { schema });
let requestSequence = 0;

async function request(path: string, options: {
  user?: string; method?: string; body?: unknown; cookie?: string; origin?: string; query?: Record<string, string>;
} = {}) {
  const { user, method = "GET", body, cookie, origin = "https://gate.invalid", query } = options;
  const event: HandlerEvent = {
    path: `/api/v1${path}`, rawUrl: `https://gate.invalid/api/v1${path}`, rawQuery: new URLSearchParams(query).toString(),
    httpMethod: method, headers: { host: "gate.invalid", origin, "sec-fetch-site": "same-origin",
      "client-ip": "192.0.2.123", "x-request-id": `gate-test-${++requestSequence}`,
      ...(user && { authorization: `Bearer ${auth.get(user)}` }), ...(cookie && { cookie }) },
    queryStringParameters: query || null, multiValueHeaders: {}, multiValueQueryStringParameters: null,
    isBase64Encoded: false, body: body === undefined ? null : JSON.stringify(body),
  };
  const response = await handler(event, {} as HandlerContext, vi.fn());
  if (!response?.body) throw new Error("No response");
  return { status: response.statusCode, headers: response.headers, ...JSON.parse(response.body) };
}

const post = (path: string, user: string | undefined, body: unknown, cookie?: string) =>
  request(path, { method: "POST", user, body, cookie });
const patch = (path: string, body: unknown) => request(path, { method: "PATCH", user: admin, body });
const issue = (selection: { dayId: string } | { sessionId: string }, rotate = false, user = officer) =>
  post(locationA, user, { ...selection, rotate });
const self = (user: string, token: string, selection: { dayId: string } | { sessionId: string }, eventId = eventA) =>
  post("/portal/self-checkin", user, { eventId, rawLocationQrToken: token, ...selection });

beforeAll(async () => {
  local.db = db;
  const migrations = join(process.cwd(), "drizzle");
  for (const name of readdirSync(migrations).filter((file) => file.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(join(migrations, name), "utf8"));
  }
}, 60_000);

beforeEach(async () => {
  vi.stubEnv("APP_ENV", "production");
  vi.stubEnv("SESSION_SECRET", "test-only-gate-session-secret");
  vi.stubEnv("PARTICIPANT_QR_SECRET", "test-only-gate-participant-qr-secret");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(begin);
  // All fixtures are disposable, and reset independently from each other.
  await pg.exec("truncate table events, users, roles, ustadz_profiles cascade");
  await db.insert(schema.users).values([admin, reader, officer, a, b, pending, unconfirmed, withdrawn, newcomer, legacy, ambiguous]
    .map((user) => ({ id: user, email: fakeEmail(user) })));
  const roles = await db.insert(schema.roles).values(["EVENT_ADMIN", "REPORT_VIEWER", "CHECKIN_OFFICER", "USTADZ"]
    .map((code) => ({ code, name: code }))).returning();
  await db.insert(schema.userRoleAssignments).values([
    { userId: admin, roleId: roles[0].id, eventId: eventA }, { userId: admin, roleId: roles[0].id, eventId: eventSetup },
    { userId: reader, roleId: roles[1].id }, { userId: officer, roleId: roles[2].id, eventId: eventA },
    ...[a, b, pending, unconfirmed, withdrawn, newcomer, legacy, ambiguous].map((userId) => ({ userId, roleId: roles[3].id })),
  ]);
  for (const user of [admin, reader, officer, a, b, pending, unconfirmed, withdrawn, newcomer, legacy, ambiguous]) {
    auth.set(user, createSessionToken(fakeEmail(user)).sessionId);
  }

  const profiles = await db.insert(schema.ustadzProfiles).values([
    ...[a, b, pending, unconfirmed, withdrawn, legacy, ambiguous, ambiguous].map((user, i) => ({
      userId: i < 5 ? user : null, email: fakeEmail(user), fullName: `Ustadz Uji ${i + 1}`, normalizedName: `ustadz uji ${i + 1}`,
    })),
    { fullName: "Ustadz Belum Datang", normalizedName: "ustadz belum datang" },
    { fullName: "Ustadz Riwayat", normalizedName: "ustadz riwayat" },
  ]).returning();
  await db.insert(schema.events).values([
    { id: eventA, slug: "daurah-a", name: "Daurah A", code: "DA-A", status: "ONGOING", startDate: "2026-11-13", endDate: "2026-11-15", timezone: "Asia/Makassar" },
    { id: eventB, slug: "daurah-b", name: "Daurah B", code: "DA-B", status: "ONGOING", startDate: "2026-11-13", endDate: "2026-11-13", attendanceMode: "DAILY_ONLY" },
    { id: eventSetup, slug: "daurah-jadwal", name: "Daurah Jadwal", code: "DA-J", status: "PUBLISHED", startDate: "2026-11-13", endDate: "2026-11-15", timezone: "Asia/Makassar" },
  ]);
  await db.insert(schema.eventDays).values([
    { id: dayA, eventId: eventA, dayNumber: 1, date: "2026-11-13", title: "Hari pertama" },
    { id: nextDay, eventId: eventA, dayNumber: 2, date: "2026-11-15", title: "Hari kedua" },
    { id: dayB, eventId: eventB, dayNumber: 1, date: "2026-11-13" },
  ]);
  await db.insert(schema.eventCommitteeAssignments).values({ eventId: eventA, userId: officer, committeeRole: "CHECKIN_OFFICER" });
  await db.insert(schema.eventSessions).values([
    { id: sessionA, eventDayId: dayA, startAt: start, endAt: end, title: "Materi QR" },
    { id: manualA, eventDayId: dayA, startAt: start, endAt: end, title: "Materi Manual", checkinRequired: false },
    { id: optionalA, eventDayId: dayA, startAt: start, endAt: end, title: "Istirahat", attendanceRequired: false, checkinRequired: false },
  ]);
  await db.insert(schema.eventParticipants).values(
    [pA, pB, pPending, pUnconfirmed, pWithdrawn, pLegacy, pAmbiguous, pUnmarked, pHistorical].map((participantId, i) => ({
      id: participantId, eventId: i === 1 ? eventB : eventA, ustadzId: profiles[i === 7 ? 8 : i === 8 ? 9 : i].id,
      participantCode: `PAR-UJI-${i + 1}`, confirmationStatus: i === 3 ? "INVITED" : [4, 8].includes(i) ? "CANCELLED" : "CONFIRMED",
      approvalStatus: i === 2 ? "PENDING_REVIEW" : "APPROVED",
    })),
  );
}, 30_000);

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
afterAll(async () => { await pg.close(); local.db = undefined; });

describe("Gate QR, QR Lokasi, and attendance reports on a disposable PostgreSQL database", () => {
  it("issues a scoped QR and records only the authenticated participant; rejects a second scan by any method", async () => {
    const staffContext = await request("/committee/context", { user: officer });
    expect(staffContext.data.assignments.map((item: any) => item.eventId)).toEqual([eventA]);
    expect(staffContext.data.assignments[0].effectivePermissions).toContain("attendance.record");
    const adminContext = await request("/committee/context", { user: admin });
    expect(adminContext.data.assignments.map((item: any) => item.eventId).sort()).toEqual([eventA, eventSetup].sort());
    expect(adminContext.data.assignments[0].effectivePermissions).toContain("attendance.correct");
    expect((await request(locationA, { user: officer })).status).toBe(405);
    expect((await issue({ dayId: dayA }, false, reader)).status).toBe(403);
    expect((await issue({ dayId: dayB })).status).toBe(404);
    expect((await issue({ sessionId: manualA })).status).toBe(422);
    expect((await issue({ sessionId: optionalA })).status).toBe(404);
    expect((await issue({ dayId: nextDay })).status).toBe(422);
    const issued = await issue({ dayId: dayA });
    expect(issued.status, JSON.stringify(issued.error)).toBe(200);
    expect(issued.headers["Cache-Control"]).toBe("no-store");
    expect(issued.data).toMatchObject({ eventId: eventA, dayId: dayA, sessionId: null, secondsRemaining: 30 });
    const raw = issued.data.rawToken;
    const [token] = await db.select().from(schema.checkinTokens).where(eq(schema.checkinTokens.id, issued.data.tokenId));
    expect(token).toMatchObject({ eventId: eventA, eventDayId: dayA, tokenHash: hashToken(raw), createdBy: officer });
    expect(JSON.stringify(token)).not.toContain(raw);

    expect((await post("/portal/self-checkin", undefined, { eventId: eventA, dayId: dayA, rawLocationQrToken: raw })).status).toBe(401);
    expect((await self(admin, raw, { dayId: dayA })).status).toBe(403);
    expect((await post("/portal/self-checkin", a, { eventId: eventA, dayId: dayA, rawLocationQrToken: raw, participantId: pB })).status).toBe(422);
    expect((await self(b, raw, { dayId: dayB }, eventB)).status).toBe(422);
    expect((await self(a, raw, { sessionId: sessionA })).status).toBe(422);
    expect((await self(a, `loc_qr_${"a".repeat(64)}`, { dayId: dayA })).status).toBe(422);
    expect((await self(newcomer, raw, { dayId: dayA })).status).toBe(404);
    expect((await self(ambiguous, raw, { dayId: dayA })).status).toBe(404);
    for (const user of [pending, unconfirmed, withdrawn]) expect((await self(user, raw, { dayId: dayA })).status).toBe(422);
    const recorded = await self(a, raw, { dayId: dayA });
    expect(recorded.status, JSON.stringify(recorded.error)).toBe(200);
    expect(recorded.data).toMatchObject({ status: "SUCCESS", method: "SELF_SCAN", participantCode: "PAR-UJI-1", attendanceStatus: "PRESENT" });
    expect((await self(legacy, raw, { dayId: dayA })).status).toBe(200);
    expect((await post(`/events/${eventA}/checkin`, officer, { dayId: dayA, qrTokenOrCode: "PAR-UJI-1", method: "MANUAL_CODE" })).status).toBe(409);
    expect((await self(a, raw, { dayId: dayA })).status).toBe(409);
    const rows = await db.select().from(schema.attendanceRecords);
    expect(rows.map((row) => row.participantId).sort()).toEqual([pA, pLegacy].sort());
    const overview = await request("/portal/overview", { user: a });
    expect(overview.status, JSON.stringify(overview.error)).toBe(200);
    expect(overview.data.participations[0].attendance[0]).toMatchObject({ dayId: dayA, checkinMethod: "SELF_SCAN" });
  });

  it("expires and rotates QR without revoking a different unit; marks a late session", async () => {
    const [oldDay, firstSession] = await Promise.all([issue({ dayId: dayA }), issue({ sessionId: sessionA })]);
    const fresh = await issue({ dayId: dayA }, true);
    expect(fresh.status, JSON.stringify(fresh.error)).toBe(200);
    expect((await self(a, oldDay.data.rawToken, { dayId: dayA })).status).toBe(422);
    const accepted = await self(a, firstSession.data.rawToken, { sessionId: sessionA });
    expect(accepted.status, JSON.stringify(accepted.error)).toBe(200);
    expect(accepted.data).toMatchObject({ attendanceStatus: "LATE", attendanceUnit: { sessionId: sessionA } });
    vi.setSystemTime(new Date(begin.getTime() + 31_000));
    expect((await self(a, fresh.data.rawToken, { dayId: dayA })).status).toBe(422);
    expect((await db.select().from(schema.attendanceRecords)).map((record) => record.eventSessionId)).toEqual([sessionA]);
    vi.setSystemTime(new Date("2026-11-14T16:30:00Z")); // 00.30 WITA on the next scheduled day, still yesterday in WIB
    const targets = await querySegmentTargetsService("ATTENDED_PREVIOUS_DAY", eventA);
    expect(targets.map((person) => person.participantId)).toEqual([pA]);
  });

  it("applies event scope and role to corrections and stores the audit atomically", async () => {
    const [foreign] = await db.insert(schema.attendanceRecords).values({
      eventId: eventB, participantId: pB, eventDayId: dayB, attendanceStatus: "PRESENT",
    }).returning();
    const change = { attendanceStatus: "EXCUSED", reason: "  Koreksi petugas di lokasi  " };
    expect((await post(`${attendanceA}/${foreign.id}/correct`, admin, change)).status).toBe(404);
    expect((await post(`${attendanceB}/${foreign.id}/correct`, admin, change)).status).toBe(403);
    expect((await post(`${attendanceA}/manual-mark`, officer, { participantId: pB, sessionId: manualA, attendanceStatus: "PRESENT" })).status).toBe(404);
    expect((await request(`${attendanceA}/recap`, { user: a })).status).toBe(403);
    const mark = await post(`${attendanceA}/manual-mark`, officer, { participantId: pA, sessionId: manualA, attendanceStatus: "PRESENT" });
    expect(mark.status, JSON.stringify(mark.error)).toBe(200);
    expect((await post(`${attendanceA}/${mark.data.id}/correct`, officer, change)).status).toBe(403);
    expect((await post(`${attendanceA}/${mark.data.id}/correct`, admin, { ...change, reason: "   " })).status).toBe(422);
    const corrected = await post(`${attendanceA}/${mark.data.id}/correct`, admin, change);
    expect(corrected.status, JSON.stringify(corrected.error)).toBe(200);
    expect(corrected.data).toMatchObject({ attendanceStatus: "EXCUSED", correctedBy: admin, checkinMethod: "MANUAL_MARK" });
    const [audit] = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, "ATTENDANCE_CORRECTED"));
    expect(audit).toMatchObject({ eventId: eventA, resourceId: mark.data.id, reason: "Koreksi petugas di lokasi",
      beforeData: { status: "PRESENT" }, afterData: { status: "EXCUSED" } });
    expect((await db.select().from(schema.attendanceRecords).where(eq(schema.attendanceRecords.id, foreign.id)))[0].attendanceStatus).toBe("PRESENT");
    const report = await request(`${attendanceA}/${pA}/report`, { user: officer });
    expect(report.status, JSON.stringify(report.error)).toBe(200);
    expect(report.data.attendance.unitStatuses.find((unit: any) => unit.sessionId === manualA)).toMatchObject({
      status: "EXCUSED", qrEnabled: false, recordId: mark.data.id,
    });
    const search = await request(`/events/${eventA}/checkin/search`, { user: officer, query: { q: "PAR-UJI-" } });
    expect(search.status).toBe(200);
    expect(search.data.map((person: any) => person.id)).not.toContain(pB);
    expect(search.data.find((person: any) => person.id === pPending).blockReason).toMatch(/belum disetujui/);
    expect((await post(`/events/${eventA}/checkin`, officer, { dayId: dayA, qrTokenOrCode: "PAR-UJI-%", method: "MANUAL_CODE" })).status).toBe(404);
    expect((await post(`/events/${eventA}/checkin`, officer, { dayId: dayA, qrTokenOrCode: "PAR-UJI-1", method: "SEARCH_SELECT" })).status).toBe(200);
  });

  it("pairs kiosk once, scans a portal QR anonymously, and synchronizes the roster and reports", async () => {
    const pairing = await post(`/events/${eventA}/kiosk/pairings`, admin, { label: "Meja uji" });
    expect(pairing.status, JSON.stringify(pairing.error)).toBe(201);
    expect((await request(`${kioskA}/pair`, { method: "POST", origin: "https://other.invalid", body: { pairingToken: pairing.data.pairingToken } })).status).toBe(403);
    const activated = await post(`${kioskA}/pair`, undefined, { pairingToken: pairing.data.pairingToken });
    expect(activated.status, JSON.stringify(activated.error)).toBe(200);
    expect(activated.headers["Set-Cookie"]).toContain("HttpOnly; Secure; SameSite=Strict");
    const cookie = activated.headers["Set-Cookie"].split(";")[0];
    expect((await post(`${kioskA}/pair`, undefined, { pairingToken: pairing.data.pairingToken })).status).toBe(409);
    expect((await request("/gate/events/daurah-b/units", { cookie })).status).toBe(401);
    const { data: schedule } = await request(`${kioskA}/units`, { cookie });
    expect(schedule.units.map((unit: any) => unit.id)).toEqual([`DAY:${dayA}`, `DAY:${nextDay}`, `SESSION:${sessionA}`]);
    const qr = await request("/portal/qr", { user: a, query: { participantId: pA } });
    expect(qr.status, JSON.stringify(qr.error)).toBe(200);
    const { opaqueQrToken } = qr.data;
    expect((await post(`${kioskA}/checkin`, undefined, { qrToken: "PAR-UJI-1", dayId: dayA }, cookie)).status).toBe(422);
    expect((await post(`${kioskA}/checkin`, undefined, { qrToken: opaqueQrToken, dayId: dayB }, cookie)).status).toBe(422);
    const scanned = await post(`${kioskA}/checkin`, undefined, { qrToken: opaqueQrToken, dayId: dayA }, cookie);
    expect(scanned.status, JSON.stringify(scanned.error)).toBe(200);
    expect(scanned.data).toMatchObject({ status: "SUCCESS", attendanceStatus: "PRESENT" });
    expect(scanned.data).not.toHaveProperty("participant");
    expect(JSON.stringify(scanned.data)).not.toContain(pA);
    expect((await post(`${kioskA}/checkin`, undefined, { qrToken: opaqueQrToken, dayId: dayA }, cookie)).status).toBe(409);

    await db.insert(schema.attendanceRecords).values([
      { eventId: eventA, participantId: pHistorical, eventDayId: dayA, attendanceStatus: "PRESENT" },
      { eventId: eventA, participantId: pLegacy, eventDayId: dayA, attendanceStatus: "PERMITTED" },
    ]);
    const summary = await request(`${kioskA}/summary`, { cookie, query: { unitId: `DAY:${dayA}` } });
    expect(summary.status, JSON.stringify(summary.error)).toBe(200);
    expect(summary.data).toMatchObject({ total: 4, present: 1, excused: 1, absent: 2 });
    const logs = await request(`/events/${eventA}/checkin/logs`, { user: officer });
    expect(logs.data.filter((log: any) => log.metadata?.kioskDeviceId === pairing.data.id).map((log: any) => log.result).sort())
      .toEqual(["DUPLICATE", "FAILED", "SUCCESS"]);
    const recap = await request(`${attendanceA}/recap`, { user: officer });
    expect(recap.status, JSON.stringify(recap.error)).toBe(200);
    expect(recap.data).toMatchObject({ totalParticipants: 4, historicalParticipantCount: 1 });
    expect(recap.data.participantDetails.find((row: any) => row.participantId === pHistorical)).toMatchObject({ statusCategory: "TIDAK_WAJIB", requiredUnits: 0 });
    expect(recap.data.participantDetails.map((row: any) => row.participantId)).not.toContain(pPending);

    const before = await request("/reports/no-show", { user: admin, query: { eventId: eventA } });
    expect(before.status, JSON.stringify(before.error)).toBe(200);
    expect(before.data.meta.total).toBe(0);
    expect((await post(`/events/${eventA}/transition`, admin, { action: "COMPLETE_EVENT" })).status).toBe(422);
    vi.setSystemTime(new Date("2026-11-16T02:00:00Z"));
    expect((await post(`/events/${eventA}/transition`, admin, { action: "COMPLETE_EVENT" })).status).toBe(200);
    const after = await request("/reports/no-show", { user: admin, query: { eventId: eventA } });
    expect(after.status, JSON.stringify(after.error)).toBe(200);
    expect(after.data.data.map((row: any) => row.participantId).sort()).toEqual([pAmbiguous, pUnmarked].sort());
    const dashboard = await request("/dashboard/committee", { user: officer, query: { eventId: eventA } });
    expect(dashboard.status, JSON.stringify(dashboard.error)).toBe(200);
    expect(dashboard.data.noShowParticipantsCount).toBe(2);
    expect((await post(`/events/${eventA}/kiosk/${pairing.data.id}/revoke`, admin, {})).status).toBe(200);
    await db.update(schema.events).set({ status: "ONGOING" }).where(eq(schema.events.id, eventA));
    expect((await request(`${kioskA}/session`, { cookie })).status).toBe(401);
  });

  it("uses scheduled dates with gaps, verifies readiness, and prevents reinterpretation of history", async () => {
    const prep = `/events/${eventSetup}`;
    expect((await post(`${prep}/transition`, admin, { action: "START_EVENT" })).status).toBe(422);
    const [first, next] = await Promise.all([
      post(`${prep}/days`, admin, { date: "2026-11-13", dayNumber: 1 }),
      post(`${prep}/days`, admin, { date: "2026-11-15", dayNumber: 2 }),
    ]);
    expect([first.status, next.status]).toEqual([201, 201]);
    const timing = { eventDayId: first.data.id, title: "Sesi manual", startAt: start.toISOString(), endAt: end.toISOString() };
    expect((await post(`${prep}/sessions`, admin, { ...timing, startAt: "2026-11-12T12:00:00Z" })).status).toBe(422);
    expect((await post(`${prep}/sessions`, admin, { ...timing, attendanceRequired: true, checkinRequired: false })).status).toBe(201);
    const readiness = await request(prep, { user: admin, query: { view: "attendance-setup" } });
    expect(readiness.data.attendanceSetup).toMatchObject({ readyToStart: true, qrUnitCount: 2, manualUnitCount: 1 });
    expect((await post(`${prep}/transition`, admin, { action: "START_EVENT" })).status).toBe(200);
    const { data: schedule } = await request(`${prep}/sessions/active`, { user: admin });
    expect(schedule.units.map((unit: any) => unit.date)).toEqual(["2026-11-13", "2026-11-15"]);

    await db.insert(schema.attendanceRecords).values({ eventId: eventA, eventDayId: dayA, participantId: pA, attendanceStatus: "PRESENT" });
    const pathA = `/events/${eventA}`;
    expect((await patch(pathA, { attendanceMode: "DAILY_ONLY" })).status).toBe(409);
    expect((await patch(pathA, { attendanceConfirmationRequired: false })).status).toBe(409);
    expect((await patch(pathA, { slug: "daurah-renamed" })).status).toBe(409);
    expect((await post(`${pathA}/days`, admin, { date: "2026-11-14", dayNumber: 3 })).status).toBe(409);
    expect((await patch(`${pathA}/sessions/${sessionA}`, { attendanceRequired: false })).status).toBe(409);
    expect((await patch(`${pathA}/sessions/${sessionA}`, { title: "Materi (diperjelas)" })).status).toBe(200);
    expect((await post(`${pathA}/sessions`, admin, { ...timing, eventDayId: dayA, attendanceRequired: false })).status).toBe(201);
    expect((await post(`${pathA}/sessions`, admin, { ...timing, eventDayId: dayA, attendanceRequired: true })).status).toBe(409);
    vi.setSystemTime(new Date("2026-11-16T02:00:00Z"));
    expect((await patch(`${pathA}/days/${dayA}`, { checkinCloseAt: "2026-11-14T02:00:00Z" })).status).toBe(409);
    expect((await post(`${pathA}/transition`, admin, { action: "COMPLETE_EVENT" })).status).toBe(200);
    expect((await patch(`${pathA}/days/${dayA}`, { title: "Judul baru" })).status).toBe(409);
    expect(await db.select().from(schema.attendanceRecords).where(and(eq(schema.attendanceRecords.eventId, eventA), eq(schema.attendanceRecords.participantId, pA)))).toHaveLength(1);
  });
});
