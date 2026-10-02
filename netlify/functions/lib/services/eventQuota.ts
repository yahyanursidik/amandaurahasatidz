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

export function quotaForSource(event: QuotaEvent, source: string) {
  return isRegularRegistrationSource(source) ? event.regularQuota : event.invitationQuota;
}
