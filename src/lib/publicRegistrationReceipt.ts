import type { ParticipantCardDetails } from "@/components/public/ParticipantQrCard";
import { buildEventWhatsAppUrl } from "@/lib/eventWhatsApp";

export type ReceiptParticipant = ParticipantCardDetails & {
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
  const attendance = participants.length > 1 ? "kami berencana hadir" : "saya berencana hadir";
  return [
    "Assalamu’alaikum warahmatullahi wabarakatuh.",
    "",
    `Saya ingin mengabari panitia bahwa pendaftaran untuk ${eventName} telah tersimpan. Insya Allah ${attendance}:`,
    names,
    "",
    "Kami menunggu persetujuan admin. Bila diwajibkan, setiap asatidz akan mengonfirmasi lewat tautan pribadi sebelum QR dapat digunakan untuk absensi.",
    "Mohon kabari bila ada perubahan informasi kegiatan. Jazakumullahu khairan.",
  ].join("\n");
}

export function registrationAttendanceWhatsAppUrl(eventName: string, participants: Pick<ReceiptParticipant, "fullName" | "participantCode">[], contactWhatsapp?: string | null) {
  const message = buildRegistrationAttendanceMessage(eventName, participants);
  return buildEventWhatsAppUrl(message, contactWhatsapp) || buildEventWhatsAppUrl(message) || "https://wa.me/";
}
