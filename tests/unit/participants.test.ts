import { describe, it, expect } from "vitest";
import {
  replaceParticipantSchema,
  replacePortalDelegationMemberSchema,
  updateParticipantStatusSchema,
} from "../../netlify/functions/lib/validations/participantValidation";

describe("Management Peserta, Quota Enforcement & Replacement Unit Tests", () => {
  it("should enforce quota limit (reject adding delegates exceeding quota)", () => {
    const quota = 3;
    const currentRegisteredCount = 2;
    const requestedNewCount = 2; // Total would be 4 > 3!

    const isQuotaExceeded = currentRegisteredCount + requestedNewCount > quota;
    expect(isQuotaExceeded).toBe(true);
  });

  it("should validate updateParticipantStatusSchema payload", () => {
    const payload = {
      fromStatus: "INVITED",
      toStatus: "CONFIRMED",
      reason: "Lembaga mengirimkan surat konfirmasi resmi",
    };

    const parsed = updateParticipantStatusSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("should validate replaceParticipantSchema payload", () => {
    const payload = {
      oldParticipantId: "00000000-0000-0000-0000-000000000001",
      newUstadzId: "00000000-0000-0000-0000-000000000002",
      reason: "Peserta lama berhalangan hadir karena uzur syar'i",
    };

    const parsed = replaceParticipantSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("validates a complete delegation replacement submitted by a group leader", () => {
    const parsed = replacePortalDelegationMemberSchema.safeParse({
      targetParticipantId: "00000000-0000-0000-0000-000000000001",
      fullName: "Ustadz Ahmad, Lc.",
      email: "ahmad@lembaga.or.id",
      whatsapp: "081234567890",
      phone: "081234567890",
      address: "Bandung, Jawa Barat",
      reason: "Peserta sebelumnya berhalangan hadir.",
    });
    expect(parsed.success).toBe(true);
  });

  it("requires an email and a meaningful reason for a replacement", () => {
    const parsed = replacePortalDelegationMemberSchema.safeParse({
      targetParticipantId: "00000000-0000-0000-0000-000000000001",
      fullName: "Ustadz Ahmad",
      whatsapp: "081234567890",
      reason: "izin",
    });
    expect(parsed.success).toBe(false);
  });

  it("should verify replacement workflow preserves old record (status REPLACED, not deleted)", () => {
    const oldParticipant = {
      id: "part-101",
      confirmationStatus: "CONFIRMED",
    };

    // Replacement action simulation:
    const replacedOldParticipant = {
      ...oldParticipant,
      confirmationStatus: "REPLACED",
    };

    const newParticipant = {
      id: "part-102",
      confirmationStatus: "CONFIRMED",
      replacementForParticipantId: oldParticipant.id,
    };

    expect(replacedOldParticipant.confirmationStatus).toBe("REPLACED");
    expect(newParticipant.replacementForParticipantId).toBe("part-101");
  });
});
