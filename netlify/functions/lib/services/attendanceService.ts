import {
  findAttendanceScheduleForEventRepository,
  recordCheckinLogRepository,
  recordCheckinTransactionRepository,
  getRecentCheckinLogsRepository,
} from "../repositories/attendanceRepository";
import { verifyQrTokenForCheckinService } from "./participantQrService";
import { NotFoundError, ValidationError } from "../utils/errors";
import { AttendanceMode } from "./attendanceModel";

type CheckinUnit = {
  id: string;
  type: "DAY" | "SESSION";
  dayId: string;
  sessionId: string | null;
  title: string;
  date: string;
  openAt: Date;
  closeAt: Date;
  isOpen: boolean;
};

function dateKeyInTimeZone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function zonedDate(dateKey: string, time: string, timezone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute, second] = time.split(":").map(Number);
  const provisional = new Date(Date.UTC(year, month - 1, day, hour, minute, second || 0));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(provisional);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  const represented = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    read("second"),
  );
  return new Date(provisional.getTime() - (represented - provisional.getTime()));
}

export async function getAttendanceCheckinUnitsService(eventId: string, now = new Date()) {
  const schedule = await findAttendanceScheduleForEventRepository(eventId);
  if (!schedule) throw new NotFoundError(`Event ID ${eventId} tidak ditemukan.`);
  const mode = schedule.event.attendanceMode as AttendanceMode;
  const units: CheckinUnit[] = [];

  if (mode === "DAILY_ONLY" || mode === "DAILY_AND_SESSION") {
    for (const day of schedule.days) {
      const openAt = day.checkinOpenAt || zonedDate(day.date, "00:00:00", schedule.event.timezone);
      const closeAt = day.checkinCloseAt || zonedDate(day.date, "23:59:59", schedule.event.timezone);
      units.push({
        id: `DAY:${day.id}`,
        type: "DAY",
        dayId: day.id,
        sessionId: null,
        title: day.title || `Kehadiran harian · Hari ${day.dayNumber}`,
        date: day.date,
        openAt,
        closeAt,
        isOpen: now >= openAt && now <= closeAt,
      });
    }
  }

  if (mode === "SESSION_ONLY" || mode === "DAILY_AND_SESSION") {
    const dayDates = new Map(schedule.days.map((day) => [day.id, day.date]));
    for (const session of schedule.sessions.filter((item) => item.attendanceRequired && item.checkinRequired)) {
      const openAt = session.checkinOpenAt || new Date(session.startAt.getTime() - 60 * 60 * 1000);
      const closeAt = session.checkinCloseAt || new Date(session.endAt.getTime() + 60 * 60 * 1000);
      units.push({
        id: `SESSION:${session.id}`,
        type: "SESSION",
        dayId: session.eventDayId,
        sessionId: session.id,
        title: session.title,
        date: dayDates.get(session.eventDayId) || dateKeyInTimeZone(session.startAt, schedule.event.timezone),
        openAt,
        closeAt,
        isOpen: now >= openAt && now <= closeAt,
      });
    }
  }

  return {
    eventId,
    attendanceMode: mode,
    timezone: schedule.event.timezone,
    units,
    openUnits: units.filter((unit) => unit.isOpen),
  };
}

export async function getActiveSessionService(eventId: string) {
  const schedule = await getAttendanceCheckinUnitsService(eventId);
  const active =
    schedule.openUnits.find((unit) => unit.type === "SESSION") ||
    schedule.openUnits[0] ||
    schedule.units[0];
  if (!active) throw new NotFoundError(`Unit kehadiran untuk Event ID ${eventId} belum diatur.`);
  return {
    unit: active,
    session: active.type === "SESSION" ? active : null,
    attendanceMode: schedule.attendanceMode,
    units: schedule.units,
    checkinWindow: { isOpen: active.isOpen, openAt: active.openAt, closeAt: active.closeAt },
  };
}

export async function processOnSiteCheckinService(
  eventId: string,
  qrTokenOrCode: string,
  method: string,
  actorUserId?: string,
  requestId = "req-checkin",
  selection?: { sessionId?: string | null; dayId?: string | null },
) {
  const schedule = await getAttendanceCheckinUnitsService(eventId);
  const requestedUnit = selection?.sessionId
    ? schedule.units.find((unit) => unit.sessionId === selection.sessionId)
    : selection?.dayId
      ? schedule.units.find((unit) => unit.type === "DAY" && unit.dayId === selection.dayId)
      : null;
  const unit = requestedUnit ||
    schedule.openUnits.find((item) => item.type === "SESSION") ||
    schedule.openUnits[0];

  if ((selection?.sessionId || selection?.dayId) && !requestedUnit) {
    throw new ValidationError("Unit kehadiran yang dipilih tidak termasuk dalam event ini.");
  }
  if (!unit) throw new ValidationError("Belum ada unit kehadiran yang sedang membuka check-in.");
  if (!unit.isOpen) {
    await recordCheckinLogRepository({
      eventId,
      eventSessionId: unit.sessionId,
      method,
      result: "FAILED",
      failureReason: "Jendela check-in unit kehadiran belum dibuka atau telah ditutup.",
      scannedBy: actorUserId,
      requestId,
      metadata: { attendanceUnitId: unit.id, dayId: unit.dayId },
    });
    throw new ValidationError(`Jendela check-in '${unit.title}' belum dibuka atau telah ditutup.`);
  }

  let verified;
  try {
    verified = await verifyQrTokenForCheckinService(eventId, qrTokenOrCode, actorUserId, requestId);
  } catch (error: any) {
    await recordCheckinLogRepository({
      eventId,
      eventSessionId: unit.sessionId,
      method,
      result: "FAILED",
      failureReason: error.message || "Token QR atau kode tidak valid",
      scannedBy: actorUserId,
      requestId,
      metadata: { attendanceUnitId: unit.id, dayId: unit.dayId },
    });
    throw error;
  }

  const participant = verified.participant;
  try {
    const record = await recordCheckinTransactionRepository({
      eventId,
      dayId: unit.dayId,
      sessionId: unit.sessionId,
      participantId: participant.id,
      method,
      actorUserId,
      requestId,
    });
    return {
      status: "SUCCESS",
      checkinAt: record.checkinAt,
      participant: {
        id: participant.id,
        participantCode: participant.participantCode,
        ustadzName: participant.ustadzName,
        confirmationStatus: participant.confirmationStatus,
      },
      attendanceUnit: unit,
      sessionTitle: unit.title,
    };
  } catch (error: any) {
    const isDuplicate = error.message?.includes("DUPLICATE");
    await recordCheckinLogRepository({
      eventId,
      participantId: participant.id,
      eventSessionId: unit.sessionId,
      method,
      result: isDuplicate ? "DUPLICATE" : "FAILED",
      failureReason: error.message,
      scannedBy: actorUserId,
      requestId,
      metadata: { attendanceUnitId: unit.id, dayId: unit.dayId },
    });
    if (isDuplicate) {
      throw new ValidationError(
        `Presensi ganda ditolak: ${participant.participantCode} sudah tercatat pada '${unit.title}'.`,
      );
    }
    throw error;
  }
}

export async function getRecentCheckinLogsService(eventId: string, limitCount = 20) {
  return getRecentCheckinLogsRepository(eventId, limitCount);
}
