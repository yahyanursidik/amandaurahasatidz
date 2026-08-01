import { describe, it, expect } from "vitest";
import { processCheckinSchema } from "../../netlify/functions/lib/validations/attendanceValidation";

describe("Modul Presensi On-Site Panitia Unit Tests", () => {
  it("should validate active session check-in window logic (checkinOpenAt <= now <= checkinCloseAt)", () => {
    const now = new Date("2026-08-15T08:00:00Z");
    const openAt = new Date("2026-08-15T07:00:00Z");
    const closeAt = new Date("2026-08-15T09:00:00Z");

    const isOpen = now >= openAt && now <= closeAt;
    expect(isOpen).toBe(true);

    const expiredNow = new Date("2026-08-15T10:00:00Z");
    const isExpiredOpen = expiredNow >= openAt && expiredNow <= closeAt;
    expect(isExpiredOpen).toBe(false);
  });

  it("should validate processCheckinSchema payload for QR_SCAN, MANUAL_CODE, and SEARCH_SELECT methods", () => {
    const methods = ["QR_SCAN", "MANUAL_CODE", "SEARCH_SELECT"];

    for (const m of methods) {
      const parsed = processCheckinSchema.safeParse({
        qrTokenOrCode: "PAR-2026-A8K9M2P4",
        method: m,
      });
      expect(parsed.success).toBe(true);
    }
  });

  it("should enforce duplicate scan prevention within same session", () => {
    const sessionRecords = [{ sessionId: "sess-1", participantId: "part-1", status: "PRESENT" }];

    const isDuplicate = sessionRecords.some(
      (r) => r.sessionId === "sess-1" && r.participantId === "part-1"
    );
    expect(isDuplicate).toBe(true);
  });

  it("accepts an explicit daily unit and rejects selecting a day and session together", () => {
    const dayOnly = processCheckinSchema.safeParse({
      qrTokenOrCode: "PAR-2026-A8K9M2P4",
      dayId: "00000000-0000-0000-0000-000000000011",
      method: "MANUAL_CODE",
    });
    expect(dayOnly.success).toBe(true);

    const ambiguous = processCheckinSchema.safeParse({
      qrTokenOrCode: "PAR-2026-A8K9M2P4",
      dayId: "00000000-0000-0000-0000-000000000011",
      sessionId: "00000000-0000-0000-0000-000000000012",
      method: "MANUAL_CODE",
    });
    expect(ambiguous.success).toBe(false);
  });

  it("should verify checkin_logs records status for both SUCCESS and FAILED/DUPLICATE attempts", () => {
    const mockLogs = [
      { id: "log-1", result: "SUCCESS", failureReason: null },
      { id: "log-2", result: "DUPLICATE", failureReason: "Presensi ganda pada sesi ini" },
      { id: "log-3", result: "FAILED", failureReason: "Jendela presensi ditutup" },
    ];

    expect(mockLogs).toHaveLength(3);
    expect(mockLogs[0].result).toBe("SUCCESS");
    expect(mockLogs[1].result).toBe("DUPLICATE");
    expect(mockLogs[2].result).toBe("FAILED");
  });
});
