import { afterEach, describe, expect, it, vi } from "vitest";
import { sendEmailViaMailketing } from "../../netlify/functions/lib/services/mailketingTransport";
import { normalizePublicRegistrationGroup } from "../../netlify/functions/lib/services/publicRegistrationService";
import { renderHtmlEmailTemplate } from "../../netlify/functions/lib/services/emailTemplateEngine";
import { submitPublicRegistrationSchema } from "../../netlify/functions/lib/validations/publicRegistrationValidation";

const originalToken = process.env.MAILKETING_API_TOKEN;
const originalFromEmail = process.env.MAILKETING_FROM_EMAIL;
afterEach(() => {
  vi.unstubAllGlobals();
  if (originalToken === undefined) delete process.env.MAILKETING_API_TOKEN;
  else process.env.MAILKETING_API_TOKEN = originalToken;
  if (originalFromEmail === undefined) delete process.env.MAILKETING_FROM_EMAIL;
  else process.env.MAILKETING_FROM_EMAIL = originalFromEmail;
});

describe("pendaftaran rombongan reguler", () => {
  const input = { fullName: "Ustadz Ahmad", email: "Ahmad@Example.ID", whatsapp: "081234567890", city: "KOTA BANDUNG", province: "JAWA BARAT", consentConfirmed: true as const, delegates: [{ fullName: "Ustadz Hasan", email: "hasan@example.id", whatsapp: "081298765432", city: "KOTA BANDUNG", province: "JAWA BARAT" }] };
  it("menormalisasi kepala dan anggota", () => {
    expect(submitPublicRegistrationSchema.safeParse(input).success).toBe(true);
    const people = normalizePublicRegistrationGroup(input);
    expect(people.map((person) => person.email)).toEqual(["ahmad@example.id", "hasan@example.id"]);
  });
  it("menolak email ganda dan lebih dari 20 orang", () => {
    expect(submitPublicRegistrationSchema.safeParse({ ...input, delegates: [{ ...input.delegates[0], email: "AHMAD@example.id" }] }).success).toBe(false);
    expect(() => normalizePublicRegistrationGroup({ ...input, delegates: Array.from({ length: 20 }, (_, index) => ({ ...input.delegates[0], email: `member${index}@example.id` })) })).toThrow(/Maksimal 20/);
  });
  it("mewajibkan persetujuan kepala rombongan pada API", () => {
    expect(submitPublicRegistrationSchema.safeParse({ ...input, consentConfirmed: false }).success).toBe(false);
    expect(submitPublicRegistrationSchema.safeParse({ ...input, consentConfirmed: undefined }).success).toBe(false);
  });
});

describe("Mailketing transactional", () => {
  const message = { to: "ustadz@example.id", subject: "Pengingat", htmlBody: "<p>Assalamu'alaikum</p>" };
  it("memakai Bearer token dan JSON tanpa mengirim saat token kosong", async () => {
    delete process.env.MAILKETING_API_TOKEN;
    delete process.env.MAILKETING_FROM_EMAIL;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await sendEmailViaMailketing(message)).success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    process.env.MAILKETING_API_TOKEN = "test-only-token";
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, data: { message_id: "mk-123" } }) });
    expect(await sendEmailViaMailketing(message)).toMatchObject({ success: true, messageId: "mk-123" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.mailketing.co.id/api/v2/send");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer test-only-token");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ from_email: "no-reply@yts.web.id", recipient: message.to });
  });
  it("menolak HTTP berhasil bila provider menyatakan gagal", async () => {
    process.env.MAILKETING_API_TOKEN = "test-only-token";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: false, message: "Invalid token" }) }));
    expect((await sendEmailViaMailketing(message)).success).toBe(false);
  });
  it("meng-escape isi pengumuman pada email HTML", () => {
    const result = renderHtmlEmailTemplate("ANNOUNCEMENT", { ustadzName: "Ustadz Ahmad", eventName: "Daurah", title: "Info", body: "<script>alert(1)</script>", portalLink: "https://example.id/portal" });
    expect(result.htmlBody).not.toContain("<script>");
    expect(result.htmlBody).toContain("&lt;script&gt;");
  });
});
