import { describe, it, expect } from "vitest";
import { getSeedRolesData, getDemoAccountsData, getDemoInstitutionsData } from "../../scripts/seed_database";
import {
  processSpreadsheetImportDryRunService,
  commitSpreadsheetImportService,
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

    const dryRun = await processSpreadsheetImportDryRunService(testRows);
    expect(dryRun.totalRows).toBe(2);
    expect(dryRun.errorReport.length).toBeGreaterThan(0);
    expect(dryRun.errorReport.some((e) => e.field === "email")).toBe(true);
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
});
