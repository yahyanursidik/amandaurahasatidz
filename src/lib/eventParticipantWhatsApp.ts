import { formatEventDate, fromEventIso } from "./eventDateTime";
import { ATTENDANCE_EVENT_STATUSES, registrationStage, registrationStageCopy } from "./registrationStatus";
import type { ParticipantSourceFilter } from "./participantCatalog";

export const eventWhatsAppStatusFilters = [
  ["ALL", "Semua status"],
  ["PENDING_REVIEW", "Menunggu tinjauan"],
  ["AWAITING_CONFIRMATION", "Belum konfirmasi hadir"],
  ["APPROVED", "Disetujui"],
  ["WAITLISTED", "Daftar tunggu"],
  ["DECLINED", "Ditolak"],
  ["CANCELLED", "Berhalangan / mundur"],
] as const;
export type EventWhatsAppStatusFilter = typeof eventWhatsAppStatusFilters[number][0];
export type EventWhatsAppFilters = {
  search: string;
  source: ParticipantSourceFilter;
  status: EventWhatsAppStatusFilter;
  institutionId?: string;
  invitationId?: string;
};
export type WhatsAppWizardRecipient = {
  id: string;
  fullName: string;
  institutionName: string | null;
  number: string | null;
  numberSource: "WhatsApp" | "Telepon cadangan" | null;
  email?: string | null; // Directory only, for the existing search behavior.
  participantCode?: string;
  registrationSource?: string | null;
  approvalStatus?: string;
  confirmationStatus?: string;
  confirmationAvailable?: boolean;
  sharedNumber?: boolean;
  needsContactReview?: boolean;
  registrationStatusUrl?: string | null;
};
export type EventWhatsAppContext = {
  id: string; name: string; slug: string; startDate: string; endDate: string; status: string;
  timezone: string; venueName: string | null;
  attendanceConfirmationRequired: boolean;
  attendanceConfirmationDeadline: string | null;
  lateConfirmationPolicy: string;
};
export type EventWhatsAppPage = { recipients: WhatsAppWizardRecipient[]; hasNext: boolean };
export type EventWhatsAppResolution = { event: EventWhatsAppContext; recipients: WhatsAppWizardRecipient[] };

export function parseEventWhatsAppFilters(params: URLSearchParams): EventWhatsAppFilters {
  const source = params.get("source");
  const status = eventWhatsAppStatusFilters.find(([value]) => value === params.get("status"))?.[0] ?? "ALL";
  const validId = (id: string | null) => id && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id) ? id : undefined;
  return {
    search: (params.get("search") || "").trim().slice(0, 100),
    source: source === "REGULAR" || source === "INSTITUTION" || source === "INDIVIDUAL" ? source : "ALL",
    status,
    institutionId: validId(params.get("institutionId")),
    invitationId: validId(params.get("invitationId")),
  };
}

export function eventWhatsAppFilterParams(filters: EventWhatsAppFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value && value !== "ALL") params.set(key, value);
  return params;
}

export function eventWhatsAppHref(eventId: string, filters: EventWhatsAppFilters, view: "wizard" | "participants") {
  const params = eventWhatsAppFilterParams(filters);
  if (view === "participants") params.set("view", "participants");
  return `/admin/events/${encodeURIComponent(eventId)}/registrations${view === "wizard" ? "/whatsapp" : ""}${params.size ? `?${params}` : ""}`;
}

export function eventWhatsAppStage(person: WhatsAppWizardRecipient, event: EventWhatsAppContext) {
  return registrationStage({ approvalStatus: person.approvalStatus || "", confirmationStatus: person.confirmationStatus || "",
    attendanceConfirmationRequired: event.attendanceConfirmationRequired });
}

export function eventWhatsAppStatusLabel(person: WhatsAppWizardRecipient, event: EventWhatsAppContext) {
  const stage = eventWhatsAppStage(person, event);
  return stage === "READY" ? "Disetujui" : registrationStageCopy[stage].label;
}

/** Unknown/changed contacts never produce a draft; numbers already sent in this batch are not repeated. */
export function isRepeatedEventWhatsAppNumber(active: WhatsAppWizardRecipient, recipients: WhatsAppWizardRecipient[], statuses: Record<string, string>) {
  return Boolean(active.number && recipients.some((person) =>
    person.id !== active.id && person.number === active.number && statuses[person.id] === "MARKED_SENT"));
}

export function eventWhatsAppIsOpen(event: EventWhatsAppContext, now = new Date()) {
  const today = fromEventIso(now.toISOString(), event.timezone).slice(0, 10);
  return ATTENDANCE_EVENT_STATUSES.includes(event.status) && event.endDate >= today;
}

export function eventWhatsAppCanConfirm(event: EventWhatsAppContext, now = new Date()) {
  return event.attendanceConfirmationRequired && eventWhatsAppIsOpen(event, now) &&
    (event.lateConfirmationPolicy !== "BLOCK" || !event.attendanceConfirmationDeadline || Date.parse(event.attendanceConfirmationDeadline) >= now.getTime());
}

export function eventWhatsAppDateRange(event: EventWhatsAppContext) {
  const start = formatEventDate(event.startDate);
  return event.endDate === event.startDate ? start : `${start} – ${formatEventDate(event.endDate)}`;
}
