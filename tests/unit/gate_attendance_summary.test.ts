import { beforeEach, describe, expect, it, vi } from "vitest";

const { scheduleMock, getDbMock } = vi.hoisted(() => ({ scheduleMock: vi.fn(), getDbMock: vi.fn() }));
vi.mock("../../netlify/functions/lib/repositories/attendanceRepository", () => ({ findAttendanceScheduleForEventRepository: scheduleMock }));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: getDbMock }));

import { getGateAttendanceSummaryService } from "../../netlify/functions/lib/services/attendanceService";

describe("ringkasan gate per hari", () => {
  beforeEach(() => {
    scheduleMock.mockReset(); getDbMock.mockReset();
    scheduleMock.mockResolvedValue({ event: { timezone: "Asia/Jakarta", attendanceMode: "DAILY_ONLY" },
      days: [{ id: "00000000-0000-4000-8000-000000000001", date: "2026-09-28", title: "Hari pertama", dayNumber: 1 }], sessions: [] });
  });

  it("menolak unit milik acara lain tanpa menghitung data", async () => {
    await expect(getGateAttendanceSummaryService("event-1", "DAY:00000000-0000-4000-8000-000000000002"))
      .rejects.toThrow(/Pilih hari atau sesi/);
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("menghitung belum hadir dari peserta yang terdaftar di hari pilihan", async () => {
    getDbMock.mockReturnValue({ select: () => ({ from: () => ({ where: async () => [{ total: 5, present: 2 }] }) }) });
    expect(await getGateAttendanceSummaryService("event-1", "DAY:00000000-0000-4000-8000-000000000001"))
      .toEqual({ unitId: "DAY:00000000-0000-4000-8000-000000000001", total: 5, present: 2, absent: 3 });
  });
});
