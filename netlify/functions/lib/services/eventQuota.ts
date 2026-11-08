import { ValidationError } from "../utils/errors";

export type QuotaEvent = {
  capacity?: number | null;
  regularQuota?: number | null;
  invitationQuota?: number | null;
};

export function isRegularRegistrationSource(source: string) {
  return source === "DIRECT_PUBLIC" || source === "DIRECT_ADMIN_UPLOAD" || source === "ADMIN_ENTRY";
}

export function assertValidQuotaAllocation(event: QuotaEvent) {
  const { capacity, regularQuota, invitationQuota } = event;
  if (capacity != null && ((regularQuota != null && regularQuota > capacity) || (invitationQuota != null && invitationQuota > capacity))) {
    throw new ValidationError("Kuota jalur tidak boleh melebihi kapasitas total event.");
  }
  if (capacity != null && regularQuota != null && invitationQuota != null && regularQuota + invitationQuota > capacity) {
    throw new ValidationError("Jumlah kuota reguler dan undangan tidak boleh melebihi kapasitas total event.");
  }
}

export function assertQuotaCoversApproved(event: QuotaEvent, approved: { regular: number; invitation: number; total?: number }) {
  const total = approved.total ?? approved.regular + approved.invitation;
  if (event.capacity != null && total > event.capacity) {
    throw new ValidationError(`Kapasitas total tidak boleh kurang dari ${total} peserta yang sudah disetujui.`);
  }
  if (event.regularQuota != null && approved.regular > event.regularQuota) {
    throw new ValidationError(`Kuota reguler tidak boleh kurang dari ${approved.regular} peserta yang sudah disetujui.`);
  }
  if (event.invitationQuota != null && approved.invitation > event.invitationQuota) {
    throw new ValidationError(`Kuota undangan tidak boleh kurang dari ${approved.invitation} peserta yang sudah disetujui.`);
  }
}

export function quotaForSource(event: QuotaEvent, source: string) {
  return isRegularRegistrationSource(source) ? event.regularQuota : event.invitationQuota;
}
