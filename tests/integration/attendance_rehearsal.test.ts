import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../netlify/functions/lib/db/schema";
import {
  issueAttendanceRehearsalQrService, processAttendanceRehearsalService,
  issueKioskAttendanceRehearsalQrService, processKioskAttendanceRehearsalService,
} from "../../netlify/functions/lib/services/attendanceRehearsalService";
import { processOnSiteCheckinService } from "../../netlify/functions/lib/services/attendanceService";
import { generateSecureToken, signParticipantQrToken, verifyParticipantQrToken } from "../../netlify/functions/lib/utils/token";
import { attendanceRehearsalQrSchema, attendanceRehearsalScanSchema } from "../../netlify/functions/lib/validations/attendanceValidation";

const fixture = vi.hoisted(() => ({ db: undefined as ReturnType<typeof drizzle<typeof schema>> | undefined }));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: () => fixture.db! }));
vi.mock("../../netlify/functions/lib/db/transaction", () => ({
  withTransaction: (work: Parameters<NonNullable<typeof fixture.db>["transaction"]>[0]) => fixture.db!.transaction(work),
}));
const pg = new PGlite();
const db = drizzle(pg, { schema });
const uuid = (n: number) => `23000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const eventId = uuid(1), otherEvent = uuid(2), dayId = uuid(3), otherDay = uuid(4), sessionId = uuid(5), manualSession = uuid(6);
const profileId = uuid(7), participantId = uuid(8), pendingProfile = uuid(9), pendingParticipant = uuid(10), deviceId = uuid(11);
const beforeEvent = new Date("2026-11-01T01:00:00Z"), atEvent = new Date("2026-11-14T01:00:00Z");
let deviceCookie = "";
const qr = () => signParticipantQrToken({ eventId, participantId, version: 1 });

async function snapshot() {
  return Promise.all([
    db.select().from(schema.eventParticipants), db.select().from(schema.attendanceRecords), db.select().from(schema.checkinLogs),
    db.select().from(schema.auditLogs), db.select().from(schema.emailJobs), db.select().from(schema.checkinTokens),
    db.select().from(schema.participantStatusHistories), db.select().from(schema.eventKioskDevices),
  ]);
}
beforeAll(async () => {
  fixture.db = db;
  for (const file of readdirSync(join(process.cwd(), "drizzle")).filter((name) => name.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(join(process.cwd(), "drizzle", file), "utf8"));
  }
}, 60_000);
beforeEach(async () => {
  vi.stubEnv("SESSION_SECRET", "isolated-rehearsal-test-secret");
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(beforeEvent);
  await pg.exec("truncate table events, users, roles, ustadz_profiles, institutions cascade");
  await db.insert(schema.events).values([eventId, otherEvent].map((id, index) => ({ id,
    code: `REHEARSE-${index}`, slug: `rehearsal-${index}`, name: "Daurah Uji", attendanceMode: "DAILY_AND_SESSION",
    status: "PUBLISHED", startDate: "2026-11-14", endDate: "2026-11-15", timezone: "Asia/Jakarta", attendanceConfirmationRequired: true })));
  await db.insert(schema.eventDays).values([
    { id: dayId, eventId, dayNumber: 1, date: "2026-11-14", title: "Hari pertama" },
    { id: otherDay, eventId: otherEvent, dayNumber: 1, date: "2026-11-14" },
  ]);
  await db.insert(schema.eventSessions).values([sessionId, manualSession].map((id) => ({ id, eventDayId: dayId,
    title: id === sessionId ? "Sesi pagi" : "Sesi manual", startAt: atEvent, endAt: new Date("2026-11-14T03:00:00Z"),
    checkinRequired: id !== manualSession, attendanceRequired: true })));
  await db.insert(schema.ustadzProfiles).values([
    { id: profileId, fullName: "Ustadz Uji Siap", normalizedName: "ustadz uji siap", email: "ready@rehearsal.invalid" },
    { id: pendingProfile, fullName: "Ustadz Uji Tinjauan", normalizedName: "ustadz uji tinjauan", email: "pending@rehearsal.invalid" },
  ]);
  await db.insert(schema.eventParticipants).values([
    { id: participantId, eventId, ustadzId: profileId, participantCode: "P-REHEARSAL", approvalStatus: "APPROVED", confirmationStatus: "CONFIRMED" },
    { id: pendingParticipant, eventId, ustadzId: pendingProfile, participantCode: "P-PENDING", approvalStatus: "PENDING_REVIEW", confirmationStatus: "INVITED" },
  ]);
  const deviceToken = generateSecureToken("kdev"); deviceCookie = `${deviceId}.${deviceToken.rawToken}`;
  await db.insert(schema.eventKioskDevices).values({ id: deviceId, eventId, label: "Perangkat uji",
    pairingTokenHash: generateSecureToken("kpair").tokenHash, pairingExpiresAt: new Date("2026-11-02"), pairedAt: beforeEvent,
    deviceTokenHash: deviceToken.tokenHash, deviceExpiresAt: new Date("2026-12-01") });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
afterAll(async () => { await pg.close(); fixture.db = undefined; });

describe("read-only attendance QR rehearsal", () => {
  it.each([{ dayId }, { sessionId }])("tests a synthetic QR before the selected unit begins without writing anything ($dayId $sessionId)", async (selection) => {
    const before = await snapshot();
    const issued = await issueAttendanceRehearsalQrService(eventId, selection);
    expect(issued.qrToken).toMatch(/^rqr_/);
    expect(verifyParticipantQrToken(issued.qrToken)).toBeNull();
    expect(issued.expiresAt.getTime() - beforeEvent.getTime()).toBe(30 * 60_000);
    const scanned = await processAttendanceRehearsalService(eventId, issued.qrToken, selection);
    expect(scanned).toMatchObject({ mode: "REHEARSAL", status: "TEST_SUCCESS", synthetic: true, recorded: false, liveReady: false, participant: null });
    expect(scanned.blockers.map(({ code }) => code)).toEqual(["UNIT_WINDOW", "TEST_QR"]);
    expect(await snapshot()).toEqual(before);
  });

  it("supports staff rehearsal in an unpublished event and diagnoses manual-only sessions, never opening official attendance", async () => {
    await db.update(schema.events).set({ status: "DRAFT" }).where(eq(schema.events.id, eventId));
    const before = await snapshot();
    const issued = await issueAttendanceRehearsalQrService(eventId, { sessionId: manualSession });
    const scanned = await processAttendanceRehearsalService(eventId, issued.qrToken, { sessionId: manualSession });
    expect(scanned.status).toBe("TEST_SUCCESS");
    expect(scanned.blockers.map(({ code }) => code)).toEqual(["EVENT_STATUS", "QR_DISABLED", "UNIT_WINDOW", "TEST_QR"]);
    expect(await snapshot()).toEqual(before);
  });

  it("can rehearse again after the event date without reopening the event or changing reports", async () => {
    vi.setSystemTime(new Date("2026-12-01T01:00:00Z"));
    await db.update(schema.events).set({ status: "COMPLETED" }).where(eq(schema.events.id, eventId));
    const before = await snapshot();
    const issued = await issueAttendanceRehearsalQrService(eventId, { dayId });
    const scanned = await processAttendanceRehearsalService(eventId, issued.qrToken, { dayId });
    expect(scanned.status).toBe("TEST_SUCCESS");
    expect(scanned.blockers.map(({ code }) => code)).toEqual(["EVENT_STATUS", "UNIT_WINDOW", "TEST_QR"]);
    expect(await snapshot()).toEqual(before);
  });

  it("rejects altered, expired, foreign-event and foreign-unit test tokens without writes", async () => {
    const before = await snapshot();
    const issued = await issueAttendanceRehearsalQrService(eventId, { dayId });
    await expect(processAttendanceRehearsalService(eventId, `${issued.qrToken}x`, { dayId })).rejects.toMatchObject({ statusCode: 422 });
    await expect(processAttendanceRehearsalService(otherEvent, issued.qrToken, { dayId: otherDay })).rejects.toMatchObject({ statusCode: 403 });
    await expect(processAttendanceRehearsalService(eventId, issued.qrToken, { sessionId })).rejects.toMatchObject({ statusCode: 422 });
    await expect(issueAttendanceRehearsalQrService(eventId, { dayId: otherDay })).rejects.toMatchObject({ statusCode: 422 });
    vi.setSystemTime(new Date(beforeEvent.getTime() + 30 * 60_000));
    await expect(processAttendanceRehearsalService(eventId, issued.qrToken, { dayId })).rejects.toMatchObject({ statusCode: 422 });
    expect(await snapshot()).toEqual(before);
  });

  it("diagnoses real QR/code eligibility, rotation and duplicate attendance without modifying QR issuance or attendance", async () => {
    const before = await snapshot();
    for (const value of [qr(), "p-rehearsal"]) {
      const scanned = await processAttendanceRehearsalService(eventId, value, { dayId });
      expect(scanned).toMatchObject({ status: "TEST_SUCCESS", synthetic: false, recorded: false, liveReady: false, participant: { id: participantId } });
      expect(scanned.blockers.map(({ code }) => code)).toEqual(["UNIT_WINDOW"]);
    }
    const pending = await processAttendanceRehearsalService(eventId, "P-PENDING", { dayId });
    expect(pending).toMatchObject({ status: "TEST_BLOCKED", recorded: false, liveReady: false, participant: null });
    expect(pending.blockers.map(({ code }) => code)).toContain("PARTICIPANT_POLICY");
    expect(await snapshot()).toEqual(before);
    vi.setSystemTime(atEvent);
    expect((await processAttendanceRehearsalService(eventId, qr(), { dayId })).liveReady).toBe(true);
    await db.insert(schema.attendanceRecords).values({ eventId, eventDayId: dayId, participantId, attendanceStatus: "PRESENT", checkinAt: atEvent });
    const duplicateBefore = await snapshot();
    expect(await processAttendanceRehearsalService(eventId, qr(), { dayId })).toMatchObject({ status: "TEST_BLOCKED", recorded: false, liveReady: false });
    expect(await snapshot()).toEqual(duplicateBefore);
    await db.update(schema.eventParticipants).set({ qrTokenVersion: 2 }).where(eq(schema.eventParticipants.id, participantId));
    await expect(processAttendanceRehearsalService(eventId, qr(), { dayId })).rejects.toMatchObject({ statusCode: 422 });
  });

  it("requires a current, event-scoped kiosk device on every test request and never accepts manual participant codes publicly", async () => {
    const before = await snapshot();
    const issued = await issueKioskAttendanceRehearsalQrService(eventId, deviceCookie, { dayId });
    expect(await processKioskAttendanceRehearsalService(eventId, deviceCookie, issued.qrToken, { dayId })).toMatchObject({ status: "TEST_SUCCESS", recorded: false });
    await expect(processKioskAttendanceRehearsalService(eventId, deviceCookie, "P-REHEARSAL", { dayId })).rejects.toMatchObject({ statusCode: 422 });
    await expect(issueKioskAttendanceRehearsalQrService(otherEvent, deviceCookie, { dayId: otherDay })).rejects.toMatchObject({ statusCode: 401 });
    await expect(issueKioskAttendanceRehearsalQrService(eventId, undefined, { dayId })).rejects.toMatchObject({ statusCode: 401 });
    expect(await snapshot()).toEqual(before);
    await db.update(schema.eventKioskDevices).set({ revokedAt: beforeEvent }).where(eq(schema.eventKioskDevices.id, deviceId));
    await expect(processKioskAttendanceRehearsalService(eventId, deviceCookie, issued.qrToken, { dayId })).rejects.toMatchObject({ statusCode: 401 });
    await db.update(schema.eventKioskDevices).set({ revokedAt: null, deviceExpiresAt: beforeEvent }).where(eq(schema.eventKioskDevices.id, deviceId));
    await expect(issueKioskAttendanceRehearsalQrService(eventId, deviceCookie, { dayId })).rejects.toMatchObject({ statusCode: 401 });
  });

  it("official attendance rejects a rehearsal QR even if a caller forges a mode flag", async () => {
    vi.setSystemTime(atEvent);
    const issued = await issueAttendanceRehearsalQrService(eventId, { dayId });
    await expect(processOnSiteCheckinService(eventId, issued.qrToken, "QR_SCAN", undefined, "forged-mode", { dayId, mode: "REHEARSAL" } as never))
      .rejects.toMatchObject({ statusCode: 422 });
    expect(await db.select().from(schema.attendanceRecords)).toHaveLength(0);
    expect((await db.select().from(schema.eventParticipants))[0].qrIssuedAt).toBeNull();
    expect(await db.select().from(schema.emailJobs)).toHaveLength(0);
  });

  it("requires exactly one selected unit and rejects unknown mode/time override flags", () => {
    expect(attendanceRehearsalQrSchema.safeParse({ dayId })).toMatchObject({ success: true });
    expect(attendanceRehearsalScanSchema.safeParse({ dayId, qrTokenOrCode: "P-REHEARSAL" })).toMatchObject({ success: true });
    for (const value of [{}, { dayId, sessionId }, { dayId, mode: "LIVE" }, { dayId, now: "2099-01-01" }]) {
      expect(attendanceRehearsalQrSchema.safeParse(value).success).toBe(false);
    }
  });
});
