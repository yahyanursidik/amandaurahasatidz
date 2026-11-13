import { getDbClient } from "../db/client";
import { withTransaction } from "../db/transaction";
import {
  eventSessions,
  eventDays,
  events,
  attendanceRecords,
  checkinTokens,
  checkinLogs,
  eventKioskDevices,
  eventParticipants,
  ustadzProfiles,
  institutions,
} from "../db/schema";
import { eq, and, desc, isNull, asc, lte, gt, inArray, notInArray, or, sql, type SQL } from "drizzle-orm";
import { assertParticipantEligibleForCheckin } from "../services/deadlineService";
import {
  ATTENDANCE_INACTIVE_CONFIRMATIONS, ATTENDED_STATUSES, CHECKIN_EVENT_STATUSES, EXCUSED_STATUSES, buildRequiredAttendanceUnits,
  calculateLatenessMinutes, findAttendanceUnit, isAttendanceEventOpen, isAttendanceWindowOpen, toCheckinUnit,
  type AttendanceMode, type AttendanceUnitSelection,
} from "../services/attendanceModel";
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from "../utils/errors";
import { portalProfileOwnership } from "./portalProfileRepository";

export class DuplicateAttendanceError extends ConflictError {
  constructor() { super("Peserta sudah memiliki catatan pada hari atau sesi ini."); }
}

export function attendanceEligibilityCondition(confirmationRequired: boolean | SQL) {
  return and(eq(eventParticipants.approvalStatus, "APPROVED"),
    notInArray(eventParticipants.confirmationStatus, ATTENDANCE_INACTIVE_CONFIRMATIONS),
    confirmationRequired === false ? undefined : or(
      eq(eventParticipants.confirmationStatus, "CONFIRMED"),
      confirmationRequired === true ? undefined : sql`${confirmationRequired} is false`,
    ))!;
}

export function attendanceRosterCondition(eventId: string, confirmationRequired: boolean) {
  return and(eq(eventParticipants.eventId, eventId), attendanceEligibilityCondition(confirmationRequired))!;
}

/** Whole-event no-show is decided after completion, not while future units are still pending. */
export function eventNoShowCondition(eventId?: string) {
  return and(eventId ? eq(eventParticipants.eventId, eventId) : undefined, eq(events.status, "COMPLETED"),
    attendanceEligibilityCondition(sql`${events.attendanceConfirmationRequired}`),
    sql`exists (
      select 1 from ${eventDays} d where d.event_id = ${events.id}
        and (${events.attendanceMode} <> 'SESSION_ONLY' or exists (
          select 1 from ${eventSessions} s where s.event_day_id = d.id and s.attendance_required
        ))
    )`,
    sql`not exists (
      select 1 from ${attendanceRecords} ar where ar.event_id = ${events.id}
        and ar.participant_id = ${eventParticipants.id}
        and ar.attendance_status in (${sql.join([...ATTENDED_STATUSES, ...EXCUSED_STATUSES].map((status) => sql`${status}`), sql`, `)})
    )`,
  )!;
}

export async function eventHasAttendanceRecords(db: ReturnType<typeof getDbClient>, eventId: string) {
  const [record] = await db.select({ id: attendanceRecords.id }).from(attendanceRecords)
    .where(eq(attendanceRecords.eventId, eventId)).limit(1);
  return Boolean(record);
}

export async function findAttendanceScheduleForEventRepository(eventId: string, db = getDbClient(), lockEvent = false) {
  const eventQuery = db
    .select({
      id: events.id,
      attendanceMode: events.attendanceMode,
      timezone: events.timezone,
      status: events.status,
      archivedAt: events.archivedAt,
      attendanceConfirmationRequired: events.attendanceConfirmationRequired,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  // Schedule edits take an exclusive lock on the same event row. A scan can
  // never record against a mode, session, or window that changed mid-request.
  const [event] = await (lockEvent ? eventQuery.for("share") : eventQuery);
  if (!event) return null;
  const days = await db
    .select()
    .from(eventDays)
    .where(eq(eventDays.eventId, eventId))
    .orderBy(asc(eventDays.dayNumber));
  const sessions = await db
    .select({
      id: eventSessions.id,
      eventDayId: eventSessions.eventDayId,
      title: eventSessions.title,
      startAt: eventSessions.startAt,
      endAt: eventSessions.endAt,
      attendanceRequired: eventSessions.attendanceRequired,
      checkinRequired: eventSessions.checkinRequired,
      checkinOpenAt: eventSessions.checkinOpenAt,
      checkinCloseAt: eventSessions.checkinCloseAt,
    })
    .from(eventSessions)
    .innerJoin(eventDays, eq(eventSessions.eventDayId, eventDays.id))
    .where(eq(eventDays.eventId, eventId))
    .orderBy(asc(eventSessions.startAt));
  return { event, days, sessions };
}

/** A real, QR-enabled window can still be open after the event's final calendar date. */
export async function isAttendanceQrEventOpen(eventId: string, event: Parameters<typeof isAttendanceEventOpen>[0], now = new Date()) {
  if (event.archivedAt || !CHECKIN_EVENT_STATUSES.includes(event.status)) return false;
  if (isAttendanceEventOpen(event, now)) return true;
  const schedule = await findAttendanceScheduleForEventRepository(eventId);
  return Boolean(schedule && !schedule.event.archivedAt && CHECKIN_EVENT_STATUSES.includes(schedule.event.status)
    && buildRequiredAttendanceUnits(schedule.event.attendanceMode as AttendanceMode, schedule.days, schedule.sessions,
      schedule.event.timezone).some((unit) => unit.qrEnabled && isAttendanceWindowOpen(unit, now)));
}

export async function findActiveSessionForEventRepository(eventId: string) {
  const db = getDbClient();
  const sessions = await db
    .select({
      id: eventSessions.id,
      dayId: eventSessions.eventDayId,
      title: eventSessions.title,
      startAt: eventSessions.startAt,
      endAt: eventSessions.endAt,
      checkinOpenAt: eventSessions.checkinOpenAt,
      checkinCloseAt: eventSessions.checkinCloseAt,
    })
    .from(eventSessions)
    .innerJoin(eventDays, eq(eventSessions.eventDayId, eventDays.id))
    .where(eq(eventDays.eventId, eventId))
    .orderBy(eventSessions.startAt);

  const now = new Date();

  // Find session where current time is within checkin window
  const activeWindowSession = sessions.find((s) => {
    const open = s.checkinOpenAt ? new Date(s.checkinOpenAt) : new Date(s.startAt.getTime() - 60 * 60000);
    const close = s.checkinCloseAt ? new Date(s.checkinCloseAt) : new Date(s.endAt.getTime() + 60 * 60000);
    return now >= open && now <= close;
  });

  return activeWindowSession || sessions[0] || null;
}

export async function recordCheckinLogRepository(data: {
  eventId: string;
  participantId?: string | null;
  eventSessionId?: string | null;
  method: string;
  result: "SUCCESS" | "FAILED" | "DUPLICATE";
  failureReason?: string | null;
  scannedBy?: string | null;
  requestId?: string | null;
  metadata?: any;
}) {
  const db = getDbClient();
  return await db.insert(checkinLogs).values({
    eventId: data.eventId,
    participantId: data.participantId || null,
    eventSessionId: data.eventSessionId || null,
    method: data.method,
    result: data.result,
    failureReason: data.failureReason || null,
    scannedBy: data.scannedBy || null,
    requestId: data.requestId || null,
    metadata: data.metadata || null,
  }).returning();
}

export async function recordAttendanceTransactionRepository(data: AttendanceUnitSelection & {
  eventId: string;
  participantId?: string;
  method: string;
  attendanceStatus?: string;
  notes?: string | null;
  actorUserId?: string;
  requestId?: string;
  sourceDevice?: string;
  expectedQrTokenVersion?: number;
  locationTokenHash?: string;
}) {
  return await withTransaction(async (tx) => {
    const isSelfScan = data.method === "SELF_SCAN";
    if (isSelfScan && (!data.actorUserId || !data.locationTokenHash)) {
      throw new UnauthorizedError("Check-in mandiri memerlukan login dan QR Lokasi.");
    }
    if (!isSelfScan && !data.participantId) throw new ValidationError("Peserta belum dipilih.");
    const schedule = await findAttendanceScheduleForEventRepository(data.eventId, tx, true);
    if (!schedule) throw new NotFoundError("Event presensi tidak ditemukan.");
    const { event } = schedule;
    const manual = data.method === "MANUAL_MARK";
    if (event.archivedAt || (!CHECKIN_EVENT_STATUSES.includes(event.status) && !(manual && event.status === "COMPLETED"))) {
      throw new ConflictError("Presensi tidak dapat dicatat pada status event ini.");
    }
    const units = buildRequiredAttendanceUnits(event.attendanceMode as AttendanceMode, schedule.days, schedule.sessions, event.timezone);
    const selected = Boolean(data.sessionId || data.dayId);
    const nowAtSelection = new Date();
    const openUnits = units.filter((unit) => unit.qrEnabled && isAttendanceWindowOpen(unit, nowAtSelection));
    const unit = selected ? findAttendanceUnit(units, data) : !manual && openUnits.length === 1 ? openUnits[0] : undefined;
    if (!unit) throw new ValidationError(selected ? "Hari atau sesi ini bukan unit presensi event tersebut."
      : openUnits.length > 1 ? "Beberapa unit sedang dibuka. Pilih hari atau sesi terlebih dahulu."
        : "Belum ada unit kehadiran yang sedang membuka check-in.");

    // Recheck while holding the participant row: a public "Berhalangan" response
    // cannot race a QR scan and leave an attendance record on a cancelled seat.
    const [participant] = await tx.select().from(eventParticipants)
      .where(and(eq(eventParticipants.eventId, data.eventId), isSelfScan
        ? inArray(eventParticipants.ustadzId, tx.select({ id: ustadzProfiles.id }).from(ustadzProfiles)
          .where(and(portalProfileOwnership(data.actorUserId!), isNull(ustadzProfiles.deletedAt), isNull(ustadzProfiles.mergedIntoId))))
        : eq(eventParticipants.id, data.participantId!)))
      .limit(1).for("update");
    if (!participant) throw new NotFoundError("Peserta tidak ditemukan pada event ini.");
    assertParticipantEligibleForCheckin(participant, event);
    if (data.expectedQrTokenVersion !== undefined && participant.qrTokenVersion !== data.expectedQrTokenVersion) {
      throw new ValidationError("Token QR peserta sudah dirotasi. Minta peserta membuka kartu terbaru.");
    }
    const now = new Date();
    if (!manual && (!unit.qrEnabled || !isAttendanceWindowOpen(unit, now))) {
      throw new ValidationError(unit.qrEnabled ? `Jendela check-in '${unit.title}' belum dibuka atau telah ditutup.`
        : "Unit ini menggunakan pencatatan manual. Buka rapor peserta untuk mencatat.");
    }
    if (manual && now < unit.openAt) throw new ValidationError("Unit belum dimulai. Catat presensi setelah jendelanya dibuka.");

    if (data.sourceDevice) {
      const [device] = await tx.select({ expiresAt: eventKioskDevices.deviceExpiresAt }).from(eventKioskDevices)
        .where(and(eq(eventKioskDevices.id, data.sourceDevice), eq(eventKioskDevices.eventId, data.eventId),
          isNull(eventKioskDevices.revokedAt), gt(eventKioskDevices.deviceExpiresAt, now))).limit(1).for("share");
      if (!device?.expiresAt || device.expiresAt <= new Date()) throw new UnauthorizedError("Perangkat kiosk tidak lagi aktif.");
    }

    if (data.locationTokenHash) {
      const unitScope = unit.sessionId ? eq(checkinTokens.eventSessionId, unit.sessionId)
        : and(eq(checkinTokens.eventDayId, unit.dayId), isNull(checkinTokens.eventSessionId));
      const [token] = await tx.select({ validUntil: checkinTokens.validUntil }).from(checkinTokens).where(and(
        eq(checkinTokens.eventId, data.eventId), unitScope, eq(checkinTokens.tokenHash, data.locationTokenHash),
        isNull(checkinTokens.revokedAt), lte(checkinTokens.validFrom, now), gt(checkinTokens.validUntil, now),
      )).limit(1).for("share");
      if (!token || token.validUntil <= new Date()) throw new ValidationError("QR lokasi sudah kedaluwarsa atau tidak sesuai. Pindai QR terbaru di lokasi.");
    }
    const unitCondition = unit.sessionId
      ? eq(attendanceRecords.eventSessionId, unit.sessionId)
      : and(
          eq(attendanceRecords.eventDayId, unit.dayId),
          isNull(attendanceRecords.eventSessionId),
        );
    const existing = await tx
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.eventId, data.eventId),
          eq(attendanceRecords.participantId, participant.id),
          unitCondition,
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw new DuplicateAttendanceError();
    }

    let inserted;
    try {
      inserted = await tx
        .insert(attendanceRecords)
        .values({
          eventId: data.eventId,
          eventDayId: unit.dayId,
          eventSessionId: unit.sessionId,
          participantId: participant.id,
          attendanceStatus: data.attendanceStatus || (unit.startsAt && calculateLatenessMinutes(now, unit.startsAt).isLate ? "LATE" : "PRESENT"),
          checkinAt: now,
          checkinMethod: data.method,
          sourceDevice: data.sourceDevice || null,
          notes: data.notes || null,
          recordedBy: data.actorUserId || null,
        })
        .returning();
    } catch (error: any) {
      if (error?.code === "23505" || error?.cause?.code === "23505" || error?.message?.includes("uniq_attendance_part_")) {
        throw new DuplicateAttendanceError();
      }
      throw error;
    }

    // 3. Log success
    await tx.insert(checkinLogs).values({
      eventId: data.eventId,
      participantId: participant.id,
      eventSessionId: unit.sessionId,
      method: data.method,
      result: "SUCCESS",
      scannedBy: data.actorUserId || null,
      requestId: data.requestId || null,
      metadata: { attendanceUnitId: unit.id, dayId: unit.dayId, ...(data.sourceDevice && { kioskDeviceId: data.sourceDevice }) },
    });

    return { ...inserted[0], participantCode: participant.participantCode,
      attendanceUnit: toCheckinUnit(unit, now, !manual), timezone: event.timezone };
  });
}

export async function recordCheckinTransactionRepository(data: AttendanceUnitSelection & {
  eventId: string;
  participantId?: string;
  method: string;
  actorUserId?: string;
  requestId?: string;
  sourceDevice?: string;
  expectedQrTokenVersion?: number;
  locationTokenHash?: string;
}) {
  return recordAttendanceTransactionRepository(data);
}

export async function getRecentCheckinLogsRepository(eventId: string, limitCount = 20) {
  const db = getDbClient();
  return await db
    .select({
      id: checkinLogs.id,
      result: checkinLogs.result,
      method: checkinLogs.method,
      failureReason: checkinLogs.failureReason,
      createdAt: checkinLogs.createdAt,
      participantCode: eventParticipants.participantCode,
      ustadzName: ustadzProfiles.fullName,
      institutionName: institutions.name,
      metadata: checkinLogs.metadata,
    })
    .from(checkinLogs)
    .leftJoin(eventParticipants, eq(checkinLogs.participantId, eventParticipants.id))
    .leftJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
    .leftJoin(institutions, eq(eventParticipants.institutionId, institutions.id))
    .where(eq(checkinLogs.eventId, eventId))
    .orderBy(desc(checkinLogs.createdAt))
    .limit(limitCount);
}
