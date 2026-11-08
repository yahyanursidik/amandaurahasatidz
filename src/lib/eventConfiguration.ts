import type { EventFormValues } from "@/components/admin/events/EventForm";

export type EventConfigurationField =
  | "startDate" | "endDate" | "registrationOpenAt" | "registrationCloseAt"
  | "invitationResponseDeadline" | "capacity" | "regularQuota"
  | "invitationQuota" | "defaultInstitutionQuota";

export type EventConfigurationErrors = Partial<Record<EventConfigurationField, string>>;

export const includesRegularRegistration = (mode: string) => mode === "PUBLIC_OPEN" || mode === "MIXED";
export const includesInvitationRegistration = (mode: string) => mode !== "PUBLIC_OPEN";
export const includesInstitutionInvitation = (mode: string) => mode === "INSTITUTION_INVITATION" || mode === "MIXED";

const isWholeNumber = (value: string, minimum: number) => /^\d+$/.test(value) && Number(value) >= minimum;

export function validateEventConfiguration(values: EventFormValues): EventConfigurationErrors {
  const errors: EventConfigurationErrors = {};
  if (values.startDate && values.endDate && values.endDate < values.startDate) {
    errors.endDate = "Tanggal selesai harus sama atau setelah tanggal mulai.";
  }
  if (values.registrationOpenAt && values.registrationCloseAt && values.registrationOpenAt >= values.registrationCloseAt) {
    errors.registrationCloseAt = "Penutupan harus setelah waktu pembukaan pendaftaran.";
  }
  if (values.startDate && values.invitationResponseDeadline &&
    values.invitationResponseDeadline > `${values.startDate}T00:00`) {
    errors.invitationResponseDeadline = "Batas respons harus sebelum tanggal mulai event.";
  }

  for (const [key, minimum] of [["capacity", 1], ["regularQuota", 0], ["invitationQuota", 0], ["defaultInstitutionQuota", 1]] as const) {
    if (!values[key]) continue;
    if (!isWholeNumber(values[key], minimum)) errors[key] = `Isi bilangan bulat minimal ${minimum}.`;
  }
  const capacity = Number(values.capacity);
  const regular = Number(values.regularQuota);
  const invitation = Number(values.invitationQuota);
  if (values.capacity && !errors.capacity) {
    if (values.regularQuota && regular > capacity) {
      errors.regularQuota = "Kuota reguler tidak boleh melebihi kapasitas total.";
    }
    if (values.invitationQuota && invitation > capacity) {
      errors.invitationQuota = "Kuota undangan tidak boleh melebihi kapasitas total.";
    }
    if (values.regularQuota && values.invitationQuota && regular + invitation > capacity) {
      errors.capacity = "Jumlah kuota reguler dan undangan melebihi kapasitas total.";
    }
  }
  return errors;
}
