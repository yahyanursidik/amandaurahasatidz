import { describe, expect, it } from "vitest";
import {
  buildRequiredAttendanceUnits,
  summarizeParticipantAttendance,
} from "../../netlify/functions/lib/services/attendanceModel";

const day = (id: string, dayNumber: number, date: string) => ({ id, dayNumber, date, title: null });
const session = (
  id: string,
  eventDayId: string,
  date: string,
  attendanceRequired = true,
) => ({
  id,
  eventDayId,
  title: `Sesi ${id}`,
  startAt: new Date(`${date}T08:00:00+07:00`),
  endAt: new Date(`${date}T10:00:00+07:00`),
  attendanceRequired,
});

describe("Attendance unit model", () => {
  it("treats a one-day daily event as complete after one daily check-in", () => {
    const units = buildRequiredAttendanceUnits("DAILY_ONLY", [day("d1", 1, "2026-08-15")], []);
    const summary = summarizeParticipantAttendance(units, [
      { eventDayId: "d1", eventSessionId: null, attendanceStatus: "PRESENT" },
    ]);
    expect(units).toHaveLength(1);
    expect(summary.statusCategory).toBe("HADIR_PENUH");
    expect(summary.completionPercentage).toBe(100);
  });

  it("supports two consecutive activity days", () => {
    const days = [day("d1", 1, "2026-08-15"), day("d2", 2, "2026-08-16")];
    const units = buildRequiredAttendanceUnits("SESSION_ONLY", days, [
      session("s1", "d1", "2026-08-15"),
      session("s2", "d2", "2026-08-16"),
    ]);
    const summary = summarizeParticipantAttendance(units, [
      { eventDayId: "d1", eventSessionId: "s1", attendanceStatus: "PRESENT" },
    ]);
    expect(units.map((unit) => unit.date)).toEqual(["2026-08-15", "2026-08-16"]);
    expect(summary.statusCategory).toBe("HADIR_SEBAGIAN");
    expect(summary.completionPercentage).toBe(50);
  });

  it("does not invent an attendance unit for a gap day", () => {
    const units = buildRequiredAttendanceUnits("DAILY_ONLY", [
      day("d1", 1, "2026-08-15"),
      day("d2", 2, "2026-08-17"),
    ], []);
    expect(units.map((unit) => unit.date)).toEqual(["2026-08-15", "2026-08-17"]);
    expect(units.some((unit) => unit.date === "2026-08-16")).toBe(false);
  });

  it("combines daily and required sessions while excluding optional sessions", () => {
    const days = [day("d1", 1, "2026-08-15"), day("d2", 2, "2026-08-17")];
    const units = buildRequiredAttendanceUnits("DAILY_AND_SESSION", days, [
      session("s1", "d1", "2026-08-15"),
      session("break", "d1", "2026-08-15", false),
      session("s2", "d2", "2026-08-17"),
    ]);
    expect(units).toHaveLength(4);
    expect(units.map((unit) => unit.id)).toEqual(["DAY:d1", "DAY:d2", "SESSION:s1", "SESSION:s2"]);
  });

  it("counts permitted attendance as fulfilled but not physically present", () => {
    const units = buildRequiredAttendanceUnits("DAILY_ONLY", [day("d1", 1, "2026-08-15")], []);
    const summary = summarizeParticipantAttendance(units, [
      { eventDayId: "d1", eventSessionId: null, attendanceStatus: "PERMITTED" },
    ]);
    expect(summary.statusCategory).toBe("IZIN_LENGKAP");
    expect(summary.excused).toBe(1);
  });
});
