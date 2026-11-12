import { participantApprovalLabel, participantConfirmationLabel, participantSourceCategory, participantSourceLabel } from "./participantCatalog";

export const MAX_PARTICIPANT_EXPORT_ROWS = 10_000;
export const PARTICIPANT_EXPORT_HEADERS = [
  "No.", "Kode peserta", "Nama asatidz", "Lembaga", "Jalur daftar", "Peran rombongan",
  "Persetujuan", "Alasan keputusan", "Konfirmasi hadir", "Alasan konfirmasi",
  "WhatsApp", "Telepon", "Email", "Alamat", "Waktu daftar", "Portal peserta", "Total pendaftaran event",
] as const;

export type ParticipantExportRow = {
  id: string;
  participantCode: string;
  ustadzName: string;
  institutionName?: string | null;
  registrationSource?: string | null;
  isDelegationLead?: boolean | null;
  publicGroupId?: string | null;
  approvalStatus: string;
  statusReason?: string | null;
  confirmationStatus: string;
  confirmationStatusReason?: string | null;
  ustadzWhatsapp?: string | null;
  ustadzPhone?: string | null;
  ustadzEmail?: string | null;
  ustadzAddress?: string | null;
  registeredAt?: string | null;
  portalAccountStatus?: string | null;
  portalPasswordConfigured?: boolean | null;
  eventParticipationCount?: number | null;
};

export type ParticipantExportEvent = { id: string; code?: string | null; name: string; timezone?: string | null };
export type ExportPage<T> = { data: T[]; meta?: { total: number } };

export async function collectParticipantExportRows<T extends { id: string }>(
  fetchPage: (page: number, pageSize: number, signal?: AbortSignal) => Promise<ExportPage<T>>,
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal,
): Promise<T[]> {
  const pageSize = 100;
  const records: T[] = [];
  const seen = new Set<string>();
  let expectedTotal: number | null = null;
  for (let page = 1; expectedTotal === null || records.length < expectedTotal; page += 1) {
    if (signal?.aborted) throw new Error("Ekspor dibatalkan.");
    const response = await fetchPage(page, pageSize, signal);
    const total = response.meta?.total;
    if (!Number.isSafeInteger(total) || total! < 0) throw new Error("Jumlah peserta ekspor tidak valid. Muat ulang halaman.");
    if (expectedTotal === null) {
      expectedTotal = total!;
      if (expectedTotal > MAX_PARTICIPANT_EXPORT_ROWS) {
        throw new Error(`Hasil filter berisi lebih dari ${MAX_PARTICIPANT_EXPORT_ROWS.toLocaleString("id-ID")} peserta. Persempit filter sebelum ekspor.`);
      }
    } else if (total !== expectedTotal) {
      throw new Error("Daftar peserta berubah saat ekspor. Muat ulang dan coba lagi agar file tidak kurang data.");
    }
    if (!Array.isArray(response.data) || response.data.length > pageSize || expectedTotal > 0 && response.data.length === 0) {
      throw new Error("Data peserta tidak lengkap. Ulangi ekspor.");
    }
    for (const record of response.data) {
      if (!record.id || seen.has(record.id)) throw new Error("Daftar peserta berubah saat ekspor. Muat ulang dan coba lagi.");
      seen.add(record.id);
      records.push(record);
    }
    if (records.length > expectedTotal) throw new Error("Jumlah peserta berubah saat ekspor. Muat ulang dan coba lagi.");
    onProgress?.(records.length, expectedTotal);
    if (page > Math.ceil(expectedTotal / pageSize)) break;
  }
  if (records.length !== expectedTotal) throw new Error("Data peserta tidak lengkap. Ulangi ekspor.");
  return records;
}

const textCell = (value?: string | null) => (value || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ");

/** Excel has no timezone-aware cells. Store the event-local wall time as a sortable date value. */
export function eventLocalExcelDate(value: string | null | undefined, timezone: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(parsed);
  const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
  return new Date(Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute));
}

const groupRole = (item: ParticipantExportRow) => item.isDelegationLead ? "Kepala rombongan"
  : item.publicGroupId ? "Anggota rombongan"
    : participantSourceCategory(item.registrationSource) === "INSTITUTION" ? "Peserta lembaga" : "Individu";

const portalStatus = (item: ParticipantExportRow) => !item.portalPasswordConfigured ? "Belum tersedia"
  : item.portalAccountStatus === "ACTIVE" ? "Aktif" : "Akun nonaktif";

export async function buildParticipantExcelWorkbook(event: ParticipantExportEvent,
  records: ParticipantExportRow[], filterSummary: string, exportedAt = new Date()) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Daurah Duat dan Pegiat Dakwah";
  workbook.created = exportedAt;
  const sheet = workbook.addWorksheet("Peserta", { views: [{ state: "frozen", xSplit: 3, ySplit: 8, showGridLines: false }] });
  sheet.columns = [
    { key: "number", width: 7 }, { key: "code", width: 20 }, { key: "name", width: 30 },
    { key: "institution", width: 30 }, { key: "source", width: 22 }, { key: "groupRole", width: 22 },
    { key: "approval", width: 22 }, { key: "statusReason", width: 32 }, { key: "confirmation", width: 23 },
    { key: "confirmationReason", width: 32 }, { key: "whatsapp", width: 20 }, { key: "phone", width: 20 },
    { key: "email", width: 34 }, { key: "address", width: 48 }, { key: "registeredAt", width: 24 },
    { key: "portal", width: 21 }, { key: "priorEvents", width: 24 },
  ];
  sheet.getCell("A2").value = "Daftar peserta";
  sheet.getCell("A2").font = { name: "Arial", size: 15, bold: true, color: { argb: "FF0F172A" } };
  sheet.getCell("A3").value = textCell(event.name);
  sheet.getCell("A3").font = { name: "Arial", size: 11, bold: true, color: { argb: "FF334155" } };
  sheet.getCell("A4").value = "Kode event";
  sheet.getCell("B4").value = textCell(event.code || event.id);
  sheet.getCell("A5").value = "Cakupan";
  sheet.getCell("B5").value = textCell(filterSummary || "Semua peserta");
  sheet.getCell("A6").value = "Jumlah peserta";
  sheet.getCell("B6").value = records.length;
  sheet.getCell("D6").value = "Diekspor";
  sheet.getCell("E6").value = eventLocalExcelDate(exportedAt.toISOString(), event.timezone || "Asia/Jakarta");
  sheet.getCell("E6").numFmt = "dd mmm yyyy hh:mm";
  sheet.getCell("F6").value = textCell(event.timezone || "Asia/Jakarta");
  for (const address of ["A4", "A5", "A6", "D6"]) sheet.getCell(address).font = { name: "Arial", size: 10, bold: true, color: { argb: "FF475569" } };
  sheet.getCell("B5").alignment = { vertical: "middle" };
  sheet.getRow(8).values = [...PARTICIPANT_EXPORT_HEADERS];
  sheet.getRow(8).height = 32;
  sheet.getRow(8).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  const timezone = event.timezone || "Asia/Jakarta";
  for (const [index, item] of records.entries()) {
    const row = sheet.addRow([
      index + 1, textCell(item.participantCode), textCell(item.ustadzName), textCell(item.institutionName || "Individu"),
      participantSourceLabel(item.registrationSource), groupRole(item), participantApprovalLabel(item.approvalStatus),
      textCell(item.statusReason), participantConfirmationLabel(item.confirmationStatus, item.confirmationStatusReason),
      textCell(item.confirmationStatusReason), textCell(item.ustadzWhatsapp), textCell(item.ustadzPhone),
      textCell(item.ustadzEmail), textCell(item.ustadzAddress), eventLocalExcelDate(item.registeredAt, timezone),
      portalStatus(item), item.eventParticipationCount ?? null,
    ]);
    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.font = { name: "Arial", size: 10, color: { argb: "FF0F172A" } };
      cell.alignment = { vertical: "middle", horizontal: [1, 17].includes(columnNumber) ? "right" : "left" };
      if (index % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    });
    row.getCell(15).numFmt = "dd mmm yyyy hh:mm";
    row.getCell(2).numFmt = "@";
    row.getCell(11).numFmt = "@";
    row.getCell(12).numFmt = "@";
  }
  sheet.autoFilter = { from: { row: 8, column: 1 }, to: { row: 8, column: PARTICIPANT_EXPORT_HEADERS.length } };
  return workbook;
}

export function participantExcelFilename(event: ParticipantExportEvent, date = new Date()) {
  const code = (event.code || event.name || "event").normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "event";
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return `peserta-${code}-${day}.xlsx`;
}

export async function downloadParticipantExcel(event: ParticipantExportEvent, records: ParticipantExportRow[], filterSummary: string,
  signal?: AbortSignal) {
  const workbook = await buildParticipantExcelWorkbook(event, records, filterSummary);
  if (signal?.aborted) return;
  const buffer = await workbook.xlsx.writeBuffer();
  if (signal?.aborted) return;
  const bytes = new Uint8Array(buffer);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = participantExcelFilename(event);
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
