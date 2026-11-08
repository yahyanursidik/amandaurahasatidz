import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  event: {
    id: "00000000-0000-4000-8000-000000000101", status: "DRAFT", timezone: "Asia/Jakarta",
    startDate: "2027-02-10", endDate: "2027-02-12", capacity: 30, regularQuota: 10,
    invitationQuota: 20, days: [{ date: "2027-02-12" }], sessions: [{ id: "session-1" }],
  },
  update: vi.fn(), audit: vi.fn().mockResolvedValue(null),
  count: vi.fn(), countTotal: vi.fn(),
}));

vi.mock("../../netlify/functions/lib/repositories/eventRepository", () => ({
  findEventByIdRepository: async () => mock.event,
  updateEventRepository: mock.update,
}));
vi.mock("../../netlify/functions/lib/repositories/participantRepository", () => ({
  countApprovedParticipantsBySourceRepository: mock.count,
  countApprovedParticipantsForEventRepository: mock.countTotal,
}));
vi.mock("../../netlify/functions/lib/services/auditService", () => ({ createAuditLog: mock.audit }));

describe("edit konfigurasi event yang sudah terhubung", () => {
  beforeEach(() => {
    mock.update.mockReset().mockResolvedValue(mock.event);
    mock.audit.mockClear();
    mock.count.mockReset().mockImplementation(async (_id: string, regular: boolean) => regular ? 8 : 12);
    mock.countTotal.mockReset().mockResolvedValue(20);
  });

  it("tidak memotong hari kegiatan saat hanya tanggal akhir diubah", async () => {
    const { updateEventService } = await import("../../netlify/functions/lib/services/eventService");
    await expect(updateEventService(mock.event.id, { endDate: "2027-02-11" }, "admin", "request"))
      .rejects.toThrow(/tidak mencakup semua hari kegiatan/i);
    expect(mock.update).not.toHaveBeenCalled();
  });

  it("tidak menggeser jam sesi yang sudah dibuat ke zona waktu lain", async () => {
    const { updateEventService } = await import("../../netlify/functions/lib/services/eventService");
    await expect(updateEventService(mock.event.id, { timezone: "Asia/Makassar" }, "admin", "request"))
      .rejects.toThrow(/zona waktu tidak dapat diubah/i);
  });

  it("tidak menurunkan kuota di bawah peserta yang sudah disetujui", async () => {
    const { updateEventService } = await import("../../netlify/functions/lib/services/eventService");
    await expect(updateEventService(mock.event.id, { regularQuota: 7 }, "admin", "request"))
      .rejects.toThrow(/8 peserta yang sudah disetujui/);
    expect(mock.count).toHaveBeenCalledTimes(2);
    expect(mock.update).not.toHaveBeenCalled();
  });
});
