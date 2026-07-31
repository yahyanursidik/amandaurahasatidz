import { getDbClient } from "../db/client";
import { attendanceRecords, eventParticipants, ustadzProfiles, institutions, events } from "../db/schema";
import { eq, and, count } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../utils/errors";
import { createAuditLog } from "./auditService";
import { assertParticipantEligibleForCheckin } from "./deadlineService";

export type AttendanceMode = "DAILY" | "SESSION" | "DAILY_AND_SESSION" | "CHECKIN_CHECKOUT";

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

  const inserted = await db
    .insert(attendanceRecords)
    .values({
      eventId,
      eventSessionId: input.sessionId || null,
      eventDayId: input.dayId || null,
      participantId: input.participantId,
      attendanceStatus: input.attendanceStatus,
      checkinAt: new Date(),
      checkinMethod: "MANUAL_MARK",
      notes: input.notes || "Penandaan presensi manual oleh panitia",
      recordedBy: actorUserId || null,
    })
    .returning();

  if (requestId) {
    await createAuditLog({
      actorUserId: actorUserId || null,
      action: "ATTENDANCE_MANUAL_MARKED",
      resourceType: "ATTENDANCE_RECORD",
      resourceId: inserted[0].id,
      eventId,
      reason: input.notes || `Penandaan presensi manual (${input.attendanceStatus}).`,
      requestId,
    });
  }

  return inserted[0];
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

  let fullAttendanceCount = 0;
  let partialAttendanceCount = 0;
  let lateAttendanceCount = 0;
  let excusedCount = 0;
  let absentCount = 0;

  for (const p of participants) {
    const pRecords = records.filter((r) => r.participantId === p.id);
    const presentRecords = pRecords.filter((r) => r.attendanceStatus === "PRESENT");
    const lateRecords = pRecords.filter((r) => r.attendanceStatus === "LATE");
    const excusedRecords = pRecords.filter((r) => r.attendanceStatus === "EXCUSED" || r.attendanceStatus === "PERMITTED");

    if (lateRecords.length > 0) lateAttendanceCount++;
    if (excusedRecords.length > 0) excusedCount++;

    if (presentRecords.length >= 2) {
      fullAttendanceCount++;
    } else if (presentRecords.length === 1) {
      partialAttendanceCount++;
    } else if (excusedRecords.length === 0 && lateRecords.length === 0) {
      absentCount++;
    }
  }

  return {
    eventId,
    totalParticipants: participants.length,
    recapSummary: {
      fullAttendance: fullAttendanceCount,
      partialAttendance: partialAttendanceCount,
      lateAttendance: lateAttendanceCount,
      excused: excusedCount,
      absent: absentCount,
    },
    participantDetails: participants.map((p) => {
      const pRecs = records.filter((r) => r.participantId === p.id);
      return {
        participantId: p.id,
        participantCode: p.participantCode,
        ustadzName: p.ustadzName,
        institutionName: p.institutionName,
        totalSessionsAttended: pRecs.filter((r) => r.attendanceStatus === "PRESENT").length,
        statusCategory: pRecs.length > 0 ? "HADIR" : "TIDAK_HADIR",
      };
    }),
  };
}
