import { describe, expect, it } from "vitest";
import {
  buildEmailShareUrl,
  buildInvitationShareText,
  buildWhatsAppShareUrl,
  normalizeWhatsAppRecipient,
} from "../../src/lib/invitationShare";

const context = {
  institutionName: "Ma'had Ilmu Sunnah Bandung",
  eventName: "Daurah Asatidz 1448 H",
  invitationNumber: "INV/2026/BDG/004",
  invitationUrl: "https://aman.example/invitation/institution/token-khusus",
  responseDeadline: "2026-08-05T16:59:59Z",
};

describe("invitation share helpers", () => {
  it("normalizes Indonesian WhatsApp numbers for wa.me", () => {
    expect(normalizeWhatsAppRecipient("0812-0000-1111")).toBe("6281200001111");
    expect(normalizeWhatsAppRecipient("+62 812 0000 1111")).toBe("6281200001111");
    expect(normalizeWhatsAppRecipient("81200001111")).toBe("6281200001111");
  });

  it("builds a complete and respectful institution invitation message", () => {
    const message = buildInvitationShareText(context);
    expect(message).toContain("Assalamu'alaikum warahmatullahi wabarakatuh");
    expect(message).toContain(context.institutionName);
    expect(message).toContain(context.eventName);
    expect(message).toContain(context.invitationUrl);
    expect(message).toContain(context.invitationNumber);
    expect(message).toContain("tidak meneruskannya kepada pihak di luar lembaga");
  });

  it("creates encoded WhatsApp and email share URLs with optional recipients", () => {
    const whatsappUrl = new URL(buildWhatsAppShareUrl(context, "0812 0000 1111"));
    expect(whatsappUrl.hostname).toBe("wa.me");
    expect(whatsappUrl.pathname).toBe("/6281200001111");
    expect(whatsappUrl.searchParams.get("text")).toContain(context.invitationUrl);

    const emailUrl = buildEmailShareUrl(context, "kontak@lembaga.or.id");
    expect(emailUrl).toContain("mailto:kontak@lembaga.or.id");
    expect(decodeURIComponent(emailUrl)).toContain(context.eventName);
    expect(decodeURIComponent(emailUrl)).toContain(context.invitationUrl);
  });
});
