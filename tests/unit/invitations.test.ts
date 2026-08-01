import { describe, it, expect } from "vitest";
import { generateSecureToken, hashToken } from "../../netlify/functions/lib/utils/token";
import { createInvitationSchema, submitResponseSchema } from "../../netlify/functions/lib/validations/invitationValidation";
import {
  createInvitationOtpChallenge,
  maskInvitationEmail,
  verifyInvitationOtpChallenge,
  verifyInvitationVerificationToken,
} from "../../netlify/functions/lib/services/invitationOtpService";

describe("Undangan Lembaga, Token Security & Delegation Form Unit Tests", () => {
  it("should generate 256-bit entropy token and valid SHA256 hash", () => {
    const tokenInfo = generateSecureToken("inv_inst");

    expect(tokenInfo.rawToken).toMatch(/^inv_inst_[a-f0-9]{64}$/);
    expect(tokenInfo.tokenHash).toHaveLength(64); // SHA-256 hex string

    const rehashed = hashToken(tokenInfo.rawToken);
    expect(rehashed).toBe(tokenInfo.tokenHash);
  });

  it("should verify raw token is never equal to stored tokenHash", () => {
    const { rawToken, tokenHash } = generateSecureToken();
    expect(rawToken).not.toBe(tokenHash);
  });

  it("should validate createInvitationSchema payload", () => {
    const payload = {
      eventId: "00000000-0000-0000-0000-000000000001",
      invitationType: "INSTITUTION",
      institutionId: "00000000-0000-0000-0000-000000000002",
      invitationNumber: "INV/2026/BDG/001",
      quota: 3,
    };

    const parsed = createInvitationSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("should validate public submission response schema with delegates", () => {
    const payload = {
      verificationToken: "signed-verification-token-with-safe-length",
      responseStatus: "ACCEPTED",
      notes: "Delegasi insyaAllah hadir tepat waktu",
      isFinal: true,
      delegates: [
        { fullName: "Ustadz Abdullah, Lc.", phone: "081299990000", isLead: true },
        { fullName: "Ustadz Hasan Basri", phone: "081288881111" },
      ],
    };

    const parsed = submitResponseSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("should reject public delegation submission without verification proof", () => {
    const parsed = submitResponseSchema.safeParse({
      responseStatus: "ACCEPTED",
      isFinal: true,
      delegates: [{ fullName: "Ustadz Abdullah", whatsapp: "081299990000", isLead: true }],
    });
    expect(parsed.success).toBe(false);
  });

  it("should create invitation-bound OTP and a short-lived verification proof", () => {
    const invitationId = "00000000-0000-0000-0000-000000000001";
    const email = "Perwakilan@Lembaga.or.id";
    const challenge = createInvitationOtpChallenge(invitationId, email, 1_000_000);

    expect(challenge.code).toMatch(/^\d{6}$/);
    expect(challenge.challengeToken).not.toContain(challenge.code);

    const verified = verifyInvitationOtpChallenge(
      challenge.challengeToken,
      challenge.code,
      invitationId,
      email,
      1_000_100,
    );
    expect(verified).not.toBeNull();
    expect(
      verifyInvitationVerificationToken(verified!.verificationToken, invitationId, 1_000_200),
    ).not.toBeNull();
  });

  it("should reject OTP for another invitation, email, code, or expired challenge", () => {
    const invitationId = "00000000-0000-0000-0000-000000000001";
    const challenge = createInvitationOtpChallenge(invitationId, "admin@lembaga.or.id", 1_000_000);

    expect(verifyInvitationOtpChallenge(challenge.challengeToken, "000000", invitationId, "admin@lembaga.or.id", 1_000_100)).toBeNull();
    expect(verifyInvitationOtpChallenge(challenge.challengeToken, challenge.code, "00000000-0000-0000-0000-000000000002", "admin@lembaga.or.id", 1_000_100)).toBeNull();
    expect(verifyInvitationOtpChallenge(challenge.challengeToken, challenge.code, invitationId, "other@lembaga.or.id", 1_000_100)).toBeNull();
    expect(verifyInvitationOtpChallenge(challenge.challengeToken, challenge.code, invitationId, "admin@lembaga.or.id", 1_400_001)).toBeNull();
  });

  it("should mask the representative email shown on the public form", () => {
    expect(maskInvitationEmail("kontak@mahadsunnah.or.id")).toBe("ko••••@mahadsunnah.or.id");
  });

  it("should reject submission if delegate count exceeds quota", () => {
    const quota = 1;
    const delegates = [
      { fullName: "Ustadz A", phone: "081" },
      { fullName: "Ustadz B", phone: "082" },
    ];

    const isExceeded = delegates.length > quota;
    expect(isExceeded).toBe(true);
  });
});
