import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";
import {
  buildParticipantExcelWorkbook,
  collectParticipantExportRows,
  eventLocalExcelDate,
  MAX_PARTICIPANT_EXPORT_ROWS,
  PARTICIPANT_EXPORT_HEADERS,
  participantExcelFilename,
  type ParticipantExportRow,
} from "../../src/lib/participantExcelExport";

const event = { id: "11111111-1111-4111-8111-111111111111", code: "DAURAH-001", name: "Daurah Asatidz", timezone: "Asia/Jakarta" };
const participant: ParticipantExportRow = {
  id: "22222222-2222-4222-8222-222222222222",
  participantCode: "00123-AB",
  ustadzName: "=HYPERLINK(\"https://example.invalid\")",
  institutionName: "Yayasan Tarbiyah Sunnah",
  registrationSource: "INSTITUTION_INVITATION",
  approvalStatus: "APPROVED",
  confirmationStatus: "CONFIRMED",
  ustadzWhatsapp: "081234567890",
  ustadzPhone: "00123456789",
  ustadzEmail: "ustadz@example.invalid",
  ustadzAddress: "Bandung",
  registeredAt: "2026-11-10T07:30:00.000Z",
  portalAccountStatus: "ACTIVE",
  portalPasswordConfigured: true,
  eventParticipationCount: 2,
};

describe("participant Excel export", () => {
  it("collects all filtered pages without dropping or duplicating participants", async () => {
    const fetchPage = vi.fn(async (page: number, pageSize: number) => ({
      data: Array.from({ length: page === 3 ? 5 : pageSize }, (_, index) => ({ id: String((page - 1) * pageSize + index + 1) })),
      meta: { total: 205 },
    }));
    const onProgress = vi.fn();
    const rows = await collectParticipantExportRows(fetchPage, onProgress);
    expect(rows).toHaveLength(205);
    expect(rows.at(-1)?.id).toBe("205");
    expect(fetchPage.mock.calls.map(([page, pageSize]) => [page, pageSize])).toEqual([[1, 100], [2, 100], [3, 100]]);
    expect(onProgress).toHaveBeenLastCalledWith(205, 205);
  });

  it("refuses incomplete, changing, or oversized exports", async () => {
    await expect(collectParticipantExportRows(async () => ({ data: [], meta: { total: 2 } }))).rejects.toThrow("tidak lengkap");
    await expect(collectParticipantExportRows(async (page) => ({ data: [{ id: "same" }], meta: { total: page === 1 ? 2 : 3 } }))).rejects.toThrow("berubah");
    await expect(collectParticipantExportRows(async () => ({ data: [], meta: { total: MAX_PARTICIPANT_EXPORT_ROWS + 1 } }))).rejects.toThrow("Persempit filter");
  });

  it("writes a valid xlsx with all columns, sortable event-local dates, text IDs and no credentials", async () => {
    const workbook = await buildParticipantExcelWorkbook(event, [participant], "Undangan lembaga", new Date("2026-11-12T00:00:00.000Z"));
    const bytes = await workbook.xlsx.writeBuffer();
    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(bytes);
    const sheet = reloaded.getWorksheet("Peserta");
    expect(sheet).toBeDefined();
    expect(PARTICIPANT_EXPORT_HEADERS.map((_, index) => sheet!.getRow(8).getCell(index + 1).value)).toEqual([...PARTICIPANT_EXPORT_HEADERS]);
    expect(sheet!.getCell("B6").value).toBe(1);
    expect(sheet!.getCell("B9").value).toBe("00123-AB");
    expect(sheet!.getCell("B9").numFmt).toBe("@");
    expect(sheet!.getCell("C9").value).toBe(participant.ustadzName);
    expect(sheet!.getCell("C9").type).toBe(ExcelJS.ValueType.String);
    expect(sheet!.getCell("D9").value).toBe("Yayasan Tarbiyah Sunnah");
    expect(sheet!.getCell("K9").value).toBe("081234567890");
    expect(sheet!.getCell("L9").value).toBe("00123456789");
    expect(sheet!.getCell("O9").value).toEqual(new Date("2026-11-10T14:30:00.000Z"));
    expect(sheet!.getCell("O9").type).toBe(ExcelJS.ValueType.Date);
    expect(sheet!.getCell("Q9").value).toBe(2);
    expect(sheet!.autoFilter).toBe("A8:Q8");
    expect(sheet!.views[0]).toMatchObject({ state: "frozen", xSplit: 3, ySplit: 8 });
    expect(JSON.stringify(sheet!.getRow(9).values)).not.toMatch(/password|qrToken|invitationToken/i);
  });

  it("uses local time in file names and safely handles invalid timestamps", () => {
    expect(participantExcelFilename(event, new Date("2026-11-11T18:00:00.000Z"))).toBe("peserta-DAURAH-001-2026-11-12.xlsx");
    expect(eventLocalExcelDate("invalid", "Asia/Jakarta")).toBeNull();
  });
});
