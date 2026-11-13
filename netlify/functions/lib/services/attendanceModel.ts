import { ATTENDANCE_EVENT_STATUSES } from "../../../../src/lib/registrationStatus";

export type AttendanceMode = "DAILY_ONLY" | "SESSION_ONLY" | "DAILY_AND_SESSION";
export const CLOSED_EVENT_STATUSES = ["COMPLETED", "CANCELLED", "ARCHIVED"];
export {
  ATTENDANCE_EVENT_STATUSES as CHECKIN_EVENT_STATUSES,
  INACTIVE_CONFIRMATION_STATUSES as ATTENDANCE_INACTIVE_CONFIRMATIONS,
} from "../../../../src/lib/registrationStatus";
export const ATTENDED_STATUSES = ["PRESENT", "LATE"];
export const EXCUSED_STATUSES = ["EXCUSED", "PERMITTED"];

export type AttendanceUnitSelection = { dayId?: string | null; sessionId?: string | null };

export type AttendanceUnit = {
  id: string;
  type: "DAY" | "SESSION";
  dayId: string;
  sessionId: string | null;
  date: string;
  title: string;
  startsAt: Date | null;
  openAt: Date;
  endsAt: Date;
  qrEnabled: boolean;
};

export type AttendanceRecordLike = {
  eventDayId?: string | null;
  eventSessionId?: string | null;
  attendanceStatus: string;
  id?: string;
  checkinAt?: Date | null;
  checkinMethod?: string | null;
};

type DayLike = { id: string; dayNumber: number; date: string; title?: string | null; checkinOpenAt?: Date | null; checkinCloseAt?: Date | null };
type SessionLike = {
  id: string;
  eventDayId: string;
  title: string;
  startAt: Date;
  endAt: Date;
  attendanceRequired: boolean;
  checkinRequired?: boolean;
  checkinOpenAt?: Date | null;
  checkinCloseAt?: Date | null;
};

export function eventCalendarDate(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isAttendanceEventOpen(
  event: { status: string; endDate: string; timezone: string; archivedAt?: Date | null },
  now = new Date(),
) {
  return !event.archivedAt && ATTENDANCE_EVENT_STATUSES.includes(event.status)
    && event.endDate >= eventCalendarDate(now, event.timezone);
}

function dayBoundaryInTimeZone(dateKey: string, timezone: string, end = false) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const provisional = new Date(Date.UTC(year, month - 1, day, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(provisional);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  const represented = Date.UTC(read("year"), read("month") - 1, read("day"), read("hour"), read("minute"), read("second"));
  return new Date(provisional.getTime() - (represented - provisional.getTime()));
}

export function buildRequiredAttendanceUnits(
  mode: AttendanceMode,
  days: DayLike[],
  sessions: SessionLike[],
  timezone = "Asia/Jakarta",
): AttendanceUnit[] {
  const units: AttendanceUnit[] = [];
  const includeDays = mode === "DAILY_ONLY" || mode === "DAILY_AND_SESSION";
  const includeSessions = mode === "SESSION_ONLY" || mode === "DAILY_AND_SESSION";

  if (includeDays) {
    for (const day of [...days].sort((a, b) => a.dayNumber - b.dayNumber)) {
      units.push({
        id: `DAY:${day.id}`,
        type: "DAY",
        dayId: day.id,
        sessionId: null,
        date: day.date,
        title: day.title || `Hari kegiatan ${day.dayNumber}`,
        startsAt: null,
        openAt: day.checkinOpenAt || dayBoundaryInTimeZone(day.date, timezone),
        endsAt: day.checkinCloseAt || dayBoundaryInTimeZone(day.date, timezone, true),
        qrEnabled: true,
      });
    }
  }

  if (includeSessions) {
    const dayDates = new Map(days.map((day) => [day.id, day.date]));
    for (const session of [...sessions]
      .filter((item) => item.attendanceRequired && dayDates.has(item.eventDayId))
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())) {
      units.push({
        id: `SESSION:${session.id}`,
        type: "SESSION",
        dayId: session.eventDayId,
        sessionId: session.id,
        date: dayDates.get(session.eventDayId)!,
        title: session.title,
        startsAt: session.startAt,
        openAt: session.checkinOpenAt || new Date(session.startAt.getTime() - 60 * 60 * 1000),
        endsAt: session.checkinCloseAt || new Date(session.endAt.getTime() + 60 * 60 * 1000),
        qrEnabled: session.checkinRequired !== false,
      });
    }
  }

  return units;
}

export const isAttendanceWindowOpen = (unit: AttendanceUnit, now: Date) => now >= unit.openAt && now <= unit.endsAt;

export function findAttendanceUnit(units: AttendanceUnit[], selection: AttendanceUnitSelection) {
  if (Boolean(selection.dayId) === Boolean(selection.sessionId)) return undefined;
  return selection.sessionId ? units.find((unit) => unit.sessionId === selection.sessionId)
    : units.find((unit) => unit.type === "DAY" && unit.dayId === selection.dayId);
}

export function calculateLatenessMinutes(checkinAt: Date, sessionStartAt: Date, gracePeriodMinutes = 15) {
  const elapsedMs = checkinAt.getTime() - sessionStartAt.getTime();
  return { isLate: elapsedMs > gracePeriodMinutes * 60_000, latenessMinutes: Math.max(0, Math.floor(elapsedMs / 60_000)) };
}

export const toCheckinUnit = (unit: AttendanceUnit, now: Date, enabled: boolean) => ({
  id: unit.id, type: unit.type, dayId: unit.dayId, sessionId: unit.sessionId, title: unit.title,
  date: unit.date, openAt: unit.openAt, closeAt: unit.endsAt, isOpen: enabled && unit.qrEnabled && isAttendanceWindowOpen(unit, now),
});

export function recordForAttendanceUnit(
  unit: AttendanceUnit,
  records: AttendanceRecordLike[],
) {
  return records.find((record) =>
    unit.type === "SESSION"
      ? record.eventSessionId === unit.sessionId
      : record.eventDayId === unit.dayId && !record.eventSessionId,
  );
}

export function summarizeParticipantAttendance(
  units: AttendanceUnit[],
  records: AttendanceRecordLike[],
  now = new Date(),
  eligible = true,
) {
  const recordsByUnit = new Map(records.map((record) => [
    record.eventSessionId ? `SESSION:${record.eventSessionId}` : `DAY:${record.eventDayId}`, record,
  ]));
  const details = units.map((unit) => {
    const record = recordsByUnit.get(unit.id);
    const status = record?.attendanceStatus ||
      (!eligible ? "NOT_REQUIRED" : unit.endsAt < now ? "ABSENT" : "NOT_RECORDED");
    return { unit, status, record };
  });
  const attended = details.filter((item) => ATTENDED_STATUSES.includes(item.status)).length;
  const excused = details.filter((item) => EXCUSED_STATUSES.includes(item.status)).length;
  const late = details.filter((item) => item.status === "LATE").length;
  const absent = details.filter((item) => item.status === "ABSENT").length;
  const missing = details.filter((item) => item.status === "NOT_RECORDED").length;
  const fulfilled = attended + excused;

  let statusCategory = absent > 0 ? "TIDAK_HADIR" : "BELUM_DIMULAI";
  if (units.length === 0) statusCategory = "BELUM_DIATUR";
  else if (attended === units.length) statusCategory = "HADIR_PENUH";
  else if (fulfilled === units.length && excused > 0) statusCategory = "IZIN_LENGKAP";
  else if (fulfilled > 0) statusCategory = "HADIR_SEBAGIAN";
  if (!eligible) statusCategory = "TIDAK_WAJIB";

  return {
    required: eligible ? units.length : 0,
    attended,
    excused,
    late,
    absent,
    missing,
    completionPercentage: eligible && units.length ? Math.round((fulfilled / units.length) * 100) : 0,
    statusCategory,
    details,
  };
}
