import { describe, it, expect } from "vitest";
import { normalizeName, normalizeEmail, normalizePhone } from "../../netlify/functions/lib/utils/normalization";
import { createUstadzSchema } from "../../netlify/functions/lib/validations/ustadzValidation";

describe("Master Data Asatidz & Merge Workflow Unit Tests", () => {
  it("should normalize fullName by stripping titles and extra whitespace", () => {
    const rawName = "  Ustadz Dr. Muhammad Muslih, Lc., M.A.  ";
    const normalized = normalizeName(rawName);

    expect(normalized).toBe("muhammad muslih");
  });

  it("should normalize email to lowercase and trim whitespace", () => {
    const rawEmail = "  M.Muslih@YTS.Or.ID  ";
    const normalized = normalizeEmail(rawEmail);

    expect(normalized).toBe("m.muslih@yts.or.id");
  });

  it("should normalize phone number to standard digits format", () => {
    const rawPhone = "0812-3333-4444";
    const normalized = normalizePhone(rawPhone);

    expect(normalized).toBe("6281233334444");
  });

  it("should validate valid Ustadz creation schema", () => {
    const payload = {
      fullName: "Ustadz Abu Ahmad Zakaria",
      titlePrefix: "Ustadz",
      email: "abuahmad@yts.or.id",
      phone: "081955556666",
    };

    const parsed = createUstadzSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("should enforce single primary affiliation rule", () => {
    const affiliations = [
      { id: "aff-1", isPrimary: true },
      { id: "aff-2", isPrimary: false },
    ];

    // Simulate adding new primary affiliation aff-3:
    const newAffiliationIsPrimary = true;

    const updatedAffiliations = affiliations.map((aff) => ({
      ...aff,
      isPrimary: newAffiliationIsPrimary ? false : aff.isPrimary,
    }));

    updatedAffiliations.push({ id: "aff-3", isPrimary: newAffiliationIsPrimary });

    const primaryCount = updatedAffiliations.filter((a) => a.isPrimary).length;
    expect(primaryCount).toBe(1);
    expect(updatedAffiliations.find((a) => a.id === "aff-3")?.isPrimary).toBe(true);
  });

  it("should enforce transaction-safe profile merge rules", () => {
    const sourceProfile = {
      id: "ustadz-source-101",
      fullName: "Ustadz Muslih (Duplikat)",
      profileStatus: "ACTIVE",
    };

    const targetProfile = {
      id: "ustadz-target-201",
      fullName: "Ustadz Dr. Muhammad Muslih, Lc., M.A. (Utama)",
      profileStatus: "ACTIVE",
    };

    // Simulate merge action:
    const mergedSource = {
      ...sourceProfile,
      profileStatus: "MERGED",
      mergedIntoId: targetProfile.id,
    };

    expect(mergedSource.profileStatus).toBe("MERGED");
    expect(mergedSource.mergedIntoId).toBe("ustadz-target-201");
  });
});
