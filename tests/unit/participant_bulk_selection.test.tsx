import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  canApproveParticipant, eligibleApprovalIds, runParticipantBulkApproval, selectionAfterBulkApproval, toggleApprovalSelection,
  type BulkApprovalResponse,
} from "../../src/lib/participantBulkApproval";
import { BulkParticipantApprovalPanel } from "../../src/components/participants/BulkParticipantApprovalPanel";

const candidates = [
  { id: "pending", approvalStatus: "PENDING_REVIEW", confirmationStatus: "CONFIRMED", ustadzName: "Ahmad", participantCode: "P-01" },
  { id: "waitlist", approvalStatus: "WAITLISTED", confirmationStatus: "INVITED", ustadzName: "Hasan", participantCode: "P-02" },
  { id: "approved", approvalStatus: "APPROVED", confirmationStatus: "CONFIRMED", ustadzName: "Ali", participantCode: "P-03" },
  { id: "cancelled", approvalStatus: "PENDING_REVIEW", confirmationStatus: "CANCELLED", ustadzName: "Umar", participantCode: "P-04" },
];
const success = (ids: string[]): BulkApprovalResponse => ({ summary: { total: ids.length, succeeded: ids.length, failed: 0 },
  results: ids.map((participantId) => ({ participantId, status: "SUCCESS", message: "Disetujui" })) });

describe("pilihan persetujuan massal", () => {
  it("hanya memilih pending/waitlist aktif dan mengabaikan duplikat", () => {
    expect(eligibleApprovalIds([...candidates, candidates[0]])).toEqual(["pending", "waitlist"]);
    expect(eligibleApprovalIds(candidates, true)).toEqual(["pending"]);
  });
  it.each(["CANCELLED", "REPLACED", "REJECTED", "DECLINED", "ACCEPTED", "UNKNOWN"])("menolak konfirmasi %s", (confirmationStatus) => {
    expect(canApproveParticipant({ ...candidates[0], confirmationStatus })).toBe(false);
  });
  it.each(["APPROVED", "REJECTED", "DECLINED"])("tidak memilih persetujuan %s", (approvalStatus) => {
    expect(canApproveParticipant({ ...candidates[0], approvalStatus })).toBe(false);
  });
  it("pilih halaman/filter mempertahankan pilihan halaman lain tanpa duplikat", () => {
    expect(toggleApprovalSelection(["other", "pending"], ["pending", "waitlist"], true)).toEqual(["other", "pending", "waitlist"]);
    expect(toggleApprovalSelection(["other", "pending", "waitlist"], ["pending", "waitlist"], false)).toEqual(["other"]);
  });
  it("opsi halaman memakai irisan pagination dan filter, bukan semua peserta event", () => {
    expect(eligibleApprovalIds(candidates.slice(0, 1))).toEqual(["pending"]);
    expect(eligibleApprovalIds(candidates.filter((item) => item.approvalStatus === "WAITLISTED"))).toEqual(["waitlist"]);
  });
});

describe("proses persetujuan batch", () => {
  it("memproses 58 peserta dalam 25/25/8 secara berurutan dan memberi progres", async () => {
    const ids = Array.from({ length: 58 }, (_, index) => `pid-${index}`);
    let active = 0;
    const request = vi.fn(async (batch: string[]) => {
      active++;
      expect(active).toBe(1);
      await Promise.resolve();
      active--;
      return success(batch);
    });
    const progress = vi.fn();
    const result = await runParticipantBulkApproval([...ids, ids[0]], request, progress);
    expect(request.mock.calls.map(([batch]) => batch.length)).toEqual([25, 25, 8]);
    expect(progress.mock.calls).toEqual([[25, 58], [50, 58], [58, 58]]);
    expect(result).toHaveLength(58);
    expect(result.every((item) => item.status === "SUCCESS")).toBe(true);
  });
  it("mempertahankan kegagalan parsial dan memproses batch berikutnya", async () => {
    const ids = Array.from({ length: 26 }, (_, index) => `p-${index}`);
    const request = vi.fn(async (batch: string[]) => {
      const result = success(batch);
      if (batch.includes("p-0")) result.results[0] = { participantId: "p-0", status: "FAILED", message: "Kapasitas penuh" };
      return result;
    });
    const result = await runParticipantBulkApproval(ids, request, () => undefined);
    expect(request).toHaveBeenCalledTimes(2);
    expect(result[0]).toEqual({ participantId: "p-0", status: "FAILED", message: "Kapasitas penuh" });
    expect(result.filter((item) => item.status === "SUCCESS")).toHaveLength(25);
  });
  it("timeout tidak dianggap gagal pasti dan tidak diulang otomatis", async () => {
    const ids = Array.from({ length: 58 }, (_, index) => `p-${index}`);
    const request = vi.fn().mockImplementationOnce(async (batch: string[]) => success(batch))
      .mockRejectedValueOnce(new Error("Request timeout"));
    const result = await runParticipantBulkApproval(ids, request, () => undefined);
    expect(request).toHaveBeenCalledTimes(2);
    expect(result.filter((item) => item.status === "SUCCESS")).toHaveLength(25);
    expect(result.filter((item) => item.status === "UNKNOWN")).toHaveLength(25);
    expect(result.filter((item) => item.status === "NOT_PROCESSED")).toHaveLength(8);
    expect(result[25].message).toContain("Periksa status terbaru");
  });
  it.each([
    [],
    [{ participantId: "other", status: "SUCCESS", message: "Disetujui" }],
    [{ participantId: "p-0", status: "INVALID", message: "Invalid" }],
  ].map((results) => ({ results })))("respons tidak lengkap/asing tidak menghasilkan sukses palsu", async ({ results }) => {
    const request = vi.fn().mockResolvedValue({ results });
    const result = await runParticipantBulkApproval(["p-0"], request, () => undefined);
    expect(result[0].status).toBe("UNKNOWN");
    expect(result[0].message).toContain("tidak lengkap");
  });
  it("menolak hasil duplikat dari API", async () => {
    const response = success(["p-0", "p-0"]);
    const result = await runParticipantBulkApproval(["p-0", "p-1"], async () => response, () => undefined);
    expect(result.every((item) => item.status === "UNKNOWN")).toBe(true);
  });
  it("tidak mengirim batch saat event berubah atau panel tidak lagi aktif", async () => {
    const request = vi.fn();
    expect(await runParticipantBulkApproval(["p-0"], request, () => undefined, () => false)).toEqual([]);
    expect(request).not.toHaveBeenCalled();
  });
  it("menghentikan batch berikutnya bila komponen tidak lagi aktif", async () => {
    let active = true;
    const request = vi.fn(async (ids: string[]) => { active = false; return success(ids); });
    const progress = vi.fn();
    const ids = Array.from({ length: 26 }, (_, index) => `p-${index}`);
    await runParticipantBulkApproval(ids, request, progress, () => active);
    expect(request).toHaveBeenCalledTimes(1);
    expect(progress).not.toHaveBeenCalled();
  });
  it("pilihan kosong tidak memanggil API", async () => {
    const request = vi.fn();
    expect(await runParticipantBulkApproval([], request, () => undefined)).toEqual([]);
    expect(request).not.toHaveBeenCalled();
  });
  it("hanya mempertahankan kegagalan pasti dan pilihan di luar scope permintaan", () => {
    expect(selectionAfterBulkApproval(["other", "success", "failed", "unknown", "later"], ["success", "failed", "unknown", "later"], [
      { participantId: "success", status: "SUCCESS", message: "OK" },
      { participantId: "failed", status: "FAILED", message: "Penuh" },
      { participantId: "unknown", status: "UNKNOWN", message: "Timeout" },
      { participantId: "later", status: "NOT_PROCESSED", message: "Terhenti" },
    ])).toEqual(["other", "failed"]);
  });
});

describe("panel mass approve tab peserta", () => {
  const props = {
    eventId: "event-a", eventName: "Liqaa", participants: candidates,
    filteredParticipants: candidates.slice(0, 2), pageParticipants: candidates.slice(0, 1),
    selectedIds: ["waitlist"], onSelectionChange: vi.fn(), onBusyChange: vi.fn(), onCompleted: async () => true,
  };
  it("menampilkan seleksi per halaman, hasil filter, semua pending dan dialog konfirmasi", () => {
    const html = renderToStaticMarkup(<BulkParticipantApprovalPanel {...props} />);
    expect(html).toContain("Persetujuan massal peserta");
    expect(html).toContain("Pilih semua di halaman (1)");
    expect(html).toContain("Pilih semua hasil filter (2)");
    expect(html).toContain("Setujui semua menunggu (1)");
    expect(html).toContain("Setujui terpilih (1)");
    expect(html).toContain("aria-labelledby=");
    expect(html).toContain("Konfirmasi kehadiran dan presensi tidak diubah");
    expect(html).toContain("Sebagian peserta dapat gagal");
  });
  it("menjelaskan pilihan tersembunyi di luar filter", () => {
    const html = renderToStaticMarkup(<BulkParticipantApprovalPanel {...props} filteredParticipants={candidates.slice(0, 1)} />);
    expect(html).toContain("(1 di luar filter)");
  });
  it("demo tidak menyimpan perubahan dan disabled controls saat memuat", () => {
    const html = renderToStaticMarkup(<BulkParticipantApprovalPanel {...props} demoMode disabled />);
    expect(html).toContain("penyimpanan persetujuan massal dinonaktifkan");
    expect(html).toMatch(/type="checkbox" disabled=""/);
  });
  it("status disetujui/batal saja membuat semua pilihan kosong", () => {
    const html = renderToStaticMarkup(<BulkParticipantApprovalPanel {...props} participants={candidates.slice(2)} filteredParticipants={candidates.slice(2)} pageParticipants={candidates.slice(2)} selectedIds={[]} />);
    expect(html).toContain("Setujui semua menunggu (0)");
    expect(html).toContain("Setujui terpilih (0)");
  });
  it("memblokir seluruh kontrol persetujuan sebelum status terbaru dimuat ulang", () => {
    const html = renderToStaticMarkup(<BulkParticipantApprovalPanel {...props} requiresRefresh />);
    expect(html).toContain("Status peserta harus dimuat ulang");
    expect(html).toContain("Muat ulang status peserta");
    expect(html).toMatch(/type="checkbox" disabled=""/);
    expect(html).toMatch(/<button[^>]+disabled=""[^>]*>[^]*?Setujui semua menunggu/);
  });
});