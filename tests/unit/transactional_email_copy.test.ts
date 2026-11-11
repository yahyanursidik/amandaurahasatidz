import { describe, expect, it } from "vitest";
import { renderEmailTemplate, renderHtmlEmailTemplate } from "../../netlify/functions/lib/services/emailTemplateEngine";
import { DEFAULT_TRANSACTIONAL_EMAIL_COPY, parseTransactionalEmailCopy,
  transactionalEmailCopySchema, updateTransactionalEmailCopySchema } from "../../netlify/functions/lib/services/transactionalEmailCopy";

describe("pembuka email transaksional", () => {
  it("menyapa asatidz tanpa salam ganda dan mempertahankan tautan pribadi", () => {
    const cardLink = "https://contoh.id/card?token=pqr_abc.def";
    const message = renderHtmlEmailTemplate("REGISTRATION_APPROVED", {
      ustadzName: "Ustadz Hasan", eventName: "Daurah", participantCode: "P-001",
      cardLink, rundownLink: "https://contoh.id/events/daurah#jadwal-kegiatan",
      portalLink: "https://contoh.id/login/ustadz", email: "hasan@contoh.id",
    });
    expect(message.textBody).toContain("بسم الله الرحمن الرحيم");
    expect(message.textBody).toContain("Al Ustadz Al Faadhil Hasan");
    expect(message.textBody).not.toContain("Assalamu'alaikum Ustadz Hasan");
    expect(message.textBody).toContain(cardLink);
    expect(message.htmlBody).toContain('dir="rtl" lang="ar"');
    expect(message.htmlBody).toContain(`href="${cardLink}"`);
    expect(message.htmlBody.match(/بسم الله الرحمن الرحيم/g)).toHaveLength(1);
  });

  it("memakai sapaan lembaga dan menjaga kode OTP tetap ringkas", () => {
    const invitation = renderEmailTemplate("INVITATION_INSTITUTION", {
      institutionName: "Ma'had An-Nur", invitationNumber: "INV-1", quota: 5,
      eventName: "Daurah", eventDates: "12 November 2026", invitationLink: "https://contoh.id/undangan",
    });
    expect(invitation.body).toContain("Kepada Pimpinan Ma'had An-Nur");
    expect(invitation.body).not.toContain("Kepada Perwakilan Ma'had An-Nur");
    expect(invitation.body).toContain("https://contoh.id/undangan");
    const otp = renderHtmlEmailTemplate("OTP_CODE", { otpCode: "123456", expiresMinutes: 5 });
    expect(otp.textBody).not.toContain("الحمد لله");
    expect(otp.htmlBody).toContain("123456");
  });

  it("menerapkan pengaturan baru dan meng-escape teks HTML", () => {
    const copy = { ...DEFAULT_TRANSACTIONAL_EMAIL_COPY,
      openingArabic: "بسم الله الرحمن الرحيم\n\nالحمد لله رب العالمين، وبعد.",
      individualSalutation: "Yang kami hormati {{name}} <script>alert(1)</script>," };
    const message = renderHtmlEmailTemplate("REGISTRATION_RECEIVED", {
      ustadzName: "Ustadz Salim", eventName: "Daurah", participantCode: "P-002",
      cardLink: "https://contoh.id/card", rundownLink: "https://contoh.id/jadwal", portalLink: "https://contoh.id/login",
    }, copy);
    expect(message.textBody).toContain("Yang kami hormati Salim <script>alert(1)</script>,");
    expect(message.htmlBody).not.toContain("<script>");
    expect(message.htmlBody).toContain("&lt;script&gt;");
    expect(message.htmlBody).toContain("Buka bukti pendaftaran");
  });

  it("menolak variabel tidak dikenal dan memakai default saat konfigurasi rusak", () => {
    expect(transactionalEmailCopySchema.safeParse({ ...DEFAULT_TRANSACTIONAL_EMAIL_COPY,
      individualSalutation: "Halo {{otpCode}}, semoga sehat selalu." }).success).toBe(false);
    expect(updateTransactionalEmailCopySchema.safeParse({ settings: DEFAULT_TRANSACTIONAL_EMAIL_COPY,
      expectedVersion: null }).success).toBe(true);
    expect(parseTransactionalEmailCopy("{invalid-json")).toEqual(DEFAULT_TRANSACTIONAL_EMAIL_COPY);
  });
});
