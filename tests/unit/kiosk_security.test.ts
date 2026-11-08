import { describe, expect, it } from "vitest";
import { assertKioskWriteOrigin, isKioskCookieShape, isKioskPairingToken, isSignedParticipantQr, kioskCookieName } from "../../netlify/functions/lib/services/kioskService";
import { publicKioskCheckinSchema } from "../../netlify/functions/lib/validations/attendanceValidation";
import { signParticipantQrToken } from "../../netlify/functions/lib/utils/token";

const eventId = "00000000-0000-4000-8000-000000000001";
const dayId = "00000000-0000-4000-8000-000000000002";
const sessionId = "00000000-0000-4000-8000-000000000003";
const qrToken = signParticipantQrToken({ participantId: dayId, eventId, version: 1 }, "test-secret");

describe("kiosk publik", () => {
  it("hanya menerima format QR peserta dan tepat satu unit kehadiran", () => {
    expect(isSignedParticipantQr(qrToken)).toBe(true);
    expect(isSignedParticipantQr("PAR-2026-ABCDEF12")).toBe(false);
    expect(publicKioskCheckinSchema.safeParse({ qrToken, dayId }).success).toBe(true);
    expect(publicKioskCheckinSchema.safeParse({ qrToken: "PAR-2026-ABCDEF12", dayId }).success).toBe(false);
    expect(publicKioskCheckinSchema.safeParse({ qrToken, dayId, sessionId }).success).toBe(false);
    expect(publicKioskCheckinSchema.safeParse({ qrToken }).success).toBe(false);
    expect(publicKioskCheckinSchema.safeParse({ qrToken, dayId, method: "MANUAL_CODE" }).success).toBe(false);
  });

  it("menolak tulisan silang situs pada endpoint kiosk", () => {
    expect(() => assertKioskWriteOrigin({ origin: "https://ada.example", host: "ada.example", "sec-fetch-site": "same-origin" })).not.toThrow();
    expect(() => assertKioskWriteOrigin({ origin: "https://other.example", host: "ada.example", "sec-fetch-site": "cross-site" })).toThrow();
    expect(() => assertKioskWriteOrigin({ host: "ada.example" })).toThrow();
  });
  it("membedakan cookie tiap event dan menolak kredensial cacat sebelum query database", () => {
    expect(kioskCookieName("daurah-a")).not.toBe(kioskCookieName("daurah-b"));
    expect(isKioskCookieShape(`${eventId}.kdev_${"a".repeat(64)}`)).toBe(true);
    expect(isKioskCookieShape("device-token")).toBe(false);
    expect(isKioskPairingToken(`kpair_${"b".repeat(64)}`)).toBe(true);
    expect(isKioskPairingToken("guess")).toBe(false);
  });
});
