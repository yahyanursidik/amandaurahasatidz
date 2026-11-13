/** A registration receipt and an attendance credential represent different states. */
export type RegistrationState = {
  approvalStatus: string;
  confirmationStatus: string;
  attendanceConfirmationRequired?: boolean | null;
};

export const INACTIVE_CONFIRMATION_STATUSES = ["CANCELLED", "REPLACED"];
export const ATTENDANCE_EVENT_STATUSES = ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING"];

export function registrationStage(state: RegistrationState) {
  if (INACTIVE_CONFIRMATION_STATUSES.includes(state.confirmationStatus) || state.approvalStatus === "CANCELLED") return "INACTIVE";
  if (["DECLINED", "REJECTED"].includes(state.approvalStatus)) return "DECLINED";
  if (state.approvalStatus === "WAITLISTED") return "WAITLISTED";
  if (state.approvalStatus !== "APPROVED") return state.confirmationStatus === "CONFIRMED" &&
    state.attendanceConfirmationRequired !== false ? "REVIEWING_CONFIRMATION" : "PENDING_REVIEW";
  return state.attendanceConfirmationRequired !== false && state.confirmationStatus !== "CONFIRMED"
    ? "AWAITING_CONFIRMATION" : "READY";
}

export const isAttendanceQrEligible = (state: RegistrationState) => registrationStage(state) === "READY";

export const registrationStageCopy: Record<ReturnType<typeof registrationStage>, { label: string; next: string }> = {
  PENDING_REVIEW: { label: "Menunggu persetujuan panitia", next: "Pendaftaran sudah tersimpan. QR presensi belum diterbitkan. Buka kembali status setelah mendapat kabar dari panitia." },
  REVIEWING_CONFIRMATION: { label: "Konfirmasi tersimpan, menunggu peninjauan", next: "Panitia masih meninjau pendaftaran. QR presensi belum diterbitkan." },
  WAITLISTED: { label: "Dalam daftar tunggu", next: "QR presensi belum diterbitkan. Pantau status untuk mengetahui keputusan panitia." },
  DECLINED: { label: "Pendaftaran tidak disetujui", next: "QR presensi tidak tersedia. Hubungi panitia jika ada data yang perlu ditinjau." },
  INACTIVE: { label: "Pendaftaran tidak aktif", next: "QR presensi tidak berlaku. Hubungi panitia jika rencana Ustadz berubah." },
  AWAITING_CONFIRMATION: { label: "Disetujui · perlu konfirmasi hadir", next: "Pilih “Insya Allah hadir” agar QR presensi diterbitkan. Konfirmasi bukan presensi." },
  READY: { label: "Siap untuk presensi", next: "Tunjukkan QR pribadi kepada petugas saat presensi pada setiap hari atau sesi yang dijadwalkan." },
};
