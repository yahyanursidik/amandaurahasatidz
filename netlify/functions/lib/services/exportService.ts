import { getPaginatedReportService } from "./reportService";
import { createAuditLog } from "./auditService";
import { ValidationError } from "../utils/errors";

export interface ExportRequestParams {
  reportType: string;
  format: "CSV" | "XLSX" | "PRINT";
  eventId?: string;
  maxRecords?: number;
}

export function formatDataToCsv(headers: string[], rows: Record<string, any>[]): string {
  // CSV quoting alone does not prevent spreadsheet formulas. Prefix potentially
  // executable strings with a literal tab within the quoted field (Excel).
  const cell = (value: unknown, alwaysQuote = true) => {
    const text = value instanceof Date ? value.toISOString() : String(value ?? "");
    const protectedText = typeof value === "string" && /^[\s\uFEFF]*[=+\-@＝＋－＠\t\r\n]/u.test(text)
      ? `\t${text}` : text;
    return alwaysQuote || /[",\r\n;]/u.test(protectedText) ? `"${protectedText.replace(/"/g, '""')}"` : protectedText;
  };
  const headerLine = headers.map((value) => cell(value, !/^[a-z][a-z0-9_]*$/i.test(value))).join(",");
  const rowLines = rows.map((row) =>
    headers
      .map((header) => cell(row[header]))
      .join(",")
  );

  return [headerLine, ...rowLines].join("\n");
}

export async function generateReportExportService(
  params: ExportRequestParams,
  actorUserId?: string,
  requestId = "req-export"
) {
  if (params.format !== "CSV") throw new ValidationError("Laporan ini tersedia dalam format CSV. Untuk berkas Excel peserta, gunakan tab Peserta.");
  const maxRecords = Number.isSafeInteger(params.maxRecords)
    ? Math.min(10_000, Math.max(1, params.maxRecords!)) : 5_000;
  const pageSize = Math.min(1_000, maxRecords);
  const firstPage = await getPaginatedReportService(params.reportType, {
    page: 1,
    pageSize,
    eventId: params.eventId,
  });
  const totalCount = firstPage.meta.total;
  const targetCount = Math.min(totalCount, maxRecords);
  const rows = firstPage.data.slice(0, targetCount);
  for (let page = 2; rows.length < targetCount; page += 1) {
    const next = await getPaginatedReportService(params.reportType, {
      page,
      pageSize,
      eventId: params.eventId,
    });
    if (!next.data.length) break;
    rows.push(...next.data.slice(0, targetCount - rows.length));
  }

  const sampleRow = rows[0] || {};
  const headers = Object.keys(sampleRow);
  const csvContent = formatDataToCsv(headers, rows);

  if (requestId) {
    await createAuditLog({
      actorUserId: actorUserId || null,
      action: "REPORT_EXPORTED",
      resourceType: "REPORT",
      resourceId: params.eventId || null,
      eventId: params.eventId || null,
      afterData: { reportType: params.reportType, format: params.format, recordCount: rows.length },
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
