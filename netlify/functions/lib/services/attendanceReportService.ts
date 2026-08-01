import { getDbClient } from "../db/client";
import { attendanceRecords, eventParticipants, ustadzProfiles, institutions, events } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../utils/errors";
import { createAuditLog } from "./auditService";
import { assertParticipantEligibleForCheckin } from "./deadlineService";
import {
  findAttendanceScheduleForEventRepository,
  recordAttendanceTransactionRepository,
} from "../repositories/attendanceRepository";
import {
  AttendanceMode,
  buildRequiredAttendanceUnits,
  summarizeParticipantAttendance,
} from "./attendanceModel";

export type { AttendanceMode } from "./attendanceModel";

export function calculateLatenessMinutes(
  checkinAt: Date,
  sessionStartAt: Date,
  gracePeriodMinutes = 15
): { isLate: boolean; latenessMinutes: number } {
  const diffMs = checkinAt.getTime() - sessionStartAt.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes > gracePeriodMinutes) {
    return { isLate: true, latenessMinutes: diffMinutes };
  }

  return { isLate: false, latenessMinutes: Math.max(0, diffMinutes) };
}

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
  const db = getDbClient();
  const participant = (await db.select().from(eventParticipants).where(and(
    eq(eventParticipants.id, input.participantId),
    eq(eventParticipants.eventId, eventId)
  )).limit(1))[0];
  const eventRecord = (await db.select().from(events).where(eq(events.id, eventId)).limit(1))[0];
  if (!participant || !eventRecord) throw new NotFoundError("Peserta atau event tidak ditemukan.");
  assertParticipantEligibleForCheckin(participant, eventRecord);
  const schedule = await findAttendanceScheduleForEventRepository(eventId);
  if (!schedule) throw new NotFoundError("Jadwal event tidak ditemukan.");
  const mode = schedule.event.attendanceMode as AttendanceMode;
  let dayId = input.dayId || null;
  if (input.sessionId) {
    const targetSession = schedule.sessions.find((session) => session.id === input.sessionId);
    if (!targetSession) throw new ValidationError("Sesi tidak termasuk dalam event ini.");
    dayId = targetSession.eventDayId;
    if (mode === "DAILY_ONLY") {
      throw new ValidationError("Event ini menggunakan presensi harian; pilih hari kegiatan.");
    }
  } else {
    if (!dayId || !schedule.days.some((day) => day.id === dayId)) {
      throw new ValidationError("Hari kegiatan tidak termasuk dalam event ini.");
    }
    if (mode === "SESSION_ONLY") {
      throw new ValidationError("Event ini menggunakan presensi per sesi; pilih sesi kegiatan.");
    }
  }

  let inserted;
  try {
    inserted = await recordAttendanceTransactionRepository({
      eventId,
      dayId,
      sessionId: input.sessionId || null,
      participantId: input.participantId,
      attendanceStatus: input.attendanceStatus,
      method: "MANUAL_MARK",
      notes: input.notes || "Penandaan presensi manual oleh panitia",
      actorUserId,
      requestId,
    });
  } catch (error: any) {
    if (error?.message?.includes("DUPLICATE")) {
      throw new ValidationError("Peserta sudah memiliki catatan pada hari atau sesi tersebut.");
    }
    throw error;
  }

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
  recordId: string,
  input: {
    attendanceStatus: string;
    reason: string;
  },
  actorUserId?: string,
  requestId?: string
) {
  if (!input.reason || input.reason.trim().length < 3) {
    throw new ValidationError("Koreksi presensi wajib memiliki alasan yang jelas (minimal 3 karakter).");
  }

  const db = getDbClient();
  const existing = await db
    .select()
    .from(attendanceRecords)
    .where(eq(attendanceRecords.id, recordId))
    .limit(1);

  if (existing.length === 0) {
    throw new NotFoundError(`Record presensi ID ${recordId} tidak ditemukan.`);
  }

  const oldRecord = existing[0];

  const updated = await db
    .update(attendanceRecords)
    .set({
      attendanceStatus: input.attendanceStatus,
      correctedAt: new Date(),
      correctedBy: actorUserId || null,
      notes: `Koreksi: ${input.reason}`,
      updatedAt: new Date(),
    })
    .where(eq(attendanceRecords.id, recordId))
    .returning();

  if (requestId) {
    await createAuditLog({
      actorUserId: actorUserId || null,
      action: "ATTENDANCE_CORRECTED",
      resourceType: "ATTENDANCE_RECORD",
      resourceId: recordId,
      eventId: oldRecord.eventId,
      beforeData: { status: oldRecord.attendanceStatus, notes: oldRecord.notes },
      afterData: { status: input.attendanceStatus, notes: input.reason },
      reason: input.reason,
      requestId,
    });
  }

  return updated[0];
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

  const participants = await db
    .select({
      id: eventParticipants.id,
      participantCode: eventParticipants.participantCode,
      ustadzName: ustadzProfiles.fullName,
      institutionName: institutions.name,
    })
    .from(eventParticipants)
    .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
    .leftJoin(institutions, eq(eventParticipants.institutionId, institutions.id))
    .where(eq(eventParticipants.eventId, eventId));

  const records = await db
    .select()
    .from(attendanceRecords)
    .where(eq(attendanceRecords.eventId, eventId));

  const participantDetails = participants.map((participant) => {
    const participantRecords = records.filter((record) => record.participantId === participant.id);
    const summary = summarizeParticipantAttendance(units, participantRecords);
    return {
      participantId: participant.id,
      participantCode: participant.participantCode,
      ustadzName: participant.ustadzName,
      institutionName: participant.institutionName,
      totalSessionsAttended: participantRecords.filter(
        (record) => record.eventSessionId && ["PRESENT", "LATE"].includes(record.attendanceStatus),
      ).length,
      totalUnitsAttended: summary.attended,
      fulfilledUnits: summary.attended + summary.excused,
      requiredUnits: summary.required,
      completionPercentage: summary.completionPercentage,
      statusCategory: summary.statusCategory,
      unitStatuses: summary.details.map(({ unit, status }) => ({
        unitId: unit.id,
        type: unit.type,
        title: unit.title,
        date: unit.date,
        status,
      })),
    };
  });

  return {
    eventId,
    attendanceMode: schedule.event.attendanceMode,
    totalParticipants: participants.length,
    requiredUnits: units.map((unit) => ({
      id: unit.id,
      type: unit.type,
      title: unit.title,
      date: unit.date,
      dayId: unit.dayId,
      sessionId: unit.sessionId,
    })),
    recapSummary: {
      fullAttendance: participantDetails.filter((item) => item.statusCategory === "HADIR_PENUH").length,
      partialAttendance: participantDetails.filter((item) => item.statusCategory === "HADIR_SEBAGIAN").length,
      lateAttendance: participantDetails.filter((item) =>
        item.unitStatuses.some((unit) => unit.status === "LATE"),
      ).length,
      excused: participantDetails.filter((item) =>
        item.unitStatuses.some((unit) => ["EXCUSED", "PERMITTED"].includes(unit.status)),
      ).length,
      absent: participantDetails.filter((item) => item.statusCategory === "TIDAK_HADIR").length,
    },
    participantDetails,
  };
}

export async function getParticipantAttendanceReportService(eventId: string, participantId: string) {
  const db = getDbClient();
  const participant = (await db
    .select({
      id: eventParticipants.id,
      participantCode: eventParticipants.participantCode,
      registrationSource: eventParticipants.registrationSource,
      confirmationStatus: eventParticipants.confirmationStatus,
      approvalStatus: eventParticipants.approvalStatus,
      ustadzName: ustadzProfiles.fullName,
      institutionName: institutions.name,
    })
    .from(eventParticipants)
    .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
    .leftJoin(institutions, eq(eventParticipants.institutionId, institutions.id))
    .where(and(eq(eventParticipants.id, participantId), eq(eventParticipants.eventId, eventId)))
    .limit(1))[0];
  if (!participant) throw new NotFoundError("Peserta tidak ditemukan pada event ini.");
  const eventRecord = (await db.select().from(events).where(eq(events.id, eventId)).limit(1))[0];
  if (!eventRecord) throw new NotFoundError("Event tidak ditemukan.");
  const recap = await getAttendanceSummaryRecapService(eventId);
  const attendance = recap.participantDetails.find((item) => item.participantId === participantId);
  if (!attendance) throw new NotFoundError("Rekap peserta tidak ditemukan.");
  return {
    generatedAt: new Date(),
    event: {
      id: eventRecord.id,
      code: eventRecord.code,
      name: eventRecord.name,
      startDate: eventRecord.startDate,
      endDate: eventRecord.endDate,
      venueName: eventRecord.venueName,
      attendanceMode: eventRecord.attendanceMode,
      timezone: eventRecord.timezone,
    },
    participant,
    attendance,
  };
}
