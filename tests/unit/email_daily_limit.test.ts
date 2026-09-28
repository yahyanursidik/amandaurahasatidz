import { describe, expect, it, vi } from "vitest";

const sendTransactionalEmail = vi.fn();
const defer = vi.fn().mockResolvedValue([]);
let selects = 0;
vi.mock("../../netlify/functions/lib/db/client", () => ({
  getDbClient: () => ({
    select: () => ({ from: () => ({ where: () => {
      selects++;
      return selects === 1
        ? { limit: async () => [{ id: "00000000-0000-4000-8000-000000000001", status: "QUEUED",
          scheduledAt: new Date(), payload: { templateCode: "BROADCAST_CUSTOM", campaignId: "campaign-1", dailyLimit: 2 } }] }
        : Promise.resolve([{ count: 2 }]);
    } }) }),
    update: () => ({ set: () => ({ where: defer }) }),
  }),
}));
vi.mock("../../netlify/functions/lib/services/emailTransport", () => ({ sendTransactionalEmail }));

describe("batas harian worker email", () => {
  it("menunda BC saat batas harian kampanye tercapai tanpa memanggil penyedia", async () => {
    selects = 0;
    defer.mockClear(); sendTransactionalEmail.mockClear();
    const { processEmailQueueWorker } = await import("../../netlify/functions/lib/services/emailQueueService");
    const result = await processEmailQueueWorker("test", 1, "req-limit");
    expect(result.results).toEqual([expect.objectContaining({ status: "DEFERRED" })]);
    expect(defer).toHaveBeenCalledOnce();
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });
});
