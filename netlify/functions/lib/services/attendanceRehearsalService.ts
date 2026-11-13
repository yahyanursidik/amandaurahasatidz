import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getDbClient } from "../db/client";
import { attendanceRecords } from "../db/schema";
import { findAttendanceScheduleForEventRepository } from "../repositories/attendanceRepository";
import { AppError, ForbiddenError, NotFoundError, ValidationError } from "../utils/errors";
import {
  buildRequiredAttendanceUnits, CHECKIN_EVENT_STATUSES, findAttendanceUnit, isAttendanceWindowOpen, toCheckinUnit,
  type AttendanceMode, type AttendanceUnitSelection,
} from "./attendanceModel";
import { isSignedParticipantQr, requireKioskDeviceService } from "./kioskService";
import { verifyQrTokenForCheckinService } from "./participantQrService";

const REHEARSAL_TTL_MS = 30 * 60_000;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
type RehearsalPayload = { kind: "ATTENDANCE_REHEARSAL"; eventId: string; unitId: string; issuedAt: number; expiresAt: number; nonce: string };
type Blocker = { code: string; message: string };
const notice = "Mode uji saja. Tidak mencatat kehadiran, mengubah status peserta, atau mengirim pemberitahuan.";

function rehearsalKey() {
  const secret = process.env.REHEARSAL_QR_SECRET || process.env.SESSION_SECRET || process.env.JWT_SECRET || process.env.AUTH_SECRET ||
    process.env.PARTICIPANT_QR_SECRET || process.env.INVITATION_OTP_SECRET;
  if (!secret && (process.env.APP_ENV === "production" || process.env.CONTEXT === "production")) {
    throw new AppError("Konfigurasi uji QR belum lengkap. Hubungi admin sistem.", 503, "REHEARSAL_CONFIGURATION_ERROR");
  }
  return createHmac("sha256", secret || "local_disposable_attendance_rehearsal_2026")
    .update("attendance-rehearsal:v1").digest();
}

function signRehearsal(payload: RehearsalPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `rqr_${encoded}.${createHmac("sha256", rehearsalKey()).update(encoded).digest("base64url")}`;
}

function readRehearsal(token: string, now: Date): RehearsalPayload {
  if (token.length > 512 || !/^rqr_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new ValidationError("QR uji tidak valid. Buat QR uji yang baru.");
  }
  const [encoded, signature] = token.slice(4).split(".");
  const expected = createHmac("sha256", rehearsalKey()).update(encoded).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new ValidationError("QR uji tidak valid atau telah diubah.");
  let payload: RehearsalPayload;
  try { payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")); }
  catch { throw new ValidationError("QR uji tidak valid. Buat QR uji yang baru."); }
  if (payload.kind !== "ATTENDANCE_REHEARSAL" || !UUID.test(payload.eventId) ||
    typeof payload.unitId !== "string" || !/^[a-f0-9]{16}$/.test(payload.nonce) ||
    !Number.isSafeInteger(payload.issuedAt) || !Number.isSafeInteger(payload.expiresAt) ||
    payload.issuedAt > now.getTime() || payload.expiresAt <= now.getTime() ||
    payload.expiresAt <= payload.issuedAt || payload.expiresAt - payload.issuedAt > REHEARSAL_TTL_MS) {
    throw new ValidationError("QR uji sudah kedaluwarsa atau tidak valid. Buat QR uji yang baru.");
  }
  return payload;
}

async function rehearsalContext(eventId: string, selection: AttendanceUnitSelection, now: Date) {
  const schedule = await findAttendanceScheduleForEventRepository(eventId);
  if (!schedule) throw new NotFoundError("Event uji tidak ditemukan.");
  const { event } = schedule;
  const unit = findAttendanceUnit(buildRequiredAttendanceUnits(event.attendanceMode as AttendanceMode,
    schedule.days, schedule.sessions, event.timezone), selection);
  if (!unit) throw new ValidationError("Pilih hari atau sesi kehadiran milik event ini.");
  const blockers: Blocker[] = [];
  const eventOpen = !event.archivedAt && CHECKIN_EVENT_STATUSES.includes(event.status);
  if (!eventOpen) blockers.push({ code: "EVENT_STATUS", message: "Status event belum mengizinkan absensi resmi." });
  if (!unit.qrEnabled) blockers.push({ code: "QR_DISABLED", message: "Unit ini memakai pencatatan manual, bukan scan QR." });
  if (!isAttendanceWindowOpen(unit, now)) blockers.push({ code: "UNIT_WINDOW", message: "Di luar waktu absensi resmi untuk hari atau sesi ini." });
  return { mode: "REHEARSAL" as const, eventId, timezone: event.timezone, eventStatus: event.status,
    attendanceUnit: toCheckinUnit(unit, now, eventOpen), blockers, notice, recorded: false as const };
}

/** Read-only, deliberately separate from every official check-in write path. */
export async function issueAttendanceRehearsalQrService(eventId: string, selection: AttendanceUnitSelection) {
  const now = new Date();
  const context = await rehearsalContext(eventId, selection, now);
  const expiresAt = new Date(now.getTime() + REHEARSAL_TTL_MS);
  const qrToken = signRehearsal({ kind: "ATTENDANCE_REHEARSAL", eventId, unitId: context.attendanceUnit.id,
    issuedAt: now.getTime(), expiresAt: expiresAt.getTime(), nonce: randomBytes(8).toString("hex") });
  return { ...context, qrToken, expiresAt, liveReady: context.blockers.length === 0, checkedAt: now };
}

export async function processAttendanceRehearsalService(eventId: string, qrTokenOrCode: string, selection: AttendanceUnitSelection) {
  const now = new Date();
  const context = await rehearsalContext(eventId, selection, now);
  const token = qrTokenOrCode.trim();
  if (!token || token.length > 512) throw new ValidationError("Pindai QR uji atau isi kode peserta yang valid.");
  if (token.startsWith("rqr_")) {
    const payload = readRehearsal(token, now);
    if (payload.eventId !== eventId) throw new ForbiddenError("QR uji ini milik event lain.");
    if (payload.unitId !== context.attendanceUnit.id) throw new ValidationError("QR uji ini untuk hari atau sesi yang berbeda. Buat QR sesuai pilihan.");
    const blockers = [...context.blockers, { code: "TEST_QR", message: "QR ini hanya contoh uji, bukan kartu peserta untuk absensi resmi." }];
    return { ...context, status: "TEST_SUCCESS" as const, synthetic: true, liveReady: false, blockers,
      participant: null, checkedAt: now, expiresAt: new Date(payload.expiresAt) };
  }
  let verified: Awaited<ReturnType<typeof verifyQrTokenForCheckinService>>;
  try { verified = await verifyQrTokenForCheckinService(eventId, token); }
  catch (error) {
    // A real participant's moderation requirements remain enforced. Only a known
    // policy refusal is rendered as a diagnosis; bad signatures/scope still fail.
    if (!(error instanceof AppError) || !error.message.startsWith("Presensi ditolak:")) throw error;
    return { ...context, status: "TEST_BLOCKED" as const, synthetic: false, liveReady: false,
      blockers: [...context.blockers, { code: "PARTICIPANT_POLICY", message: error.message }],
      participant: null, checkedAt: now, expiresAt: null };
  }
  const unit = context.attendanceUnit;
  const [existing] = await getDbClient().select({ id: attendanceRecords.id }).from(attendanceRecords)
    .where(and(eq(attendanceRecords.eventId, eventId), eq(attendanceRecords.participantId, verified.participant.id),
      unit.sessionId ? eq(attendanceRecords.eventSessionId, unit.sessionId)
        : and(eq(attendanceRecords.eventDayId, unit.dayId), isNull(attendanceRecords.eventSessionId)))).limit(1);
  if (existing) context.blockers.push({ code: "ALREADY_RECORDED", message: "Peserta sudah mempunyai catatan absensi pada unit ini." });
  return { ...context, status: existing ? "TEST_BLOCKED" as const : "TEST_SUCCESS" as const, synthetic: false,
    liveReady: context.blockers.length === 0, participant: verified.participant, checkedAt: now, expiresAt: null };
}

export async function issueKioskAttendanceRehearsalQrService(eventId: string, cookieValue: string | undefined, selection: AttendanceUnitSelection) {
  await requireKioskDeviceService(eventId, cookieValue);
  return issueAttendanceRehearsalQrService(eventId, selection);
}

export async function processKioskAttendanceRehearsalService(eventId: string, cookieValue: string | undefined,
  qrTokenOrCode: string, selection: AttendanceUnitSelection) {
  await requireKioskDeviceService(eventId, cookieValue);
  if (!qrTokenOrCode.trim().startsWith("rqr_") && !isSignedParticipantQr(qrTokenOrCode)) {
    throw new ValidationError("Pindai QR uji atau QR pribadi peserta; kode manual hanya tersedia untuk petugas yang masuk.");
  }
  return processAttendanceRehearsalService(eventId, qrTokenOrCode, selection);
}
