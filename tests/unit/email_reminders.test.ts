import { describe, it, expect } from "vitest";
import { convertEventTimeToUtc } from "../../netlify/functions/lib/services/reminderService";
import { verifyWebhookSignature } from "../../netlify/functions/lib/services/webhookService";
import { renderEmailTemplate } from "../../netlify/functions/lib/services/emailTemplateEngine";
import { emailWebhookPayloadSchema } from "../../netlify/functions/lib/validations/webhookValidation";

describe("Email Automation, Reminders & Webhook Unit Tests", () => {
  it("should convert event time in Asia/Jakarta (WIB) explicitly to UTC", () => {
    const utcDate = convertEventTimeToUtc("2026-08-15", "08:00", "Asia/Jakarta");
    // 08:00 WIB (UTC+7) = 01:00 UTC
    expect(utcDate.getUTCHours()).toBe(1);
    expect(utcDate.getUTCDate()).toBe(15);
  });

  it("should convert event time in Asia/Makassar (WITA) explicitly to UTC", () => {
    const utcDate = convertEventTimeToUtc("2026-08-15", "08:00", "Asia/Makassar");
    // 08:00 WITA (UTC+8) = 00:00 UTC
    expect(utcDate.getUTCHours()).toBe(0);
  });

  it("should verify HMAC SHA-256 webhook signature", () => {
    const rawBody = JSON.stringify({ providerMessageId: "msg_123", eventType: "DELIVERED" });
    const secret = "test_webhook_secret_999";

    // Generate valid HMAC signature
    const crypto = require("crypto");
    const validSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

    const isValid = verifyWebhookSignature(validSignature, rawBody, secret);
    expect(isValid).toBe(true);

    const isInvalid = verifyWebhookSignature("invalid_signature", rawBody, secret);
    expect(isInvalid).toBe(false);
  });

  it("should validate webhook payload schema", () => {
    const payload = {
      provider: "RESEND",
      providerMessageId: "msg_resend_999",
      eventType: "DELIVERED",
      recipientEmail: "ustadz@yts.or.id",
    };

    const parsed = emailWebhookPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("should render THANK_YOU_CONFIRMED and THANK_YOU_ATTENDED email templates", () => {
    const thankYouConfirmed = renderEmailTemplate("THANK_YOU_CONFIRMED", {
      recipientName: "Ustadz Abdullah, Lc.",
      eventName: "Daurah Asatidz 2026",
      participantCode: "PAR-BDG-001",
    });

    expect(thankYouConfirmed.subject).toContain("Terima Kasih");
    expect(thankYouConfirmed.body).toContain("PAR-BDG-001");

    const thankYouAttended = renderEmailTemplate("THANK_YOU_ATTENDED", {
      recipientName: "Ustadz Abdullah, Lc.",
      eventName: "Daurah Asatidz 2026",
    });

    expect(thankYouAttended.subject).toContain("Jazakumullah Khairan");
  });
});
