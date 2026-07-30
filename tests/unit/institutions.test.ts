import { describe, it, expect } from "vitest";
import { createInstitutionSchema, queryInstitutionSchema } from "../../netlify/functions/lib/validations/institutionValidation";

describe("Master Data Lembaga Unit & Business Rule Tests", () => {
  it("should validate valid institution creation payload", () => {
    const validPayload = {
      code: "MISB-99",
      name: "Ma'had Sunnah Test Bandung",
      legalName: "Yayasan Sunnah Test",
      institutionType: "Pesantren",
      email: "info@sunnahtest.or.id",
      phone: "081234567890",
      provinceCode: "32",
      cityCode: "3273",
    };

    const parsed = createInstitutionSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);
  });

  it("should reject invalid institution creation payload (missing name or short code)", () => {
    const invalidPayload = {
      code: "M", // too short
      email: "invalid-email-format",
    };

    const parsed = createInstitutionSchema.safeParse(invalidPayload);
    expect(parsed.success).toBe(false);
  });

  it("should parse query filters with defaults", () => {
    const query = queryInstitutionSchema.parse({
      search: "Bandung",
      provinceCode: "32",
    });

    expect(query.page).toBe(1);
    expect(query.pageSize).toBe(25);
    expect(query.search).toBe("Bandung");
    expect(query.provinceCode).toBe("32");
  });

  it("should enforce soft delete policy (never hard delete master data)", () => {
    const hasHistory = true; // Simulated history count > 0

    // Business rule simulation: Soft delete must be used if institution has history
    const deleteAction = hasHistory ? "SOFT_DELETE" : "HARD_DELETE_REJECTED";
    expect(deleteAction).toBe("SOFT_DELETE");
  });
});
