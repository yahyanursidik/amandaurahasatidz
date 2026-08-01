import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createInstitutionAccessVerification,
  getInstitutionAccessCode,
  verifyInstitutionAccessCode,
  verifyInstitutionAccessVerification,
} from "./institutionAccessCodeService";

describe("institutionAccessCodeService", () => {
  beforeEach(() => {
    vi.stubEnv("INVITATION_ACCESS_SECRET", "test-secret-with-sufficient-entropy-2026");
  });

  it("menghasilkan kode stabil dan mudah dibaca untuk satu undangan", () => {
    const invitationId = "9cb90f89-0ed1-40ac-82b9-2cd4647c4065";
    const first = getInstitutionAccessCode(invitationId);
    const second = getInstitutionAccessCode(invitationId);

    expect(first).toBe(second);
    expect(first).toMatch(/^[23456789A-HJ-NP-Z]{4}-[23456789A-HJ-NP-Z]{4}$/);
    expect(verifyInstitutionAccessCode(invitationId, first.toLowerCase())).toBe(true);
    expect(verifyInstitutionAccessCode(invitationId, "AMAN-2026")).toBe(false);
  });

  it("mengikat token verifikasi ke undangan yang benar", () => {
    const invitationId = "9cb90f89-0ed1-40ac-82b9-2cd4647c4065";
    const verification = createInstitutionAccessVerification(invitationId);

    expect(verifyInstitutionAccessVerification(verification.verificationToken, invitationId)).toBe(true);
    expect(
      verifyInstitutionAccessVerification(
        verification.verificationToken,
        "ef1585ad-12c8-44db-bd7c-2b7940c82842",
      ),
    ).toBe(false);
  });
});
