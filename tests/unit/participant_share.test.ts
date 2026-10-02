import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildParticipantRegistrationShareLinks, type ParticipantShareDetails } from "../../src/lib/participantShare";

const mocks = vi.hoisted(() => ({ rows: [] as unknown[], where: vi.fn(), sign: vi.fn() }));
vi.mock("../../netlify/functions/lib/db/client", () => ({
  getDbClient: () => ({ select: () => ({ from: () => ({ innerJoin: () => ({ innerJoin: () => ({
    where: (condition: unknown) => { mocks.where(condition); return { limit: async () => mocks.rows }; },
  }) }) }) }) }),
}));
vi.mock("../../netlify/functions/lib/services/participantCardService", () => ({
  signCardForParticipant: mocks.sign,
  cardPath: (token: string) => `/card?token=${encodeURIComponent(token)}`,
}));
import { getParticipantShareService } from "../../netlify/functions/lib/services/participantShareService";

const details: ParticipantShareDetails = {
  participantId: "123e4567-e89b-42d3-a456-426614174000",
  eventId: "123e4567-e89b-42d3-a456-426614174001",
  fullName: "Ahmad & Hasan",
  participantCode: "P-0001",
  email: "ahmad@example.org",
  phone: "081234567890",
  whatsapp: "81234567890",
  eventName: "Liqaa Bandung",
  startDate: "2026-10-10",
  endDate: "2026-10-11",
  venueName: "Masjid Al-Hafidz",
  approvalStatus: "APPROVED",
  confirmationStatus: "CONFIRMED",
  qrToken: "pqr_abc.def",
  cardUrl: "/card?token=pqr_abc.def",
};

describe("pesan QR dan kode pendaftaran", () => {
  it("membuat WhatsApp/email terenkode dengan kode dan tautan kartu pribadi", () => {
    const links = buildParticipantRegistrationShareLinks(details, "https://contoh.id");
    expect(links.whatsappUrl).toMatch(/^https:\/\/wa.me\/6281234567890\?text=/);
    expect(new URL(links.whatsappUrl!).searchParams.get("text")).toBe(links.message);
    expect(links.emailUrl).toMatch(/^mailto:ahmad@example.org\?subject=/);
    expect(links.message).toContain("Kode pendaftaran: P-0001");
    expect(links.message).toContain("https://contoh.id/card?token=pqr_abc.def");
    expect(links.message).toContain("Jangan meneruskannya");
  });

  it("peserta pending dapat membagikan kode tetapi tidak tautan atau token QR", () => {
    const links = buildParticipantRegistrationShareLinks({ ...details, approvalStatus: "PENDING_REVIEW" }, "https://contoh.id");
    expect(links.cardUrl).toBeNull();
    expect(links.message).toContain("belum berlaku untuk presensi");
    expect(links.message).not.toContain("pqr_");
  });

  it("menonaktifkan tujuan kontak invalid dan tautan kartu lintas domain", () => {
    const links = buildParticipantRegistrationShareLinks({ ...details, email: "invalid", whatsapp: "123", phone: null, cardUrl: "https://evil.example/card?token=pqr_abc.def" }, "https://contoh.id");
    expect(links.whatsappUrl).toBeNull();
    expect(links.emailUrl).toBeNull();
    expect(links.cardUrl).toBeNull();
  });

  it("meminta konfirmasi ketika peserta disetujui tetapi belum mengonfirmasi", () => {
    expect(buildParticipantRegistrationShareLinks({ ...details, confirmationStatus: "INVITED" }, "https://contoh.id").message)
      .toContain("Konfirmasi kehadiran terlebih dahulu");
  });

  it("memakai telepon cadangan jika WhatsApp invalid dan menolak header mailto tersisip", () => {
    const links = buildParticipantRegistrationShareLinks({ ...details, whatsapp: "-", email: "a?cc=other@example.org" }, "https://contoh.id");
    expect(links.whatsappUrl).toMatch(/wa.me\/6281234567890/);
    expect(links.emailUrl).toBeNull();
  });

  it("menangani URL malformed, token tidak cocok, dan Unicode lama tanpa crash", () => {
    expect(buildParticipantRegistrationShareLinks({ ...details, cardUrl: "http://[", fullName: "Nama\uD800", eventName: "Daurah\uD800" }, "https://contoh.id").cardUrl).toBeNull();
    expect(buildParticipantRegistrationShareLinks({ ...details, cardUrl: "/card?token=pqr_other.token" }, "https://contoh.id").cardUrl).toBeNull();
  });
});

describe("layanan berbagi peserta yang dibatasi event", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rows = [{ ...details, id: details.participantId, qrTokenVersion: 1 }];
    mocks.sign.mockReturnValue("pqr_abc.def");
  });

  it("membuat QR signed untuk peserta approved pada event yang benar", async () => {
    const result = await getParticipantShareService(details.eventId, details.participantId);
    expect(result.cardUrl).toBe("/card?token=pqr_abc.def");
    expect(mocks.sign).toHaveBeenCalledWith(expect.objectContaining({ id: details.participantId, eventId: details.eventId, qrTokenVersion: 1 }));
    // Both identifiers are present in the actual Drizzle query condition.
    const { PgDialect } = await import("drizzle-orm/pg-core");
    const query = new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0]);
    expect(query.params).toEqual([details.participantId, details.eventId]);
  });

  it("tidak menerbitkan QR untuk peserta pending", async () => {
    mocks.rows = [{ ...details, id: details.participantId, approvalStatus: "PENDING_REVIEW" }];
    const result = await getParticipantShareService(details.eventId, details.participantId);
    expect(result.qrToken).toBeNull();
    expect(result.cardUrl).toBeNull();
    expect(mocks.sign).not.toHaveBeenCalled();
  });

  it.each(["CANCELLED", "REPLACED"])("menolak pendaftaran %s", async (confirmationStatus) => {
    mocks.rows = [{ ...details, confirmationStatus }];
    await expect(getParticipantShareService(details.eventId, details.participantId)).rejects.toThrow(/tidak aktif/);
    expect(mocks.sign).not.toHaveBeenCalled();
  });

  it("menolak peserta ditolak atau ID tidak ditemukan", async () => {
    mocks.rows = [{ ...details, approvalStatus: "REJECTED" }];
    await expect(getParticipantShareService(details.eventId, details.participantId)).rejects.toThrow(/tidak aktif/);
    mocks.rows = [];
    await expect(getParticipantShareService(details.eventId, details.participantId)).rejects.toThrow(/event ini/);
  });
});