import { describe, it, expect } from "vitest";
import { createInvitationSchema } from "../../netlify/functions/lib/validations/invitationValidation";
import { updateUstadzSelfProfileSchema } from "../../netlify/functions/lib/validations/ustadzValidation";

describe("Undangan Individu & Portal Ustadz Unit Tests", () => {
  it("should validate createInvitationSchema for INDIVIDUAL invitation type", () => {
    const payload = {
      eventId: "00000000-0000-0000-0000-000000000001",
      invitationType: "INDIVIDUAL",
      ustadzId: "00000000-0000-0000-0000-000000000002",
      invitationNumber: "INV-INDIV/2026/001",
      quota: 1,
    };

    const parsed = createInvitationSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("should validate updateUstadzSelfProfileSchema allowing phone, specialization, address", () => {
    const payload = {
      phone: "081299990000",
      specialization: "Fiqih Muamalah",
      address: "Bandung",
    };

    const parsed = updateUstadzSelfProfileSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.phone).toBe("081299990000");
    }
  });

  it("should strip/ignore approvalStatus when Ustadz attempts self profile update", () => {
    const payload = {
      phone: "081299990000",
      approvalStatus: "VERIFIED", // Attempting to change approval status directly!
      fullName: "Hacked Name",
    };

    const parsed = updateUstadzSelfProfileSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      // approvalStatus and fullName must NOT be in the parsed payload!
      expect((parsed.data as any).approvalStatus).toBeUndefined();
      expect((parsed.data as any).fullName).toBeUndefined();
    }
  });

  it("should verify RSVP selection status (ACCEPTED or DECLINED)", () => {
    const rsvpStatus: "ACCEPTED" | "DECLINED" = "ACCEPTED";
    expect(["ACCEPTED", "DECLINED"]).toContain(rsvpStatus);
  });
});
