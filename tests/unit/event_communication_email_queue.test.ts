import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildCommunicationPreview, type CommunicationRecipient } from "../../netlify/functions/lib/services/communicationRendering";

const state = vi.hoisted(() => ({
  results: [] as unknown[][], calls: [] as Array<{ action: string; fields?: unknown }>,
  send: vi.fn(), render: vi.fn(), audit: vi.fn(),
}));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: () => {
  function builder(action: string) {
    const call = { action } as typeof state.calls[number]; state.calls.push(call);
    const query = {
      from() { return query; }, where() { return query; }, limit() { return query; },
      set(value: unknown) { call.fields = value; return query; },
      values(value: unknown) { call.fields = value; return query; },
      returning() { return query; }, onConflictDoNothing() { return query; },
      then(resolve: (value: unknown[]) => unknown, reject: (error: unknown) => unknown) {
        return Promise.resolve(state.results.shift() || []).then(resolve, reject);
      },
    };
    return query;
  }
  return { select: () => builder("select"), insert: () => builder("insert"), update: () => builder("update") };
} }));
vi.mock("../../netlify/functions/lib/services/emailTransport", () => ({ sendTransactionalEmail: state.send }));
vi.mock("../../netlify/functions/lib/services/emailTemplateEngine", () => ({ renderEmailTemplate: state.render, renderHtmlEmailTemplate: state.render }));
vi.mock("../../netlify/functions/lib/services/auditService", () => ({ createAuditLog: state.audit }));
vi.mock("../../netlify/functions/lib/utils/logger", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
import { enqueueEmailJob, processEmailQueueWorker } from "../../netlify/functions/lib/services/emailQueueService";

const eventId = "11111111-1111-4111-8111-111111111111";
const recipient: CommunicationRecipient = { participantId: "participant", institutionId: null, userId: null,
  name: "Ahmad", email: "ahmad@example.invalid", participantCode: "TEST-01", institutionName: "Lembaga uji" };
function preview() {
  return buildCommunicationPreview({ title: "Info {{ustadzName}}", body: "Kode {{participantCode}} & pesan", emailSubject: "Subjek {{ustadzName}}", sendEmailNotification: true },
    { name: "Daurah", startDate: "2026-10-03", endDate: "2026-10-03", venueName: "Aula", venueAddress: null }, [recipient]);
}
beforeEach(() => {
  state.results = []; state.calls = [];
  state.send.mockReset().mockResolvedValue({ success: true, provider: "MOCK", messageId: "mock-only" });
  state.render.mockReset(); state.audit.mockReset();
});

describe("communication queue immutable preview snapshots", () => {
  it("stores exactly the subject, text and HTML reviewed for the recipient", async () => {
    const data = preview();
    state.results = [[], [{ id: "template" }], [{ id: "job" }]];
    const result = await enqueueEmailJob({ templateCode: "ANNOUNCEMENT_CUSTOM", eventId,
      recipientEmail: recipient.email!, recipientName: recipient.name, variables: {}, idempotencyKey: "announcement-test",
      renderedContent: { subject: data.emailSubject, bodyText: `${data.title}\n\n${data.body}`, htmlBody: data.emailHtml } });
    expect(result.isDuplicate).toBe(false);
    expect(state.calls.find((call) => call.action === "insert")?.fields).toMatchObject({ eventId, status: "QUEUED",
      payload: { templateCode: "ANNOUNCEMENT_CUSTOM", subject: data.emailSubject, bodyText: `${data.title}\n\n${data.body}`, htmlBody: data.emailHtml } });
    expect(state.render).not.toHaveBeenCalled(); expect(state.send).not.toHaveBeenCalled();
  });
  it("skips duplicate jobs without recreating or dispatching them", async () => {
    state.results = [[{ id: "existing" }]];
    expect((await enqueueEmailJob({ templateCode: "ANNOUNCEMENT_CUSTOM", recipientEmail: recipient.email!, variables: {}, idempotencyKey: "same" })).isDuplicate).toBe(true);
    expect(state.calls).toHaveLength(1);
    expect(state.render).not.toHaveBeenCalled(); expect(state.send).not.toHaveBeenCalled();
  });
  it("worker uses the persisted personalized preview, not a newly rendered mutable template", async () => {
    const data = preview();
    const job = { id: "job", status: "QUEUED", recipientEmail: recipient.email, recipientName: recipient.name,
      scheduledAt: new Date(), maxAttempts: 3, payload: { templateCode: "ANNOUNCEMENT_CUSTOM", variables: { ustadzName: "Changed after review" },
        subject: data.emailSubject, bodyText: `${data.title}\n\n${data.body}`, htmlBody: data.emailHtml } };
    state.results = [[job], [{ attemptCount: 1 }], [{ id: "delivery" }], []];
    const result = await processEmailQueueWorker("mock-worker", 1, "mock-request");
    expect(result.results).toEqual([{ jobId: "job", status: "SENT", deliveryId: "delivery" }]);
    expect(state.send).toHaveBeenCalledExactlyOnceWith({ to: recipient.email, toName: recipient.name,
      subject: data.emailSubject, htmlBody: data.emailHtml, textBody: `${data.title}\n\n${data.body}`, requestId: "mock-request" });
    expect(state.render).not.toHaveBeenCalled();
  });
  it("worker converts old text-only announcement payloads to escaped HTML", async () => {
    const job = { id: "legacy-job", status: "QUEUED", recipientEmail: recipient.email, maxAttempts: 3,
      scheduledAt: new Date(), payload: { templateCode: "ANNOUNCEMENT_CUSTOM", subject: "Legacy subject", bodyText: "<script>unsafe()</script> & text" } };
    state.results = [[job], [{ attemptCount: 1 }], [{ id: "delivery" }], []];
    expect((await processEmailQueueWorker()).results[0].status).toBe("SENT");
    const message = state.send.mock.calls[0][0];
    expect(message.subject).toBe("Legacy subject");
    expect(message.htmlBody).not.toContain("<script>");
    expect(message.htmlBody).toContain("&lt;script&gt;");
    expect(state.render).not.toHaveBeenCalled();
  });
});