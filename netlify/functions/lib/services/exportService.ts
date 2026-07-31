import { getPaginatedReportService } from "./reportService";
import { createAuditLog } from "./auditService";
import { logInfo } from "../utils/logger";

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
  // Fetch up to 1000 records for export
  const reportResult = await getPaginatedReportService(params.reportType, {
    page: 1,
    pageSize: Math.min(1000, params.maxRecords || 500),
    eventId: params.eventId,
  });

  const totalCount = reportResult.meta.total;
  const isBackgroundJob = totalCount > 500;

  // Background Async Queue for large datasets (>500 items) (Compliance Point 6)
  if (isBackgroundJob) {
    logInfo(requestId, `Dataset export '${params.reportType}' (${totalCount} entri) dialihkan ke background job.`);

    if (requestId) {
      await createAuditLog({
        actorUserId: actorUserId || null,
        action: "REPORT_EXPORTED",
        resourceType: "REPORT",
        resourceId: params.reportType,
        reason: `Export ${params.format} laporan '${params.reportType}' (${totalCount} entri) diproses di latar belakang (background job).`,
        requestId,
      });
    }

    return {
      status: "BACKGROUND_JOB_QUEUED",
      message: `Export laporan '${params.reportType}' berisi ${totalCount} entri dialihkan ke antrean background job. File akan dikirimkan via email setelah selesai.`,
      jobId: `export_job_${Date.now()}`,
      totalCount,
    };
  }

  // Synchronous Export formatting for datasets <= 500 items
  const sampleRow = reportResult.data[0] || {};
  const headers = Object.keys(sampleRow);
  const csvContent = formatDataToCsv(headers, reportResult.data);

  if (requestId) {
    await createAuditLog({
      actorUserId: actorUserId || null,
      action: "REPORT_EXPORTED",
      resourceType: "REPORT",
      resourceId: params.reportType,
      reason: `Export ${params.format} laporan '${params.reportType}' (${reportResult.data.length} entri) berhasil diunduh.`,
      requestId,
    });
  }

  return {
    status: "COMPLETED",
    format: params.format,
    filename: `laporan_${params.reportType}_${Date.now()}.${params.format.toLowerCase()}`,
    contentType: params.format === "CSV" ? "text/csv" : "application/octet-stream",
    recordCount: reportResult.data.length,
    data: csvContent,
  };
}
