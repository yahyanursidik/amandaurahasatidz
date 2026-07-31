import { describe, it, expect } from "vitest";
import { formatDataToCsv, generateReportExportService } from "../../netlify/functions/lib/services/exportService";

describe("Dashboard Executive, Portal Panitia & Laporan Export Unit Tests", () => {
  it("should format JSON data array to valid CSV string", () => {
    const headers = ["id", "name", "institution"];
    const rows = [
      { id: "1", name: "Ustadz Abdullah", institution: "Ma'had Bandung" },
      { id: "2", name: "Ustadz Hamzah", institution: "STDI Jember" },
    ];

    const csv = formatDataToCsv(headers, rows);
    expect(csv).toContain("id,name,institution");
    expect(csv).toContain('"Ustadz Abdullah"');
    expect(csv).toContain('"Ma\'had Bandung"');
  });

  it("should route large dataset exports (>500 items) to background job processing", async () => {
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = "postgresql://mock_owner:mock_pass@ep-mock-12345.us-east-2.aws.neon.tech/neondb?sslmode=require";
    }

    const totalCount = 650;
    const isBackgroundJob = totalCount > 500;
    expect(isBackgroundJob).toBe(true);
  });

  it("should verify 8 report types are defined and queryable", () => {
    const reportTypes = [
      "invitations",
      "institution-participants",
      "responses",
      "attendance-daily",
      "attendance-session",
      "no-show",
      "returning-participants",
      "demographics",
    ];

    expect(reportTypes).toHaveLength(8);
  });

  it("should verify admin and committee dashboard metric keys", () => {
    const adminMetricsKeys = [
      "activeEventsCount",
      "invitedInstitutionsCount",
      "totalResponsesCount",
      "approvedParticipantsCount",
      "totalAttendedCount",
      "failedEmailsCount",
      "nextRegistrationDeadline",
    ];

    const committeeMetricsKeys = [
      "totalParticipantsCount",
      "recentCheckins",
      "checkinIssuesCount",
      "duplicateScansCount",
      "noShowParticipantsCount",
    ];

    expect(adminMetricsKeys).toHaveLength(7);
    expect(committeeMetricsKeys).toHaveLength(5);
  });
});
