import { describe, expect, it, vi } from "vitest";

const sendTransactionalEmail = vi.fn();
const claim = vi.fn().mockResolvedValue([]);
const job = {
  id: "00000000-0000-4000-8000-000000000001",
  status: "QUEUED",
  attemptCount: 0,
  maxAttempts: 3,
  payload: { templateCode: "OTP_CODE", variables: {} },
};

vi.mock("../../netlify/functions/lib/db/client", () => ({
  getDbClient: () => ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => [job] }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({ returning: claim }),
      }),
    }),
  }),
}));
vi.mock("../../netlify/functions/lib/services/emailTransport", () => ({ sendTransactionalEmail }));

describe("email queue claim", () => {
  it("does not send a job claimed by another worker", async () => {
    sendTransactionalEmail.mockReset();
    claim.mockResolvedValueOnce([]);
    const { processEmailQueueWorker } = await import("../../netlify/functions/lib/services/emailQueueService");
    const result = await processEmailQueueWorker("test-worker", 1, "req-test");
    expect(result.processedCount).toBe(0);
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });
});
