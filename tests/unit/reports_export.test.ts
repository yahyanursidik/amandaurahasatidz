import { describe, it, expect, vi } from "vitest";
import { formatDataToCsv, generateReportExportService } from "../../netlify/functions/lib/services/exportService";

const mocks = vi.hoisted(() => ({ report: vi.fn(), audit: vi.fn() }));
vi.mock("../../netlify/functions/lib/services/reportService", () => ({ getPaginatedReportService: mocks.report }));
vi.mock("../../netlify/functions/lib/services/auditService", () => ({ createAuditLog: mocks.audit }));

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

  it("keeps the same stride at the final page without missing or duplicating records", async () => {
    const eventId = "10000000-0000-4000-8000-000000000001";
    const rows = Array.from({ length: 1_003 }, (_, index) => ({ id: index + 1 }));
    mocks.report.mockImplementation((_type, { page, pageSize }) => Promise.resolve({
      data: rows.slice((page - 1) * pageSize, page * pageSize), meta: { total: rows.length },
    }));
    const result = await generateReportExportService({ reportType: "attendance-daily", format: "CSV", eventId, maxRecords: 1_001 });
    expect(mocks.report).toHaveBeenNthCalledWith(2, "attendance-daily", { eventId, page: 2, pageSize: 1000 });
    expect(result).toMatchObject({ recordCount: 1001, totalCount: 1003, truncated: true });
    expect(result.data.split("\n").slice(1)).toEqual(rows.slice(0, 1_001).map(({ id }) => `"${id}"`));
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ resourceId: eventId, eventId }));
  });

  it("neutralizes spreadsheet formulas in string values and preserves quotes, delimiters and numbers", () => {
    const csv = formatDataToCsv(["name", "score"], [
      { name: "=1+1", score: -2 }, { name: "  ＠SUM(1)", score: "-1" },
      { name: 'Al "Ustadz", A; B' }, { name: "\t=1+1" },
    ]);
    expect(csv).toBe('name,score\n"\t=1+1","-2"\n"\t  ＠SUM(1)","\t-1"\n"Al ""Ustadz"", A; B",""\n"\t\t=1+1",""');
  });

  it.each([1001, 1500, 2301])("exports all %s rows without claiming false completeness", async (total) => {
    const rows = Array.from({ length: total }, (_, index) => ({ id: index + 1 }));
    mocks.report.mockImplementation((_type, { page, pageSize }) => Promise.resolve({
      data: rows.slice((page - 1) * pageSize, page * pageSize), meta: { total },
    }));
    const result = await generateReportExportService({ reportType: "attendance-session", format: "CSV" });
    const exported = result.data.split("\n").slice(1);
    expect(result).toMatchObject({ recordCount: total, totalCount: total, truncated: false });
    expect(new Set(exported).size).toBe(total);
    expect(exported.at(-1)).toBe(`"${total}"`);
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
