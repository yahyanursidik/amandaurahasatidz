import { describe, expect, it } from "vitest";
import { initialParticipantReviewState } from "../../netlify/functions/lib/services/registrationReviewState";
import { assertParticipantEligibleForCheckin } from "../../netlify/functions/lib/services/deadlineService";
import { renderEmailTemplate, renderHtmlEmailTemplate } from "../../netlify/functions/lib/services/emailTemplateEngine";

describe("persetujuan pendaftaran oleh admin", () => {
  it("menyimpan konfirmasi hadir tanpa otomatis menyetujui peserta", () => {
    const now = new Date("2026-11-10T07:00:00.000Z");
    expect(initialParticipantReviewState(now)).toEqual({
      confirmationStatus: "CONFIRMED", approvalStatus: "PENDING_REVIEW", confirmedAt: now,
    });
  });

  it("menolak bukti QR dan kode peserta untuk absensi sebelum disetujui", () => {
    const event = { attendanceConfirmationRequired: true };
    const pending = { confirmationStatus: "CONFIRMED", approvalStatus: "PENDING_REVIEW", participantCode: "P-ABC" };
    expect(() => assertParticipantEligibleForCheckin(pending, event)).toThrow(/belum disetujui/);
    expect(() => assertParticipantEligibleForCheckin({ ...pending, approvalStatus: "WAITLISTED" }, event)).toThrow(/belum disetujui/);
    expect(() => assertParticipantEligibleForCheckin({ ...pending, approvalStatus: "APPROVED" }, event)).not.toThrow();
  });

  it("email saat mendaftar hanya menyatakan menunggu, email kartu aktif setelah persetujuan", () => {
    const received = renderEmailTemplate("REGISTRATION_RECEIVED", {
      ustadzName: "Ustadz Hasan", eventName: "Daurah", participantCode: "P-ABC", portalLink: "https://contoh.id/login/ustadz",
      cardLink: "https://contoh.id/card?token=example", rundownLink: "https://contoh.id/events/daurah#jadwal-kegiatan",
    });
    expect(received.body).toContain("sedang ditinjau");
    expect(received.body).toContain("bukti QR ini belum berarti kursi disetujui");
    expect(received.body).toContain("https://contoh.id/card?token=example");
    const receivedHtml = renderHtmlEmailTemplate("REGISTRATION_RECEIVED", {
      ustadzName: "Ustadz Hasan", eventName: "Daurah", participantCode: "P-ABC",
      portalLink: "https://contoh.id/login/ustadz", cardLink: "https://contoh.id/card?token=example",
      rundownLink: "https://contoh.id/events/daurah#jadwal-kegiatan",
    });
    expect(receivedHtml.htmlBody).toContain("Buka bukti pendaftaran");
    const approved = renderEmailTemplate("REGISTRATION_APPROVED", {
      ustadzName: "Ustadz Hasan", eventName: "Daurah", participantCode: "P-ABC",
      cardLink: "https://contoh.id/card?token=example", rundownLink: "https://contoh.id/events/daurah#jadwal-kegiatan",
      portalLink: "https://contoh.id/login/ustadz", email: "hasan@contoh.id",
    });
    expect(approved.body).toContain("telah disetujui panitia");
    expect(approved.body).toContain("https://contoh.id/card?token=example");
  });
});
