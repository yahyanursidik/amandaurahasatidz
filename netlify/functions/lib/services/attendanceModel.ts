export type AttendanceMode = "DAILY_ONLY" | "SESSION_ONLY" | "DAILY_AND_SESSION";

export type AttendanceUnit = {
  id: string;
  type: "DAY" | "SESSION";
  dayId: string;
  sessionId: string | null;
  date: string;
  title: string;
  startsAt: Date | null;
  endsAt: Date | null;
};

export type AttendanceRecordLike = {
  eventDayId?: string | null;
  eventSessionId?: string | null;
  attendanceStatus: string;
};

type DayLike = { id: string; dayNumber: number; date: string; title?: string | null; checkinCloseAt?: Date | null };
type SessionLike = {
  id: string;
  eventDayId: string;
  title: string;
  startAt: Date;
  endAt: Date;
  attendanceRequired: boolean;
  checkinCloseAt?: Date | null;
};

function endOfDayInTimeZone(dateKey: string, timezone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const provisional = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));
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
        endsAt: day.checkinCloseAt || endOfDayInTimeZone(day.date, timezone),
      });
    }
  }

  if (includeSessions) {
    const dayDates = new Map(days.map((day) => [day.id, day.date]));
    for (const session of [...sessions]
      .filter((item) => item.attendanceRequired)
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())) {
      units.push({
        id: `SESSION:${session.id}`,
        type: "SESSION",
        dayId: session.eventDayId,
        sessionId: session.id,
        date: dayDates.get(session.eventDayId) || "",
        title: session.title,
        startsAt: session.startAt,
        endsAt: session.checkinCloseAt || new Date(session.endAt.getTime() + 60 * 60 * 1000),
      });
    }
  }

  return units;
}

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
) {
  const details = units.map((unit) => {
    const record = recordForAttendanceUnit(unit, records);
    const status = record?.attendanceStatus ||
      (unit.endsAt && unit.endsAt < now ? "ABSENT" : "NOT_RECORDED");
    return { unit, status };
  });
  const attendedStatuses = new Set(["PRESENT", "LATE"]);
  const excusedStatuses = new Set(["EXCUSED", "PERMITTED"]);
  const attended = details.filter((item) => attendedStatuses.has(item.status)).length;
  const excused = details.filter((item) => excusedStatuses.has(item.status)).length;
  const late = details.filter((item) => item.status === "LATE").length;
  const absent = details.filter((item) => item.status === "ABSENT").length;
  const missing = details.filter((item) => item.status === "NOT_RECORDED").length;
  const fulfilled = attended + excused;

  let statusCategory = absent > 0 ? "TIDAK_HADIR" : "BELUM_DIMULAI";
  if (units.length === 0) statusCategory = "BELUM_DIATUR";
  else if (attended === units.length) statusCategory = "HADIR_PENUH";
  else if (fulfilled === units.length && excused > 0) statusCategory = "IZIN_LENGKAP";
  else if (fulfilled > 0) statusCategory = "HADIR_SEBAGIAN";

  return {
    required: units.length,
    attended,
    excused,
    late,
    absent,
    missing,
    completionPercentage: units.length ? Math.round((fulfilled / units.length) * 100) : 0,
    statusCategory,
    details,
  };
}
