import { getPaginatedReportService } from "./reportService";
import { createAuditLog } from "./auditService";

export interface ExportRequestParams {
  reportType: string;
  format: "CSV" | "XLSX" | "PRINT";
  eventId?: string;
  maxRecords?: number;
}

export function formatDataToCsv(headers: string[], rows: Record<string, any>[]): string {
  const headerLine = headers.join(",");
  const rowLines = rows.map((row) =>
    headers
      .map((h) => {
        const val = row[h] !== undefined && row[h] !== null ? String(row[h]) : "";
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(",")
  );

  return [headerLine, ...rowLines].join("\n");
}

export async function generateReportExportService(
  params: ExportRequestParams,
  actorUserId?: string,
  requestId = "req-export"
) {
  const maxRecords = Math.min(10_000, Math.max(1, params.maxRecords || 5_000));
  const pageSize = Math.min(1_000, maxRecords);
  const firstPage = await getPaginatedReportService(params.reportType, {
    page: 1,
    pageSize,
    eventId: params.eventId,
  });
  const totalCount = firstPage.meta.total;
  const targetCount = Math.min(totalCount, maxRecords);
  const rows = [...firstPage.data];
  for (let page = 2; rows.length < targetCount; page += 1) {
    const next = await getPaginatedReportService(params.reportType, {
      page,
      pageSize: Math.min(pageSize, targetCount - rows.length),
      eventId: params.eventId,
    });
    if (!next.data.length) break;
    rows.push(...next.data);
  }

  const sampleRow = rows[0] || {};
  const headers = Object.keys(sampleRow);
  const csvContent = formatDataToCsv(headers, rows);

  if (requestId) {
    await createAuditLog({
      actorUserId: actorUserId || null,
      action: "REPORT_EXPORTED",
      resourceType: "REPORT",
      resourceId: params.reportType,
      reason: `Export ${params.format} laporan '${params.reportType}' (${rows.length} entri) berhasil dibuat.`,
      requestId,
    });
  }

  return {
    status: "COMPLETED",
    format: params.format,
    filename: `laporan_${params.reportType}_${Date.now()}.${params.format.toLowerCase()}`,
    contentType: params.format === "CSV" ? "text/csv" : "application/octet-stream",
    recordCount: rows.length,
    totalCount,
    truncated: rows.length < totalCount,
    data: csvContent,
  };
}
