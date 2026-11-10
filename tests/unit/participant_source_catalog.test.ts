import { describe, expect, it } from "vitest";
import { participantApprovalLabel, participantConfirmationLabel, participantSourceCategory, participantSourceLabel } from "../../src/lib/participantCatalog";

describe("jalur peserta lintas modul", () => {
  it.each([
    ["DIRECT_PUBLIC", "REGULAR", "Pendaftaran publik"],
    ["DIRECT_ADMIN_UPLOAD", "REGULAR", "Unggahan admin"],
    ["INSTITUTION_DELEGATION", "INSTITUTION", "Undangan lembaga"],
    ["INSTITUTION_DELEGATION_REPLACEMENT", "INSTITUTION", "Pengganti delegasi"],
    ["INSTITUTION_INVITATION", "INSTITUTION", "Undangan lembaga"],
    ["INDIVIDUAL_INVITATION", "INDIVIDUAL", "Undangan pribadi"],
  ] as const)("menyamakan %s pada filter dan label", (source, category, label) => {
    expect(participantSourceCategory(source)).toBe(category);
    expect(participantSourceLabel(source)).toBe(label);
  });
  it("memberi label aman untuk data lama tanpa sumber", () => {
    expect(participantSourceCategory(null)).toBe("REGULAR");
    expect(participantSourceLabel(null)).toBe("Jalur belum dicatat");
  });
  it("menerjemahkan status peserta pada semua tampilan staf", () => {
    expect(participantApprovalLabel("PENDING_REVIEW")).toBe("Menunggu tinjauan");
    expect(participantApprovalLabel("APPROVED")).toBe("Disetujui");
    expect(participantConfirmationLabel("CONFIRMED")).toBe("Sudah konfirmasi");
  });
});
