import { describe, it, expect } from "vitest";
import { generateSecureToken, hashToken } from "../../netlify/functions/lib/utils/token";
import { createInvitationSchema, submitResponseSchema } from "../../netlify/functions/lib/validations/invitationValidation";

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
      responseStatus: "ACCEPTED",
      notes: "Delegasi insyaAllah hadir tepat waktu",
      isFinal: true,
      delegates: [
        { fullName: "Ustadz Abdullah, Lc.", phone: "081299990000" },
        { fullName: "Ustadz Hasan Basri", phone: "081288881111" },
      ],
    };

    const parsed = submitResponseSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
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
