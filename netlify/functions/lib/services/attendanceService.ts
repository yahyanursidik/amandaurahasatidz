import {
  findAttendanceScheduleForEventRepository,
  recordCheckinLogRepository,
  recordCheckinTransactionRepository,
  getRecentCheckinLogsRepository,
  attendanceRosterCondition,
  DuplicateAttendanceError,
} from "../repositories/attendanceRepository";
import { verifyQrTokenForCheckinService } from "./participantQrService";
import { AppError, NotFoundError, ValidationError } from "../utils/errors";
import { logError } from "../utils/logger";
import {
  ATTENDED_STATUSES, EXCUSED_STATUSES, CHECKIN_EVENT_STATUSES, buildRequiredAttendanceUnits, toCheckinUnit,
  type AttendanceMode, type AttendanceUnitSelection,
} from "./attendanceModel";
import { participantCheckinBlockReason } from "./deadlineService";
import { getDbClient } from "../db/client";
import { attendanceRecords, eventParticipants, events, institutions, ustadzProfiles } from "../db/schema";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";

export async function searchEventCheckinParticipantsService(eventId: string, query: string) {
  const db = getDbClient();
  const normalized = query.trim().replace(/[\\%_]/g, "\\$&");
  const pattern = `%${normalized}%`;
  const matches = await db.select({
    id: eventParticipants.id, participantCode: eventParticipants.participantCode,
    ustadzName: ustadzProfiles.fullName, institutionName: institutions.name,
    approvalStatus: eventParticipants.approvalStatus,
    confirmationStatus: eventParticipants.confirmationStatus,
    attendanceConfirmationRequired: events.attendanceConfirmationRequired,
  }).from(eventParticipants).innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .leftJoin(institutions, eq(eventParticipants.institutionId, institutions.id))
    .where(and(eq(eventParticipants.eventId, eventId), or(
      ilike(ustadzProfiles.fullName, pattern), ilike(eventParticipants.participantCode, pattern), ilike(institutions.name, pattern),
    )))
    .orderBy(asc(ustadzProfiles.fullName), asc(eventParticipants.id)).limit(12);
  return matches.map(({ attendanceConfirmationRequired, ...participant }) => ({
    ...participant, blockReason: participantCheckinBlockReason(participant, { attendanceConfirmationRequired }),
  }));
}

export async function getAttendanceCheckinUnitsService(eventId: string, now = new Date()) {
  const schedule = await findAttendanceScheduleForEventRepository(eventId);
  if (!schedule) throw new NotFoundError(`Event ID ${eventId} tidak ditemukan.`);
  const mode = schedule.event.attendanceMode as AttendanceMode;
  const plan = buildRequiredAttendanceUnits(mode, schedule.days, schedule.sessions, schedule.event.timezone);
  const eventAllowsCheckin = !schedule.event.archivedAt && CHECKIN_EVENT_STATUSES.includes(schedule.event.status);
  const units = plan.filter((unit) => unit.qrEnabled).map((unit) => toCheckinUnit(unit, now, eventAllowsCheckin));

  return {
    eventId,
    attendanceMode: mode,
    timezone: schedule.event.timezone,
    eventStatus: schedule.event.status,
    eventAllowsCheckin,
    confirmationRequired: schedule.event.attendanceConfirmationRequired !== false,
    manualUnitCount: plan.length - units.length,
    units,
    openUnits: units.filter((unit) => unit.isOpen),
  };
}

/** Counts reflect the selected day/session, not all check-ins across the event. */
export async function getGateAttendanceSummaryService(eventId: string, unitId: string) {
  const schedule = await getAttendanceCheckinUnitsService(eventId);
  const unit = schedule.units.find((item) => item.id === unitId);
  if (!unit) throw new ValidationError("Pilih hari atau sesi kehadiran yang valid.");
  const unitCondition = unit.sessionId
    ? sql`ar.event_session_id = ${unit.sessionId}`
    : sql`ar.event_day_id = ${unit.dayId} and ar.event_session_id is null`;
  const hasStatus = (statuses: string[]) => sql`exists (
    select 1 from ${attendanceRecords} ar where ar.event_id = ${eventId}
      and ar.participant_id = ${eventParticipants.id} and ar.attendance_status in (${sql.join(statuses.map((status) => sql`${status}`), sql`, `)})
      and ${unitCondition}
  )`;
  const [counts] = await getDbClient().select({
    total: sql<number>`count(*)::int`,
    present: sql<number>`count(*) filter (where ${hasStatus(ATTENDED_STATUSES)})::int`,
    excused: sql<number>`count(*) filter (where ${hasStatus(EXCUSED_STATUSES)})::int`,
  }).from(eventParticipants).where(attendanceRosterCondition(eventId, schedule.confirmationRequired));
  const total = counts?.total || 0;
  const present = counts?.present || 0;
  const excused = counts?.excused || 0;
  return { unitId, total, present, excused, absent: Math.max(0, total - present - excused) };
}

export async function getActiveSessionService(eventId: string) {
  const schedule = await getAttendanceCheckinUnitsService(eventId);
  const active =
    schedule.openUnits.find((unit) => unit.type === "SESSION") ||
    schedule.openUnits[0] ||
    schedule.units[0] || null;
  return {
    unit: active,
    session: active?.type === "SESSION" ? active : null,
    attendanceMode: schedule.attendanceMode,
    timezone: schedule.timezone,
    eventAllowsCheckin: schedule.eventAllowsCheckin,
    manualUnitCount: schedule.manualUnitCount,
    units: schedule.units,
    checkinWindow: active ? { isOpen: active.isOpen, openAt: active.openAt, closeAt: active.closeAt } : null,
  };
}

export async function processOnSiteCheckinService(
  eventId: string,
  qrTokenOrCode: string,
  method: string,
  actorUserId?: string,
  requestId = "req-checkin",
  selection: AttendanceUnitSelection = {},
  sourceDevice?: string,
) {
  const actualMethod = qrTokenOrCode.trim().startsWith("pqr_") ? "QR_SCAN" : method === "SEARCH_SELECT" ? "SEARCH_SELECT" : "MANUAL_CODE";
  let participant: Awaited<ReturnType<typeof verifyQrTokenForCheckinService>>["participant"] | undefined;
  try {
    const verified = await verifyQrTokenForCheckinService(eventId, qrTokenOrCode, actorUserId, requestId);
    participant = verified.participant;
    const record = await recordCheckinTransactionRepository({
      eventId,
      dayId: selection.dayId,
      sessionId: selection.sessionId,
      participantId: participant.id,
      method: actualMethod,
      actorUserId,
      requestId,
      sourceDevice,
      expectedQrTokenVersion: verified.qrTokenVersion,
    });
    return {
      status: "SUCCESS",
      checkinAt: record.checkinAt,
      attendanceStatus: record.attendanceStatus,
      participant: {
        id: participant.id,
        participantCode: participant.participantCode,
        ustadzName: participant.ustadzName,
        institutionName: participant.institutionName,
        confirmationStatus: participant.confirmationStatus,
      },
      attendanceUnit: record.attendanceUnit,
      sessionTitle: record.attendanceUnit.title,
    };
  } catch (error) {
    const isDuplicate = error instanceof DuplicateAttendanceError;
    await recordCheckinLogRepository({
      eventId,
      participantId: participant?.id,
      method: actualMethod,
      result: isDuplicate ? "DUPLICATE" : "FAILED",
      failureReason: error instanceof AppError ? error.message : "Pencatatan presensi gagal.",
      scannedBy: actorUserId,
      requestId,
      // Requested IDs may be invalid/foreign; do not persist them as a FK.
      metadata: { dayId: selection.dayId, sessionId: selection.sessionId, ...(sourceDevice && { kioskDeviceId: sourceDevice }) },
    }).catch((logFailure) => logError(requestId, "Log scan gagal disimpan", logFailure));
    throw error;
  }
}

export async function getRecentCheckinLogsService(eventId: string, limitCount = 20) {
  return getRecentCheckinLogsRepository(eventId, limitCount);
}
