import { describe, it, expect } from "vitest";
import { getSeedRolesData, getDemoAccountsData, getDemoInstitutionsData } from "../../scripts/seed_database";
import {
  processSpreadsheetImportDryRunService,
  commitSpreadsheetImportService,
  commitEventParticipantImportService,
  isPreviouslyImportedParticipant,
} from "../../netlify/functions/lib/services/importService";

describe("Seed Data Engine, Development Reset Script & Import Pipeline Unit Tests", () => {
  it("should generate synthetic demo accounts without real PII", async () => {
    const accounts = await getDemoAccountsData();
    expect(accounts).toHaveLength(4);

    const admin = accounts.find((a) => a.roleCode === "SUPER_ADMIN");
    expect(admin?.email).toBe("admin@yts.or.id");
    expect(admin?.fullName).toContain("Demo YTS");
  });

  it("should generate synthetic demo institutions without real PII", async () => {
    const insts = await getDemoInstitutionsData();
    expect(insts).toHaveLength(3);
    expect(insts[0].email).toContain("@mahadsunnahbdg.or.id");
  });

  it("should perform dry-run spreadsheet validation compiling errorReport and duplicateReport without DB mutation", async () => {
    const testRows = [
      { name: "Ma'had Sunnah Solo", email: "info@mahadsunnahsolo.or.id", phone: "081299998888" },
      { name: "X", email: "invalid-email-format", phone: "123" }, // Invalid row
    ];

    const previous = process.env.DATABASE_URL;
    try {
      delete process.env.DATABASE_URL;
      const dryRun = await processSpreadsheetImportDryRunService(testRows);
      expect(dryRun.totalRows).toBe(2);
      expect(dryRun.errorReport.length).toBeGreaterThan(0);
      expect(dryRun.errorReport.some((e) => e.field === "email")).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });

  it("should reject production import commit if explicit approval flag is missing (approved !== true)", async () => {
    await expect(
      commitSpreadsheetImportService(
        {
          rows: [{ name: "Ma'had Solo", email: "info@mahadsunnahsolo.or.id" }],
          approved: false, // Rejected
          targetType: "INSTITUTIONS",
        },
        "user-admin-123"
      )
    ).rejects.toThrow("dilarang tanpa konfirmasi preview dan persetujuan eksplisit");
  });

  it("keeps every valid institution row and detects duplicates within the file", async () => {
    const previous = process.env.DATABASE_URL;
    try {
      delete process.env.DATABASE_URL;
      const rows = Array.from({ length: 12 }, (_, index) => ({
        code: `INST-${index + 1}`,
        name: `Lembaga ${index + 1}`,
        email: `lembaga${index + 1}@example.org`,
      }));
      const preview = await processSpreadsheetImportDryRunService(rows);
      expect(preview.validCount).toBe(12);
      expect(preview.previewData).toHaveLength(12);
      const withDuplicate = await processSpreadsheetImportDryRunService([...rows, { ...rows[0], code: "INST-13" }]);
      expect(withDuplicate.duplicateCount).toBeGreaterThan(0);
    } finally {
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });

  it("rejects unsupported generic USTADZ import instead of reporting zero success", async () => {
    await expect(commitSpreadsheetImportService({
      rows: [{ name: "Ahmad", email: "ahmad@example.org" }],
      approved: true,
      targetType: "USTADZ",
    })).rejects.toThrow(/hanya mendukung data lembaga/);
  });

  it("should reject event participant import commit without explicit admin approval", async () => {
    await expect(
      commitEventParticipantImportService(
        "00000000-0000-4000-8000-000000000001",
        {
          rows: [
            {
              fullName: "Ustadz Demo Upload",
              email: "ustadz.demo.upload@example.org",
              whatsapp: "081299998888",
            },
          ],
          approved: false,
        },
        "user-admin-123",
      )
    ).rejects.toThrow("belum ada persetujuan eksplisit");
  });

  it("recognizes only matching rows from a previous admin upload", () => {
    const existing = {
      participantCode: "ADA-EVENT-001",
      registrationSource: "DIRECT_ADMIN_UPLOAD",
      normalizedName: "ahmad abdullah",
      email: "ahmad@example.org",
      phone: "628123456789",
      whatsapp: "628123456789",
      institutionCode: "INST-1",
      institutionName: "Ma'had Ilmu",
    };
    const row = {
      fullName: "Ustadz Ahmad Abdullah",
      email: "AHMAD@example.org",
      whatsapp: "08123456789",
      institutionCode: "INST-1",
    };
    expect(isPreviouslyImportedParticipant(row, existing)).toBe(true);
    expect(isPreviouslyImportedParticipant({ ...row, institutionCode: "INST-2" }, existing)).toBe(false);
    expect(isPreviouslyImportedParticipant({ ...row, email: "other@example.org" }, existing)).toBe(false);
    expect(isPreviouslyImportedParticipant(row, { ...existing, registrationSource: "INSTITUTION_DELEGATION" })).toBe(false);
  });
});
