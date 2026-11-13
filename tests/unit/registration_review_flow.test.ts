import { describe, expect, it } from "vitest";
import { initialParticipantReviewState } from "../../netlify/functions/lib/services/registrationReviewState";
import { assertParticipantEligibleForCheckin } from "../../netlify/functions/lib/services/deadlineService";
import { renderEmailTemplate, renderHtmlEmailTemplate } from "../../netlify/functions/lib/services/emailTemplateEngine";

describe("persetujuan pendaftaran oleh admin", () => {
  it("pendaftaran baru menunggu persetujuan dan konfirmasi pribadi bila diwajibkan", () => {
    const now = new Date("2026-11-10T07:00:00.000Z");
    expect(initialParticipantReviewState(true, now)).toEqual({
      confirmationStatus: "INVITED", approvalStatus: "PENDING_REVIEW", confirmedAt: null,
    });
    expect(initialParticipantReviewState(false, now)).toEqual({
      confirmationStatus: "CONFIRMED", approvalStatus: "PENDING_REVIEW", confirmedAt: now,
    });
  });

  it("menolak bukti QR dan kode peserta untuk absensi sebelum disetujui", () => {
    const event = { attendanceConfirmationRequired: true };
    const pending = { confirmationStatus: "INVITED", approvalStatus: "PENDING_REVIEW", participantCode: "P-ABC" };
    expect(() => assertParticipantEligibleForCheckin(pending, event)).toThrow(/belum disetujui/);
    expect(() => assertParticipantEligibleForCheckin({ ...pending, approvalStatus: "WAITLISTED" }, event)).toThrow(/belum disetujui/);
    expect(() => assertParticipantEligibleForCheckin({ ...pending, approvalStatus: "APPROVED" }, event)).toThrow(/belum mengonfirmasi/);
    expect(() => assertParticipantEligibleForCheckin({ ...pending, approvalStatus: "APPROVED", confirmationStatus: "CONFIRMED" }, event)).not.toThrow();
  });

  const statusLink = "https://contoh.id/confirm#pcf_example.signature";
  const oldCard = "https://contoh.id/card?token=pqr_old.signature";
  const common = { ustadzName: "Ustadz Hasan", eventName: "Daurah", participantCode: "P-ABC",
    rundownLink: "https://contoh.id/events/daurah#jadwal-kegiatan", registrationStatusLink: statusLink };

  it("email pendaftaran awal hanya memberikan bukti dan tautan status; abaikan payload QR lama", () => {
    const mail = renderHtmlEmailTemplate("REGISTRATION_RECEIVED", { ...common,
      portalLink: "https://contoh.id/login/ustadz", cardLink: oldCard, confirmationInstruction: oldCard });
    expect(mail.subject).toMatch(/Bukti pendaftaran/);
    expect(mail.textBody).toContain("bukan persetujuan panitia");
    expect(mail.textBody).toContain("QR presensi tidak terbit saat mendaftar");
    expect(mail.htmlBody).toContain(`href="${statusLink}"`);
    expect(mail.textBody + mail.htmlBody).not.toContain("pqr_");
    expect(mail.htmlBody).toContain("Lihat status pendaftaran");
  });

  it("email persetujuan membedakan permintaan konfirmasi dari QR yang siap", () => {
    const request = renderHtmlEmailTemplate("REGISTRATION_CONFIRMATION_REQUEST", { ...common, confirmationLink: oldCard });
    expect(request.htmlBody).toContain("Konfirmasi kehadiran");
    expect(request.textBody).toContain("Masih ada satu langkah");
    expect(request.textBody + request.htmlBody).not.toContain("pqr_");
    const ready = renderHtmlEmailTemplate("REGISTRATION_APPROVED", { ...common, cardLink: oldCard,
      portalLink: "https://contoh.id/login/ustadz", email: "hasan@contoh.id" });
    expect(ready.htmlBody).toContain("Buka QR presensi");
    expect(ready.htmlBody).toContain(`href="${statusLink}"`);
    expect(ready.textBody + ready.htmlBody).not.toContain("pqr_");
  });

  it("konfirmasi yang menunggu tinjauan tidak menyuruh peserta melakukan presensi", () => {
    const mail = renderHtmlEmailTemplate("PARTICIPANT_ATTENDANCE_CONFIRMED", { ...common, cardInstruction: oldCard,
      nextStep: "Konfirmasi perlu ditinjau kembali oleh panitia. QR presensi belum diterbitkan." });
    expect(mail.textBody).toContain("Konfirmasi ini bukan presensi");
    expect(mail.textBody).toContain("QR presensi belum diterbitkan");
    expect(mail.textBody).not.toContain("Tunjukkan QR");
    expect(mail.htmlBody).toContain(`href="${statusLink}"`);
    expect(mail.textBody + mail.htmlBody).not.toContain("pqr_");
    const withdrawn = renderEmailTemplate("PARTICIPANT_WITHDRAWN", {
      ustadzName: "Ustadz Hasan", eventName: "Daurah", participantCode: "P-ABC",
    });
    expect(withdrawn.body).toContain("QR sebelumnya tidak berlaku lagi");
  });
});
