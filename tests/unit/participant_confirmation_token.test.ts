import { describe, expect, it } from "vitest";
import { participantPrivateLinkBinding, signParticipantConfirmationToken, verifyParticipantConfirmationToken, verifyParticipantQrToken } from "../../netlify/functions/lib/utils/token";
import { participantConfirmationPath, registrationStatusUrl, signConfirmationForParticipant } from "../../netlify/functions/lib/services/participantConfirmationLink";

const participantId = "123e4567-e89b-42d3-a456-426614174000";
const eventId = "123e4567-e89b-42d3-a456-426614174001";

describe("tautan konfirmasi pribadi", () => {
  it("mengikat peserta dan event, bukan token QR; tidak bocor ke path atau query", () => {
    const token = signConfirmationForParticipant({ id: participantId, eventId }, "2099-11-11");
    expect(token).toMatch(/^prc_/);
    expect(verifyParticipantConfirmationToken(token)).toMatchObject({ participantId, eventId, purpose: "RECEIPT" });
    expect(verifyParticipantQrToken(token)).toBeNull();
    expect(participantConfirmationPath(token)).toBe(`/confirm#${encodeURIComponent(token)}`);
    expect(verifyParticipantConfirmationToken(`${token}x`)).toBeNull();
  });

  it("menolak token yang kedaluwarsa", () => {
    const token = signParticipantConfirmationToken({ participantId, eventId, expiresAt: 2_000_000_000_000 });
    expect(verifyParticipantConfirmationToken(token, 1_999_999_999_999)).not.toBeNull();
    expect(verifyParticipantConfirmationToken(token, 2_000_000_000_000)).toBeNull();
  });

  it("binds private access to the owner, email and last rotation without exposing their values", () => {
    const ustadzId = "123e4567-e89b-42d3-a456-426614174002";
    const email = "ahmad@confirmation.invalid";
    const now = 2_000_000_000_000;
    const link = registrationStatusUrl({ id: participantId, eventId, ustadzId, email, qrRotatedAt: null }, now);
    const token = decodeURIComponent(new URL(link).hash.slice(1));
    const payload = verifyParticipantConfirmationToken(token, now);
    expect(token).toMatch(/^pcf_/);
    expect(payload).toMatchObject({ participantId, eventId, purpose: "PRIVATE_ACCESS", expiresAt: now + 30 * 60_000,
      binding: participantPrivateLinkBinding(ustadzId, email, null) });
    expect(JSON.stringify(payload)).not.toContain(email);
    expect(payload?.binding).not.toBe(participantPrivateLinkBinding(ustadzId, "other@confirmation.invalid", null));
    expect(payload?.binding).not.toBe(participantPrivateLinkBinding(ustadzId, email, new Date(now)));
    expect(payload?.binding).toBe(participantPrivateLinkBinding(ustadzId, email.toUpperCase(), null));
    expect(verifyParticipantConfirmationToken(token, now + 30 * 60_000)).toBeNull();
    expect(verifyParticipantConfirmationToken(token.replace(/^pcf_/, "prc_"), now)).toBeNull();
    expect(verifyParticipantQrToken(token)).toBeNull();
    const incomplete = signParticipantConfirmationToken({ participantId, eventId, purpose: "PRIVATE_ACCESS", expiresAt: now + 1000 });
    expect(verifyParticipantConfirmationToken(incomplete, now)).toBeNull();
  });
});
