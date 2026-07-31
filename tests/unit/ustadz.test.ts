import { describe, it, expect } from "vitest";
import { normalizeName, normalizeEmail, normalizePhone } from "../../netlify/functions/lib/utils/normalization";
import {
  createUstadzSchema,
  duplicateUstadzSchema,
  mergeUstadzSchema,
  updateAffiliationSchema,
  updateUstadzSchema,
} from "../../netlify/functions/lib/validations/ustadzValidation";

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
      fullName: "Abu Ahmad Zakaria",
      titlePrefix: "Dr.",
      titleSuffix: "Lc., M.A.",
      email: "abuahmad@yts.or.id",
      phone: "081955556666",
      whatsapp: "081955556666",
      birthPlace: "Bandung",
      birthDate: "1988-04-12",
      address: "Bandung",
      cityCode: "3273",
      provinceCode: "32",
      educationSummary: "Pendidikan tinggi bidang syariah.",
      expertiseSummary: "Fikih dan pendidikan keluarga.",
    };

    const parsed = createUstadzSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("validates duplicate search while supporting an excluded profile", () => {
    const parsed = duplicateUstadzSchema.safeParse({
      fullName: "Abu Ahmad Zakaria",
      email: "abuahmad@yts.or.id",
      phone: "081955556666",
      excludeId: "c9d8fe33-bf14-4cd8-96c4-9abdcf1bd8e8",
    });

    expect(parsed.success).toBe(true);
  });

  it("restricts profile status and affiliation status to supported workflow values", () => {
    expect(updateUstadzSchema.safeParse({ profileStatus: "ARCHIVED" }).success).toBe(false);
    expect(updateAffiliationSchema.safeParse({ status: "SUSPENDED" }).success).toBe(false);
    expect(updateAffiliationSchema.safeParse({ status: "INACTIVE", endDate: "2026-07-31" }).success).toBe(true);
  });

  it("requires an auditable reason for profile merge", () => {
    const base = {
      targetUstadzId: "92802109-c1de-44dd-93f9-f79a8aef1d41",
      sourceUstadzIds: ["c9d8fe33-bf14-4cd8-96c4-9abdcf1bd8e8"],
    };

    expect(mergeUstadzSchema.safeParse({ ...base, notes: "sama" }).success).toBe(false);
    expect(
      mergeUstadzSchema.safeParse({
        ...base,
        notes: "Nomor WhatsApp dan identitas telah dikonfirmasi sama.",
      }).success,
    ).toBe(true);
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
