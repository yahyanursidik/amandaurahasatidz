import type { ParticipantCardDetails } from "@/components/public/ParticipantQrCard";
import { buildEventWhatsAppUrl } from "@/lib/eventWhatsApp";

export type ReceiptParticipant = Pick<ParticipantCardDetails, "fullName" | "participantCode"> & {
  email?: string;
  registrationStatusUrl?: string | null;
  approvalStatus?: string;
  confirmationStatus?: string;
  whatsapp?: string | null;
  confirmationUrl?: string | null;
  passwordSetupRequired: boolean;
  temporaryPassword?: string | null;
  temporaryPasswordIssued?: boolean;
};

export const publicRundownPath = (slug: string) =>
  `/events/${encodeURIComponent(slug)}#jadwal-kegiatan`;

/** WhatsApp opens a draft; it does not change the attendance record. */
export function buildRegistrationAttendanceMessage(
  eventName: string,
  participants: Pick<ReceiptParticipant, "fullName" | "participantCode">[],
) {
  const names = participants.map((person) => `• ${person.fullName} — ${person.participantCode}`).join("\n");
  return [
    "Assalamu’alaikum warahmatullahi wabarakatuh.",
    "",
    `Saya ingin menanyakan informasi pendaftaran untuk ${eventName}:`,
    names,
    "",
    "Mohon bantuan panitia untuk memeriksa statusnya. Jazakumullahu khairan.",
  ].join("\n");
}

export function registrationAttendanceWhatsAppUrl(eventName: string, participants: Pick<ReceiptParticipant, "fullName" | "participantCode">[], contactWhatsapp?: string | null) {
  const message = buildRegistrationAttendanceMessage(eventName, participants);
  return buildEventWhatsAppUrl(message, contactWhatsapp) || buildEventWhatsAppUrl(message) || "https://wa.me/";
}
