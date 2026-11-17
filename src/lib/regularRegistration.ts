export type RegularRegistrationEvent = {
  audienceMode: string;
  status: string;
  regularQuota: number | null;
  regularAllowGroup?: boolean;
  regularApproved: number;
  invitationApproved: number;
  capacity: number | null;
  registrationOpenAt: string | null;
  registrationCloseAt: string | null;
};

/** Missing policy means the legacy behavior; total quotas still apply per person. */
export function getRegularRegistrationGroupLimit(event: {
  regularAllowGroup?: boolean;
  regularQuota?: number | null;
  capacity?: number | null;
}) {
  return Math.max(0, Math.min(event.regularAllowGroup === false ? 1 : 20,
    event.regularQuota ?? 20, event.capacity ?? 20));
}

export function getRegularRegistrationState(event: RegularRegistrationEvent, now = new Date()) {
  if (!["PUBLIC_OPEN", "MIXED"].includes(event.audienceMode)) {
    return { open: false, reason: "Pendaftaran reguler tidak tersedia untuk daurah ini." };
  }
  if (event.status === "PUBLISHED") {
    return { open: false, reason: event.registrationCloseAt && new Date(event.registrationCloseAt) < now
      ? "Jadwal pendaftaran sudah lewat dan panitia belum membuka pendaftaran reguler. Hubungi panitia untuk jadwal baru."
      : "Daurah sudah diterbitkan, tetapi panitia belum membuka pendaftaran reguler." };
  }
  if (event.status !== "REGISTRATION_OPEN") {
    return { open: false, reason: "Pendaftaran reguler untuk daurah ini sedang ditutup." };
  }
  if (event.registrationOpenAt && new Date(event.registrationOpenAt) > now) {
    return { open: false, reason: "Pendaftaran reguler belum mencapai waktu pembukaannya." };
  }
  if (event.registrationCloseAt && new Date(event.registrationCloseAt) < now) {
    return { open: false, reason: "Batas waktu pendaftaran reguler sudah lewat." };
  }
  if (event.regularQuota != null && event.regularApproved >= event.regularQuota ||
      event.capacity != null && event.regularApproved + event.invitationApproved >= event.capacity) {
    return { open: false, reason: "Kuota pendaftaran reguler sudah penuh." };
  }
  return { open: true, reason: "" };
}
