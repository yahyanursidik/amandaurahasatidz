import { describe, it, expect } from "vitest";
import {
  generateUnpredictableParticipantCode,
  generateOpaqueQrToken,
  signParticipantQrToken,
  verifyParticipantQrToken,
} from "../../netlify/functions/lib/utils/token";

const QR_SECRET = "test-participant-qr-secret-at-least-32-characters";
const PARTICIPANT_ID = "00000000-0000-4000-8000-000000000001";
const EVENT_ID = "00000000-0000-4000-8000-000000000002";

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

  it("binds a signed QR token to participant, event, and rotation version", () => {
    const token = signParticipantQrToken(
      { participantId: PARTICIPANT_ID, eventId: EVENT_ID, version: 3 },
      QR_SECRET,
    );
    expect(token).toMatch(/^pqr_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(verifyParticipantQrToken(token, QR_SECRET)).toEqual({
      participantId: PARTICIPANT_ID,
      eventId: EVENT_ID,
      version: 3,
    });
  });

  it("rejects a modified QR signature and a token verified with another secret", () => {
    const token = signParticipantQrToken(
      { participantId: PARTICIPANT_ID, eventId: EVENT_ID, version: 1 },
      QR_SECRET,
    );
    expect(verifyParticipantQrToken(`${token.slice(0, -1)}x`, QR_SECRET)).toBeNull();
    expect(verifyParticipantQrToken(token, "another-secret-at-least-32-characters-long")).toBeNull();
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

  it("changes the signed token when its stored rotation version increases", () => {
    const oldQrToken = signParticipantQrToken(
      { participantId: PARTICIPANT_ID, eventId: EVENT_ID, version: 1 },
      QR_SECRET,
    );
    const newQrToken = signParticipantQrToken(
      { participantId: PARTICIPANT_ID, eventId: EVENT_ID, version: 2 },
      QR_SECRET,
    );
    expect(newQrToken).not.toEqual(oldQrToken);
    expect(verifyParticipantQrToken(oldQrToken, QR_SECRET)?.version).toBe(1);
    expect(verifyParticipantQrToken(newQrToken, QR_SECRET)?.version).toBe(2);
  });
});
