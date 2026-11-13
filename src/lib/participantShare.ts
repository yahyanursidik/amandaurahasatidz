import { buildParticipantEmailUrl, buildWhatsAppUrl, normalizeWhatsAppNumber } from "./participantCommunication";
import { registrationStage, registrationStageCopy } from "./registrationStatus";
import { registrationReceiptHref } from "./registrationStatusLink";

export type ParticipantShareDetails = {
  participantId: string;
  eventId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  participantCode: string;
  eventName: string;
  startDate: string;
  endDate: string;
  venueName: string | null;
  approvalStatus: string;
  confirmationStatus: string;
  qrToken: string | null;
  cardUrl: string | null;
  confirmationUrl?: string | null;
  registrationStatusUrl?: string | null;
  attendanceConfirmationRequired?: boolean;
  eventOpen?: boolean;
};

export function participantCardShareUrl(details: ParticipantShareDetails, origin: string) {
  // Legacy browser payloads are not authority to distribute attendance credentials.
  void details; void origin;
  return null;
}

function participantRegistrationStatusUrl(details: ParticipantShareDetails, origin: string) {
  if (["INACTIVE", "DECLINED"].includes(registrationStage(details))) return null;
  return registrationReceiptHref(details.registrationStatusUrl, origin);
}

export function buildParticipantRegistrationMessage(details: ParticipantShareDetails, origin: string) {
  const cardUrl = participantCardShareUrl(details, origin);
  const statusUrl = participantRegistrationStatusUrl(details, origin);
  const stage = registrationStage(details);
  const copy = details.eventOpen === false ? { label: "Presensi tidak tersedia", next: "Hubungi panitia untuk bantuan terkait acara ini." }
    : stage === "READY" && !cardUrl ? { label: "Pendaftaran disetujui", next: "Lihat status terbaru untuk mendapatkan QR presensi." }
      : registrationStageCopy[stage];
  const lines = [
    "Assalamu'alaikum warahmatullahi wabarakatuh.",
    "",
    `Ustadz ${details.fullName}, berikut informasi pendaftaran Anda:`,
    `Event: ${details.eventName}`,
    `Kode pendaftaran: ${details.participantCode}`,
    `Status: ${copy.label}`,
    `Tanggal: ${details.startDate}${details.endDate !== details.startDate ? ` s.d. ${details.endDate}` : ""}`,
    ...(details.venueName ? [`Lokasi: ${details.venueName}`] : []),
    "",
    copy.next,
    ...(statusUrl ? ["Lihat bukti dan status pendaftaran:", statusUrl,
      "Konfirmasi atau QR tersedia melalui Portal Asatidz atau tautan yang diminta ke email peserta."] : []),
    ...(statusUrl || cardUrl ? ["Jangan teruskan tautan pribadi ini kepada orang lain."] : []),
    "",
    "Jazakumullahu khairan.",
    `Panitia ${details.eventName}`,
  ];
  // Legacy/malformed text should not crash encodeURIComponent during rendering.
  return lines.join("\n").replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "\uFFFD");
}

export function buildParticipantRegistrationShareLinks(details: ParticipantShareDetails, origin: string) {
  const message = buildParticipantRegistrationMessage(details, origin);
  return {
    message,
    whatsappUrl: normalizeWhatsAppNumber(details.whatsapp) ? buildWhatsAppUrl(normalizeWhatsAppNumber(details.whatsapp)!, message) : null,
    // Restrict legacy addresses before constructing mailto to prevent injected headers.
    emailUrl: details.email && !/[?#&%\s]/.test(details.email)
      ? buildParticipantEmailUrl(details.email, `Kode pendaftaran ${details.eventName} — ${details.participantCode}`.replace(/[\uD800-\uDFFF]/g, ""), message) : null,
    cardUrl: participantCardShareUrl(details, origin),
    statusUrl: participantRegistrationStatusUrl(details, origin),
  };
}
