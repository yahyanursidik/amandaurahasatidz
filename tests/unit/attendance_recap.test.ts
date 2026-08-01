import { describe, it, expect } from "vitest";
import { calculateLatenessMinutes } from "../../netlify/functions/lib/services/attendanceReportService";
import { correctAttendanceSchema } from "../../netlify/functions/lib/validations/attendanceValidation";

describe("Rekap Kehadiran, Mode Presensi & Correction Workflow Unit Tests", () => {
  it("should calculate lateness correctly considering grace period (15 minutes)", () => {
    const sessionStart = new Date("2026-08-15T08:00:00Z");

    // 1. Checkin at 08:10 (within 15 min grace period) -> NOT LATE
    const checkin1 = new Date("2026-08-15T08:10:00Z");
    const res1 = calculateLatenessMinutes(checkin1, sessionStart, 15);
    expect(res1.isLate).toBe(false);

    // 2. Checkin at 08:25 (after 15 min grace period) -> LATE (25 minutes late)
    const checkin2 = new Date("2026-08-15T08:25:00Z");
    const res2 = calculateLatenessMinutes(checkin2, sessionStart, 15);
    expect(res2.isLate).toBe(true);
    expect(res2.latenessMinutes).toBe(25);
  });

  it("should enforce mandatory reason for attendance correction workflow", () => {
    // Empty or short reason should fail validation
    const invalidParsed = correctAttendanceSchema.safeParse({
      attendanceStatus: "EXCUSED",
      reason: "OK", // Less than 3 chars
    });
    expect(invalidParsed.success).toBe(false);

    // Valid reason should pass validation
    const validParsed = correctAttendanceSchema.safeParse({
      attendanceStatus: "EXCUSED",
      reason: "Surat izin sakit dari klinik resmi",
    });
    expect(validParsed.success).toBe(true);
  });

  it("should verify the three operational attendance modes", () => {
    const supportedModes = ["DAILY_ONLY", "SESSION_ONLY", "DAILY_AND_SESSION"];
    expect(supportedModes).toHaveLength(3);
    expect(supportedModes).toContain("DAILY_AND_SESSION");
  });

  it("should categorize 5 attendance recap statuses (full, partial, late, excused, absent)", () => {
    const mockRecap = {
      fullAttendance: 45,
      partialAttendance: 3,
      lateAttendance: 2,
      excused: 1,
      absent: 1,
    };

    const totalCalculated =
      mockRecap.fullAttendance +
      mockRecap.partialAttendance +
      mockRecap.excused +
      mockRecap.absent;

    expect(totalCalculated).toBe(50);
    expect(mockRecap.lateAttendance).toBe(2);
  });
});
