export type ParticipantResolutionInput = {
  approvalStatus: string;
  confirmationStatus: string;
  contactComplete: boolean;
  portalPasswordConfigured?: boolean | null;
};

/** A short operational next step; final eligibility is always checked by the API. */
export function participantResolutionHint(participant: ParticipantResolutionInput) {
  if (["CANCELLED", "REPLACED"].includes(participant.confirmationStatus) || participant.approvalStatus === "CANCELLED") {
    return { title: "Riwayat tersimpan", detail: "Pendaftaran ini sudah tidak aktif.", tone: "neutral" as const };
  }
  if (["DECLINED", "REJECTED"].includes(participant.approvalStatus)) {
    return { title: "Pendaftaran ditolak", detail: "Alasan keputusan tersimpan; jangan kirim QR atau permintaan konfirmasi.", tone: "neutral" as const };
  }
  if (participant.approvalStatus === "PENDING_REVIEW") {
    return { title: "Perlu keputusan", detail: "Periksa profil, lalu setujui atau pilih daftar tunggu.", tone: "warning" as const };
  }
  if (participant.approvalStatus === "WAITLISTED") {
    return { title: "Pantau kursi", detail: "Setujui jika kuota tersedia; bila penuh, pertahankan daftar tunggu.", tone: "warning" as const };
  }
  if (participant.approvalStatus === "APPROVED" && participant.confirmationStatus === "INVITED") {
    return { title: "Menunggu konfirmasi hadir", detail: "Hubungi asatidz dan kirim tautan konfirmasi pribadi.", tone: "info" as const };
  }
  if (!participant.contactComplete) {
    return { title: "Kontak belum lengkap", detail: "Hubungi asatidz atau minta admin memperbarui profil.", tone: "warning" as const };
  }
  if (!participant.portalPasswordConfigured) {
    return { title: "Akses portal belum siap", detail: "Siapkan login pribadi sebelum acara.", tone: "info" as const };
  }
  return { title: "Siap ditindaklanjuti", detail: "Pantau konfirmasi dan kehadiran per hari acara.", tone: "success" as const };
}
