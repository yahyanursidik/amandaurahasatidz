import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(), inserts: [] as Array<Record<string, unknown>>, updates: [] as Array<Record<string, unknown>>,
  audit: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../netlify/functions/lib/db/client", () => ({
  getDbClient: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [{
      id: "00000000-0000-4000-8000-000000000001", code: "BC_ASATIDZ_TEST",
      name: "Sapaan tes", status: "ACTIVE", subjectTemplate: "Salam {{nama}}",
      bodyTemplate: "Assalamu'alaikum {{nama}} ({{email}})",
    }] }) }) }),
    insert: () => ({ values: (value: Record<string, unknown>) => {
      mocks.inserts.push(value);
      return { returning: async () => [{ id: "00000000-0000-4000-8000-000000000002" }] };
    } }),
    update: () => ({ set: (value: Record<string, unknown>) => {
      mocks.updates.push(value);
      return { where: async () => [] };
    } }),
  }),
}));
vi.mock("../../netlify/functions/lib/services/emailTransport", () => ({ sendTransactionalEmail: mocks.send }));
vi.mock("../../netlify/functions/lib/services/auditService", () => ({ createAuditLog: mocks.audit }));

describe("uji kirim BC", () => {
  it("mengirim satu email berlabel uji dan menyimpan penerimaan penyedia terpisah dari kampanye", async () => {
    mocks.inserts.length = 0; mocks.updates.length = 0;
    mocks.send.mockReset().mockResolvedValue({ success: true, provider: "MAILKETING", messageId: "provider-123" });
    const { sendBroadcastTest } = await import("../../netlify/functions/lib/services/broadcastService");
    const result = await sendBroadcastTest({ templateId: "00000000-0000-4000-8000-000000000001",
      recipientEmail: "TEST@example.com", recipientName: "Ustadz Test" }, "user-id", "request-id");
    expect(result).toMatchObject({ status: "ACCEPTED", providerMessageId: "provider-123" });
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(mocks.send.mock.calls[0][0]).toMatchObject({ to: "test@example.com", subject: "[UJI BC] Salam Ustadz Test" });
    expect(mocks.inserts[0].payload).toMatchObject({ isTest: true, campaignId: null });
    expect(mocks.inserts).toHaveLength(2); // Job dan bukti penerimaan penyedia.
    expect(mocks.updates[0].status).toBe("SENT");
  });

  it("mencatat kegagalan Mailketing tanpa menandai email uji terkirim", async () => {
    mocks.inserts.length = 0; mocks.updates.length = 0;
    mocks.send.mockReset().mockResolvedValue({ success: false, provider: "MAILKETING", error: "Token tidak valid" });
    const { sendBroadcastTest } = await import("../../netlify/functions/lib/services/broadcastService");
    const result = await sendBroadcastTest({ templateId: "00000000-0000-4000-8000-000000000001",
      recipientEmail: "test@example.com" }, "user-id", "request-id");
    expect(result).toMatchObject({ status: "FAILED", error: "Token tidak valid" });
    expect(mocks.inserts).toHaveLength(1);
    expect(mocks.updates[0]).toMatchObject({ status: "FAILED", lastError: "Token tidak valid" });
  });
});
