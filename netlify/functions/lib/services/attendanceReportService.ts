import { getDbClient } from "../db/client";
import { withTransaction } from "../db/transaction";
import { attendanceRecords, auditLogs, eventParticipants, ustadzProfiles, institutions, events } from "../db/schema";
import { eq, and, or, exists, desc } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../utils/errors";
import { createAuditLog } from "./auditService";
import { participantCheckinBlockReason } from "./deadlineService";
import {
  attendanceRosterCondition,
  findAttendanceScheduleForEventRepository,
  recordAttendanceTransactionRepository,
} from "../repositories/attendanceRepository";
import {
  ATTENDED_STATUSES, CHECKIN_EVENT_STATUSES, EXCUSED_STATUSES,
  type AttendanceMode, type AttendanceRecordLike, type AttendanceUnit,
  buildRequiredAttendanceUnits,
  summarizeParticipantAttendance,
} from "./attendanceModel";

export { calculateLatenessMinutes, type AttendanceMode } from "./attendanceModel";

export async function manualMarkAttendanceService(
  eventId: string,
  input: {
    participantId: string;
    sessionId?: string | null;
    dayId?: string | null;
    attendanceStatus: string;
    notes?: string | null;
  },
  actorUserId?: string,
  requestId?: string
) {
  const inserted = await recordAttendanceTransactionRepository({ eventId, dayId: input.dayId, sessionId: input.sessionId,
    participantId: input.participantId, attendanceStatus: input.attendanceStatus, method: "MANUAL_MARK",
    notes: input.notes || "Penandaan presensi manual oleh panitia", actorUserId, requestId });

  if (requestId) {
    await createAuditLog({
      actorUserId: actorUserId || null,
      action: "ATTENDANCE_MANUAL_MARKED",
      resourceType: "ATTENDANCE_RECORD",
      resourceId: inserted.id,
      eventId,
      reason: input.notes || `Penandaan presensi manual (${input.attendanceStatus}).`,
      requestId,
    });
  }

  return inserted;
}

export async function correctAttendanceRecordService(
  eventId: string,
  recordId: string,
  input: {
    attendanceStatus: string;
    reason: string;
  },
  actorUserId?: string,
  requestId?: string
) {
  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new ValidationError("Koreksi presensi wajib memiliki alasan yang jelas (minimal 3 karakter).");
  }

  const target = and(eq(attendanceRecords.eventId, eventId), eq(attendanceRecords.id, recordId));
  return withTransaction(async (tx) => {
    const [oldRecord] = await tx.select().from(attendanceRecords).where(target).limit(1).for("update");
    if (!oldRecord) throw new NotFoundError("Catatan presensi tidak ditemukan pada event ini.");
    const correctedAt = new Date();
    const [updated] = await tx.update(attendanceRecords).set({
      attendanceStatus: input.attendanceStatus,
      correctedAt,
      correctedBy: actorUserId || null,
      notes: `Koreksi: ${reason}`,
      updatedAt: correctedAt,
    }).where(target).returning();
    if (!updated) throw new NotFoundError("Catatan presensi tidak ditemukan pada event ini.");
    await tx.insert(auditLogs).values({
      actorUserId: actorUserId || null,
      action: "ATTENDANCE_CORRECTED",
      resourceType: "ATTENDANCE_RECORD",
      resourceId: recordId,
      eventId,
      beforeData: { status: oldRecord.attendanceStatus, notes: oldRecord.notes },
      afterData: { status: updated.attendanceStatus, notes: updated.notes },
      reason,
      requestId: requestId || "attendance-correction",
    });
    return updated;
  });
}

const recapParticipantColumns = {
  id: eventParticipants.id,
  participantCode: eventParticipants.participantCode,
  ustadzName: ustadzProfiles.fullName,
  institutionName: institutions.name,
  approvalStatus: eventParticipants.approvalStatus,
  confirmationStatus: eventParticipants.confirmationStatus,
};

const attendanceReportColumns = {
  id: attendanceRecords.id, participantId: attendanceRecords.participantId,
  eventDayId: attendanceRecords.eventDayId, eventSessionId: attendanceRecords.eventSessionId,
  attendanceStatus: attendanceRecords.attendanceStatus, checkinAt: attendanceRecords.checkinAt,
  checkinMethod: attendanceRecords.checkinMethod,
};

function summarizeReportParticipant(participant: { id: string; participantCode: string; ustadzName: string; institutionName: string | null },
  units: AttendanceUnit[], records: AttendanceRecordLike[], now: Date, blockReason: string | null, canMarkEvent: boolean) {
  const eligible = !blockReason;
  const summary = summarizeParticipantAttendance(units, records, now, eligible);
  return {
    participantId: participant.id, participantCode: participant.participantCode, ustadzName: participant.ustadzName,
    institutionName: participant.institutionName, eligible, blockReason,
    totalSessionsAttended: summary.details.filter(({ unit, status }) => unit.type === "SESSION" && ATTENDED_STATUSES.includes(status)).length,
    totalUnitsAttended: summary.attended,
    fulfilledUnits: summary.attended + summary.excused,
    requiredUnits: summary.required,
    completionPercentage: summary.completionPercentage,
    statusCategory: summary.statusCategory,
    unitStatuses: summary.details.map(({ unit, status, record }) => ({
      unitId: unit.id, type: unit.type, title: unit.title, date: unit.date, dayId: unit.dayId, sessionId: unit.sessionId,
      qrEnabled: unit.qrEnabled, status, recordId: record?.id || null,
      checkinAt: record?.checkinAt || null, checkinMethod: record?.checkinMethod || null,
      canMark: eligible && canMarkEvent && now >= unit.openAt,
    })),
  };
}

export async function getAttendanceSummaryRecapService(eventId: string) {
  const db = getDbClient();

  const schedule = await findAttendanceScheduleForEventRepository(eventId);
  if (!schedule) throw new NotFoundError("Event tidak ditemukan.");
  const units = buildRequiredAttendanceUnits(
    schedule.event.attendanceMode as AttendanceMode,
    schedule.days,
    schedule.sessions,
    schedule.event.timezone,
  );

  const [participants, records] = await Promise.all([
    db.select(recapParticipantColumns).from(eventParticipants)
      .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
      .leftJoin(institutions, eq(eventParticipants.institutionId, institutions.id))
      .where(and(eq(eventParticipants.eventId, eventId), or(
        attendanceRosterCondition(eventId, schedule.event.attendanceConfirmationRequired !== false),
        // Retain genuine history after a participant becomes ineligible, but
        // never count those rows as absences in the live/official roster.
        exists(db.select({ id: attendanceRecords.id }).from(attendanceRecords).where(and(
          eq(attendanceRecords.eventId, eventId), eq(attendanceRecords.participantId, eventParticipants.id)))),
      ))).orderBy(ustadzProfiles.fullName, eventParticipants.id),
    db.select(attendanceReportColumns).from(attendanceRecords).where(eq(attendanceRecords.eventId, eventId)),
  ]);
  const byParticipant = new Map<string, AttendanceRecordLike[]>();
  for (const record of records) {
    const existing = byParticipant.get(record.participantId);
    if (existing) existing.push(record);
    else byParticipant.set(record.participantId, [record]);
  }
  const now = new Date();
  const participantDetails = participants.map((participant) => summarizeReportParticipant(participant, units,
    byParticipant.get(participant.id) || [], now, participantCheckinBlockReason(participant, schedule.event), false));
  const eligibleParticipants = participantDetails.filter((item) => item.eligible);

  return {
    eventId,
    attendanceMode: schedule.event.attendanceMode,
    totalParticipants: eligibleParticipants.length,
    historicalParticipantCount: participants.length - eligibleParticipants.length,
    requiredUnits: units.map((unit) => ({
      id: unit.id,
      type: unit.type,
      title: unit.title,
      date: unit.date,
      dayId: unit.dayId,
      sessionId: unit.sessionId,
      qrEnabled: unit.qrEnabled,
    })),
    recapSummary: {
      fullAttendance: eligibleParticipants.filter((item) => item.statusCategory === "HADIR_PENUH").length,
      partialAttendance: eligibleParticipants.filter((item) => item.statusCategory === "HADIR_SEBAGIAN").length,
      lateAttendance: eligibleParticipants.filter((item) =>
        item.unitStatuses.some((unit) => unit.status === "LATE"),
      ).length,
      excused: eligibleParticipants.filter((item) =>
        item.unitStatuses.some((unit) => EXCUSED_STATUSES.includes(unit.status)),
      ).length,
      absent: eligibleParticipants.filter((item) => item.statusCategory === "TIDAK_HADIR").length,
    },
    participantDetails,
  };
}

export async function getParticipantAttendanceReportService(eventId: string, participantId: string) {
  const db = getDbClient();
  const participant = (await db
    .select({
      ...recapParticipantColumns,
      registrationSource: eventParticipants.registrationSource,
    })
    .from(eventParticipants)
    .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
    .leftJoin(institutions, eq(eventParticipants.institutionId, institutions.id))
    .where(and(eq(eventParticipants.id, participantId), eq(eventParticipants.eventId, eventId)))
    .limit(1))[0];
  if (!participant) throw new NotFoundError("Peserta tidak ditemukan pada event ini.");
  const [schedule, [eventRecord], records] = await Promise.all([
    findAttendanceScheduleForEventRepository(eventId),
    db.select({ id: events.id, code: events.code, name: events.name, startDate: events.startDate, endDate: events.endDate,
      venueName: events.venueName, attendanceMode: events.attendanceMode, timezone: events.timezone,
    }).from(events).where(eq(events.id, eventId)).limit(1),
    db.select(attendanceReportColumns).from(attendanceRecords)
      .where(and(eq(attendanceRecords.eventId, eventId), eq(attendanceRecords.participantId, participantId)))
      .orderBy(desc(attendanceRecords.checkinAt)),
  ]);
  if (!schedule || !eventRecord) throw new NotFoundError("Event tidak ditemukan.");
  const units = buildRequiredAttendanceUnits(schedule.event.attendanceMode as AttendanceMode,
    schedule.days, schedule.sessions, schedule.event.timezone);
  const now = new Date();
  const canMarkEvent = !schedule.event.archivedAt && [...CHECKIN_EVENT_STATUSES, "COMPLETED"].includes(schedule.event.status);
  const attendance = summarizeReportParticipant(participant, units, records, now, participantCheckinBlockReason(participant, schedule.event), canMarkEvent);
  return {
    generatedAt: now,
    event: eventRecord,
    participant,
    attendance,
  };
}
