import { beforeEach, describe, expect, it, vi } from "vitest";

const eventId = "00000000-0000-4000-8000-000000000101";
const dayOne = "00000000-0000-4000-8000-000000000102";
const dayTwo = "00000000-0000-4000-8000-000000000103";
const mock = vi.hoisted(() => ({
  event: {
    id: "00000000-0000-4000-8000-000000000101", status: "PUBLISHED",
    startDate: "2026-11-07", endDate: "2026-11-09", timezone: "Asia/Jakarta", attendanceMode: "DAILY_AND_SESSION",
    days: [
      { id: "00000000-0000-4000-8000-000000000102", dayNumber: 1, date: "2026-11-07", title: "Pembukaan", checkinOpenAt: null, checkinCloseAt: null },
      { id: "00000000-0000-4000-8000-000000000103", dayNumber: 2, date: "2026-11-09", title: "Penutupan", checkinOpenAt: null, checkinCloseAt: null },
    ],
    sessions: [{ id: "session-1", eventDayId: "00000000-0000-4000-8000-000000000102" }],
  },
  update: vi.fn(), audit: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../netlify/functions/lib/repositories/eventRepository", () => ({
  findEventByIdRepository: async () => mock.event,
}));
vi.mock("../../netlify/functions/lib/db/transaction", () => ({
  withTransaction: (fn: (tx: unknown) => unknown) => fn({
    select: () => ({ from: () => ({ where: () => ({ limit: () => ({ for: async () => [mock.event] }) }) }) }),
    update: () => ({ set: (values: unknown) => {
      mock.update(values);
      return { where: () => ({ returning: async () => [{ id: dayOne, ...values as object }] }) };
    } }),
  }),
}));
vi.mock("../../netlify/functions/lib/services/auditService", () => ({ createAuditLog: mock.audit }));

describe("event day updates", () => {
  beforeEach(() => { mock.event.status = "PUBLISHED"; mock.update.mockClear(); mock.audit.mockClear(); });

  it("allows correcting the title and records the change", async () => {
    const { updateEventDayService } = await import("../../netlify/functions/lib/services/eventService");
    await updateEventDayService(eventId, dayOne, { title: "Registrasi dan pembukaan" }, "admin", "request");
    expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({ title: "Registrasi dan pembukaan" }));
    expect(mock.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "EVENT_DAY_UPDATED", eventId }));
  });

  it("does not shift the date of a day that already has sessions", async () => {
    const { updateEventDayService } = await import("../../netlify/functions/lib/services/eventService");
    await expect(updateEventDayService(eventId, dayOne, { date: "2026-11-08" }, "admin", "request"))
      .rejects.toThrow("sudah memiliki sesi");
    expect(mock.update).not.toHaveBeenCalled();
  });

  it("does not reorder activity days after the event starts", async () => {
    mock.event.status = "ONGOING";
    const { updateEventDayService } = await import("../../netlify/functions/lib/services/eventService");
    await expect(updateEventDayService(eventId, dayTwo, { dayNumber: 3 }, "admin", "request"))
      .rejects.toThrow("event berlangsung");
    expect(mock.update).not.toHaveBeenCalled();
  });
});
