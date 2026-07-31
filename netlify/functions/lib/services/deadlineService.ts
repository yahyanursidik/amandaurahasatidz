import { ValidationError } from "../utils/errors";

type DeadlineEvent = {
  startDate?: string | null;
  registrationOpenAt?: Date | string | null;
  registrationCloseAt?: Date | string | null;
  invitationResponseDeadline?: Date | string | null;
  attendanceConfirmationDeadline?: Date | string | null;
  attendanceConfirmationRequired?: boolean | null;
  lateConfirmationPolicy?: string | null;
};

const asDate = (value?: Date | string | null) => value ? new Date(value) : null;

export function validateEventDeadlines(data: DeadlineEvent) {
  const start = data.startDate ? new Date(`${data.startDate}T23:59:59`) : null;
  const registrationOpen = asDate(data.registrationOpenAt);
  const registrationClose = asDate(data.registrationCloseAt);
  const invitationDeadline = asDate(data.invitationResponseDeadline);
  const attendanceDeadline = asDate(data.attendanceConfirmationDeadline);

  if (registrationOpen && registrationClose && registrationOpen >= registrationClose) {
    throw new ValidationError("Pembukaan pendaftaran harus lebih awal daripada penutupannya.");
  }
  if (start && registrationClose && registrationClose > start) {
    throw new ValidationError("Batas pendaftaran tidak boleh melewati tanggal mulai event.");
  }
  if (start && invitationDeadline && invitationDeadline > start) {
    throw new ValidationError("Batas respons undangan tidak boleh melewati tanggal mulai event.");
  }
  if (start && attendanceDeadline && attendanceDeadline > start) {
    throw new ValidationError("Batas konfirmasi kehadiran tidak boleh melewati tanggal mulai event.");
  }
}

export function assertAttendanceConfirmationAllowed(event: DeadlineEvent, now = new Date()) {
  const deadline = asDate(event.attendanceConfirmationDeadline);
  const late = Boolean(deadline && now > deadline);
  const policy = event.lateConfirmationPolicy || "BLOCK";
  if (late && policy === "BLOCK") {
    throw new ValidationError("Batas konfirmasi kehadiran telah berakhir. Hubungi panitia untuk peninjauan.");
  }
  return { late, needsReview: late && policy === "REVIEW", policy, deadline };
}

export function assertParticipantEligibleForCheckin(
  participant: { confirmationStatus: string; approvalStatus: string; participantCode?: string },
  event: DeadlineEvent
) {
  if (["CANCELLED", "REPLACED"].includes(participant.confirmationStatus)) {
    throw new ValidationError(`Presensi ditolak: peserta berstatus ${participant.confirmationStatus}.`);
  }
  if (event.attendanceConfirmationRequired !== false && participant.confirmationStatus !== "CONFIRMED") {
    throw new ValidationError("Presensi ditolak: peserta belum mengonfirmasi kehadiran.");
  }
  if (participant.approvalStatus !== "APPROVED") {
    throw new ValidationError("Presensi ditolak: data peserta belum disetujui panitia.");
  }
}
