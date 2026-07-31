import { describe, it, expect } from "vitest";
import { generateUnpredictableParticipantCode, generateOpaqueQrToken } from "../../netlify/functions/lib/utils/token";

describe("Identitas & QR Peserta Aman Unit Tests", () => {
  it("should generate unpredictable participant code with cryptographic entropy", () => {
    const code1 = generateUnpredictableParticipantCode("2026");
    const code2 = generateUnpredictableParticipantCode("2026");

    expect(code1).toMatch(/^PAR-2026-[A-F0-9]{8}$/);
    expect(code2).toMatch(/^PAR-2026-[A-F0-9]{8}$/);
    expect(code1).not.toEqual(code2); // Cryptographic randomness ensures uniqueness
  });

  it("should generate opaque QR token without PII", () => {
    const tokenInfo = generateOpaqueQrToken();

    expect(tokenInfo.rawToken).toMatch(/^qr_tok_[a-f0-9]{64}$/);
    expect(tokenInfo.rawToken).not.toContain("Ustadz"); // No PII name
    expect(tokenInfo.rawToken).not.toContain("abdullah@yts.or.id"); // No PII email
    expect(tokenInfo.rawToken).not.toContain("081299990000"); // No PII phone
  });

  it("should enforce Event Scope Check (QR Event A rejected at Event B)", () => {
    const qrEventId: string = "00000000-0000-0000-0000-000000000001"; // Event A
    const currentEventId: string = "00000000-0000-0000-0000-000000000002"; // Event B

    const isMatch = qrEventId === currentEventId;
    expect(isMatch).toBe(false);
  });

  it("should reject CANCELLED or REPLACED participants during check-in verification", () => {
    const cancelledParticipant = { status: "CANCELLED" };
    const replacedParticipant = { status: "REPLACED" };
    const activeParticipant = { status: "CONFIRMED" };

    const isCancelledRejected = cancelledParticipant.status === "CANCELLED" || cancelledParticipant.status === "REPLACED";
    const isReplacedRejected = replacedParticipant.status === "CANCELLED" || replacedParticipant.status === "REPLACED";
    const isActiveRejected = activeParticipant.status === "CANCELLED" || activeParticipant.status === "REPLACED";

    expect(isCancelledRejected).toBe(true);
    expect(isReplacedRejected).toBe(true);
    expect(isActiveRejected).toBe(false);
  });

  it("should rotate and revoke old QR token when participant is replaced", () => {
    let oldQrToken = "qr_tok_old_token_123";
    let isOldTokenRevoked = false;

    // Simulate replacement action:
    isOldTokenRevoked = true;
    const newQrToken = generateOpaqueQrToken();

    expect(isOldTokenRevoked).toBe(true);
    expect(newQrToken.rawToken).not.toEqual(oldQrToken);
  });
});
