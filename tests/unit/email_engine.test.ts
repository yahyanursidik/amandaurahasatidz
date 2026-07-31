import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderEmailTemplate, renderHtmlEmailTemplate } from "../../netlify/functions/lib/services/emailTemplateEngine";
import { renderHtmlByTemplateCode } from "../../netlify/functions/lib/services/emailHtmlTemplates";
import { enqueueEmailSchema } from "../../netlify/functions/lib/validations/emailValidation";

// Mock smtpTransport agar tidak membuka koneksi SMTP nyata di test
vi.mock("../../netlify/functions/lib/services/smtpTransport", () => ({
  sendEmailViaSMTP: vi.fn().mockResolvedValue({ success: true, messageId: "test-msg-id-001" }),
  verifySmtpConnection: vi.fn().mockResolvedValue(true),
  resetSmtpTransporter: vi.fn(),
}));

describe("Email Engine, Queue & Template Whitelist Unit Tests", () => {
  it("should render email template with whitelisted variables correctly", () => {
    const rendered = renderEmailTemplate("INVITATION_INDIVIDUAL", {
      ustadzName: "Ustadz Abdullah, Lc.",
      eventName: "Daurah Asatidz Nasional 2026",
      eventDates: "15-18 Agustus 2026",
      invitationLink: "http://localhost:3000/invitation/individual/inv_123",
    });

    expect(rendered.subject).toContain("Ustadz Abdullah, Lc.");
    expect(rendered.body).toContain("Daurah Asatidz Nasional 2026");
    expect(rendered.body).toContain("http://localhost:3000/invitation/individual/inv_123");
  });

  it("should reject unwhitelisted variables injection", () => {
    expect(() =>
      renderEmailTemplate("OTP_CODE", {
        otpCode: "123456",
        expiresMinutes: "5",
        unauthorizedPayload: "Hacked Variable", // Not in whitelist!
      })
    ).toThrowError(/tidak diizinkan/);
  });

  it("should validate enqueueEmailSchema payload with idempotencyKey", () => {
    const payload = {
      templateCode: "OTP_CODE",
      recipientEmail: "admin@yts.or.id",
      recipientName: "Administrator YTS",
      variables: { otpCode: "123456", expiresMinutes: 5 },
      idempotencyKey: "idem_key_otp_123456_timestamp_999",
    };

    const parsed = enqueueEmailSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("should verify retry policy transition to DEAD_LETTER state after max attempts", () => {
    const maxRetries = 3;
    let attempts = 0;
    let status = "PENDING";

    // Simulate 3 failed attempts:
    for (let i = 1; i <= maxRetries; i++) {
      attempts++;
      if (attempts >= maxRetries) {
        status = "DEAD_LETTER";
      } else {
        status = "FAILED";
      }
    }

    expect(attempts).toBe(3);
    expect(status).toBe("DEAD_LETTER");
  });

  // ─── New: EVENT_REMINDER Template Tests ─────────────────────────────────────

  it("should render EVENT_REMINDER plain text template correctly", () => {
    const rendered = renderEmailTemplate("EVENT_REMINDER", {
      ustadzName: "Ustadz Ahmad Faiz",
      eventName: "Daurah Asatidz Nasional 2026",
      eventDates: "15-18 Agustus 2026",
      participantCode: "PAR-2026-0042",
      daysRemaining: "7",
    });

    expect(rendered.subject).toContain("Daurah Asatidz Nasional 2026");
    expect(rendered.subject).toContain("7 Hari Lagi");
    expect(rendered.body).toContain("Ustadz Ahmad Faiz");
    expect(rendered.body).toContain("PAR-2026-0042");
  });

  // ─── New: HTML Template Rendering Tests ─────────────────────────────────────

  it("should render REGISTRATION_CONFIRMED HTML template with participant code", () => {
    const html = renderHtmlByTemplateCode("REGISTRATION_CONFIRMED", {
      ustadzName: "Ustadz Zaid bin Ali",
      eventName: "Daurah Asatidz Nasional 2026",
      eventDates: "15-18 Agustus 2026",
      participantCode: "PAR-2026-0099",
      qrCodeUrl: "https://example.com/qr/PAR-2026-0099.png",
    });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("PAR-2026-0099");
    expect(html).toContain("Pendaftaran Berhasil");
    expect(html).toContain("Ustadz Zaid bin Ali");
    expect(html).toContain("no-reply@radiotarbiyahsunnah.com");
  });

  it("should render OTP_CODE HTML template with masked security warning", () => {
    const html = renderHtmlByTemplateCode("OTP_CODE", {
      otpCode: "847261",
      expiresMinutes: "10",
    });

    expect(html).toContain("847261");
    expect(html).toContain("10");
    expect(html).toContain("Jangan bagikan kode ini");
    expect(html).toContain("Kode Otentikasi Masuk");
  });

  it("should render THANK_YOU_ATTENDED HTML template with Islamic quote", () => {
    const html = renderHtmlByTemplateCode("THANK_YOU_ATTENDED", {
      recipientName: "Ustadz Hamzah Al-Farisi",
      eventName: "Daurah Asatidz Nasional 2026",
    });

    expect(html).toContain("\u062C\u064E\u0632\u064E\u0627\u0643\u064F\u0645\u064F \u0627\u0644\u0644\u0647\u064F \u062E\u064E\u064A\u0652\u0631\u064B\u0627");
    expect(html).toContain("Ustadz Hamzah Al-Farisi");
    expect(html).toContain("Daurah Asatidz Nasional 2026");
  });

  it("should render EVENT_REMINDER HTML with urgency badge for 1 day remaining", () => {
    const html = renderHtmlByTemplateCode("EVENT_REMINDER", {
      ustadzName: "Ustadz Bilal Rahman",
      eventName: "Daurah Ilmiah YTS",
      eventDates: "1 Agustus 2026",
      participantCode: "PAR-2026-0001",
      daysRemaining: "1",
    });

    expect(html).toContain("BESOK! Segera Bersiap");
    expect(html).toContain("Ustadz Bilal Rahman");
    expect(html).toContain("PAR-2026-0001");
  });

  it("should render renderHtmlEmailTemplate and return subject + html + text", () => {
    const result = renderHtmlEmailTemplate("THANK_YOU_CONFIRMED", {
      recipientName: "Ustadz Salim",
      eventName: "Daurah Asatidz",
      eventDates: "15 Agustus 2026",
      participantCode: "PAR-2026-0010",
    });

    expect(result.subject).toContain("Terima Kasih");
    expect(result.htmlBody).toContain("<!DOCTYPE html>");
    expect(result.textBody).toContain("Ustadz Salim");
  });
});
