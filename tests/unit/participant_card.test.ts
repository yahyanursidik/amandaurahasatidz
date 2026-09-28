import { describe, expect, it } from "vitest";
import { cardPath, signCardForParticipant } from "../../netlify/functions/lib/services/participantCardService";
import { verifyParticipantQrToken } from "../../netlify/functions/lib/utils/token";
import { renderHtmlEmailTemplate } from "../../netlify/functions/lib/services/emailTemplateEngine";

describe("kartu peserta pribadi", () => {
  const participant = { id: "123e4567-e89b-42d3-a456-426614174000", eventId: "123e4567-e89b-42d3-a456-426614174001", qrTokenVersion: 1 };

  it("menautkan QR yang berlaku hanya untuk event dan versi peserta tersebut", () => {
    const token = signCardForParticipant(participant);
    expect(verifyParticipantQrToken(token)).toEqual({ participantId: participant.id, eventId: participant.eventId, version: 1 });
    expect(verifyParticipantQrToken(`${token}x`)).toBeNull();
    expect(cardPath(token)).toBe(`/card?token=${encodeURIComponent(token)}`);
  });

  it("email untuk setiap peserta berisi kode dan tombol menuju kartu sendiri", () => {
    const cardLink = "https://contoh.id/card?token=pqr_abc.def";
    const rendered = renderHtmlEmailTemplate("REGISTRATION_AUTO_APPROVED", {
      ustadzName: "Ahmad", eventName: "Daurah", participantCode: "P-ABC123", cardLink,
      email: "ahmad@example.id", portalLink: "https://contoh.id/login/ustadz",
    });
    expect(rendered.textBody).toContain(cardLink);
    expect(rendered.textBody).toContain("P-ABC123");
    expect(rendered.htmlBody).toContain(`href="${cardLink.replace("&", "&amp;")}"`);
  });
});
