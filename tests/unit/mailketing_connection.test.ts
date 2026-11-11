import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkMailketingConnection, sendEmailViaMailketing } from "../../netlify/functions/lib/services/mailketingTransport";

const originalToken = process.env.MAILKETING_API_TOKEN;
const originalSender = process.env.MAILKETING_FROM_EMAIL;
const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });

beforeEach(() => {
  process.env.MAILKETING_API_TOKEN = "test-only-token";
  process.env.MAILKETING_FROM_EMAIL = "no-reply@yts.web.id";
});
afterEach(() => {
  vi.unstubAllGlobals();
  if (originalToken === undefined) delete process.env.MAILKETING_API_TOKEN;
  else process.env.MAILKETING_API_TOKEN = originalToken;
  if (originalSender === undefined) delete process.env.MAILKETING_FROM_EMAIL;
  else process.env.MAILKETING_FROM_EMAIL = originalSender;
});

describe("Mailketing connection check", () => {
  it("does not call the provider or expose a missing token", async () => {
    delete process.env.MAILKETING_API_TOKEN;
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect(await checkMailketingConnection()).toMatchObject({ issue: "TOKEN_MISSING", readyToSend: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads credits and verified senders without sending email", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(ok({ credits: 42 }))
      .mockResolvedValueOnce(ok({ senders: [{ email: "NO-REPLY@YTS.WEB.ID" }] }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await checkMailketingConnection();
    expect(result).toMatchObject({ authenticated: true, senderListed: true, credits: 42,
      readyToSend: true, senderEmail: "no-reply@yts.web.id", issue: null });
    expect(JSON.stringify(result)).not.toContain("test-only-token");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://api.mailketing.co.id/api/v2/credits",
      "https://api.mailketing.co.id/api/v2/senders",
    ]);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store",
      headers: { Authorization: "Bearer test-only-token" } });
  });

  it("stops after an invalid token and distinguishes missing sender or credits", async () => {
    const invalidFetch = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ success: false }) });
    vi.stubGlobal("fetch", invalidFetch);
    expect(await checkMailketingConnection()).toMatchObject({ issue: "TOKEN_INVALID", authenticated: false });
    expect(invalidFetch).toHaveBeenCalledOnce();

    const senderFetch = vi.fn().mockResolvedValueOnce(ok({ credits: 12 }))
      .mockResolvedValueOnce(ok({ senders: [{ email: "admin@yts.web.id" }] }));
    vi.stubGlobal("fetch", senderFetch);
    expect(await checkMailketingConnection()).toMatchObject({ issue: "SENDER_NOT_LISTED", authenticated: true, readyToSend: false });

    const emptyCreditsFetch = vi.fn().mockResolvedValueOnce(ok({ credits: 0 }))
      .mockResolvedValueOnce(ok({ senders: [{ email: "no-reply@yts.web.id" }] }));
    vi.stubGlobal("fetch", emptyCreditsFetch);
    expect(await checkMailketingConnection()).toMatchObject({ issue: "NO_CREDITS", credits: 0, readyToSend: false });
  });

  it("maps provider send failures to safe, actionable messages", async () => {
    const message = { to: "test@example.invalid", subject: "Uji", htmlBody: "<p>Uji</p>" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 402, json: async () => ({ success: false }) }));
    expect((await sendEmailViaMailketing(message)).error).toContain("Kredit Mailketing habis");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ success: false }) }));
    expect((await sendEmailViaMailketing(message)).error).toContain("Domain email pengirim belum diverifikasi");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: false }) }));
    expect((await sendEmailViaMailketing(message)).error).toContain("Mailketing belum menerima email");
  });
});
