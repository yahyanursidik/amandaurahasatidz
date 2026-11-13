import { ValidationError } from "../utils/errors";
import { registrationStage } from "../../../../src/lib/registrationStatus";

type DeadlineEvent = {
  startDate?: string | null;
  timezone?: string | null;
  registrationOpenAt?: Date | string | null;
  registrationCloseAt?: Date | string | null;
  invitationResponseDeadline?: Date | string | null;
  attendanceConfirmationDeadline?: Date | string | null;
  attendanceConfirmationRequired?: boolean | null;
  lateConfirmationPolicy?: string | null;
};

const asDate = (value?: Date | string | null) => value ? new Date(value) : null;
const eventOffsets: Record<string, string> = {
  "Asia/Jakarta": "+07:00",
  "Asia/Makassar": "+08:00",
  "Asia/Jayapura": "+09:00",
};

export function validateEventDeadlines(data: DeadlineEvent) {
  const start = data.startDate
    ? new Date(data.startDate.includes("T") ? data.startDate : `${data.startDate}T00:00:00${eventOffsets[data.timezone || ""] || eventOffsets["Asia/Jakarta"]}`)
    : null;
  const registrationOpen = asDate(data.registrationOpenAt);
  const registrationClose = asDate(data.registrationCloseAt);
  const invitationDeadline = asDate(data.invitationResponseDeadline);
  const attendanceDeadline = asDate(data.attendanceConfirmationDeadline);

  if ([start, registrationOpen, registrationClose, invitationDeadline, attendanceDeadline]
    .some((value) => value && Number.isNaN(value.getTime()))) {
    throw new ValidationError("Salah satu tanggal atau jam event tidak valid. Periksa kembali tenggat yang diisi.");
  }

  if (registrationOpen && registrationClose && registrationOpen >= registrationClose) {
    throw new ValidationError("Pembukaan pendaftaran harus lebih awal daripada penutupannya.");
  }
  if (start && invitationDeadline && invitationDeadline > start) {
    throw new ValidationError("Batas respons undangan tidak boleh melewati waktu mulai event.");
  }
  // Pendaftaran di lokasi dan konfirmasi kehadiran tetap boleh berlangsung setelah event dimulai.
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
  const reason = participantCheckinBlockReason(participant, event);
  if (reason) throw new ValidationError(`Presensi ditolak: ${reason}`);
}

export function participantCheckinBlockReason(
  participant: { confirmationStatus: string; approvalStatus: string }, event: DeadlineEvent,
): string | null {
  const stage = registrationStage({ ...participant, attendanceConfirmationRequired: event.attendanceConfirmationRequired });
  if (stage === "INACTIVE") return participant.confirmationStatus === "REPLACED"
    ? "peserta telah diganti." : "kepesertaan dibatalkan atau berhalangan.";
  if (stage === "AWAITING_CONFIRMATION") return "peserta belum mengonfirmasi kehadiran.";
  return stage === "READY" ? null : "data peserta belum disetujui panitia.";
}
