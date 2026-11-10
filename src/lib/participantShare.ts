import { buildParticipantEmailUrl, buildWhatsAppUrl, normalizeWhatsAppNumber } from "./participantCommunication";

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
  attendanceConfirmationRequired?: boolean;
};

const statusLabel: Record<string, string> = {
  APPROVED: "Disetujui",
  PENDING_REVIEW: "Menunggu tinjauan panitia",
  WAITLISTED: "Daftar tunggu",
};

export function participantCardShareUrl(details: ParticipantShareDetails, origin: string) {
  if (details.approvalStatus !== "APPROVED" || ["CANCELLED", "REPLACED"].includes(details.confirmationStatus)
    || !details.qrToken?.startsWith("pqr_") || !details.cardUrl) return null;
  try {
    const url = new URL(details.cardUrl, origin);
    if (url.origin !== new URL(origin).origin || url.pathname !== "/card"
      || url.searchParams.get("token") !== details.qrToken) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function participantConfirmationShareUrl(details: ParticipantShareDetails, origin: string) {
  if (details.approvalStatus !== "APPROVED" || ["CANCELLED", "REPLACED"].includes(details.confirmationStatus)
    || !details.confirmationUrl) return null;
  try {
    const url = new URL(details.confirmationUrl, origin);
    if (url.origin !== new URL(origin).origin || url.pathname !== "/confirm" || !url.hash.startsWith("#pcf_")) return null;
    return url.toString();
  } catch { return null; }
}

export function buildParticipantRegistrationMessage(details: ParticipantShareDetails, origin: string) {
  const cardUrl = participantCardShareUrl(details, origin);
  const confirmationUrl = participantConfirmationShareUrl(details, origin);
  const lines = [
    "Assalamu'alaikum warahmatullahi wabarakatuh.",
    "",
    `Ustadz ${details.fullName}, berikut informasi pendaftaran Anda:`,
    `Event: ${details.eventName}`,
    `Kode pendaftaran: ${details.participantCode}`,
    `Status: ${statusLabel[details.approvalStatus] || details.approvalStatus}`,
    `Tanggal: ${details.startDate}${details.endDate !== details.startDate ? ` s.d. ${details.endDate}` : ""}`,
    ...(details.venueName ? [`Lokasi: ${details.venueName}`] : []),
    "",
    ...(confirmationUrl ? [details.confirmationStatus === "CONFIRMED"
      ? "1. Status hadir / mengundurkan diri (tautan pribadi, tanpa login):"
      : "1. Konfirmasi hadir / berhalangan (tautan pribadi, tanpa login):",
      confirmationUrl,
      details.confirmationStatus === "CONFIRMED"
        ? "Gunakan tautan ini bila rencana berubah sebelum presensi."
        : "Pilih ‘Insya Allah hadir’ atau ‘Berhalangan’. QR aktif setelah konfirmasi.", ""] : []),
    ...(cardUrl ? [
      confirmationUrl ? details.confirmationStatus === "CONFIRMED" ? "2. Kartu QR pribadi (aktif):" : "2. Bukti QR pribadi (belum aktif):" : "Kartu QR pribadi:", cardUrl,
      confirmationUrl ? details.confirmationStatus === "CONFIRMED"
        ? "Simpan kartu ini. Tunjukkan QR/kode kepada petugas pada setiap hari acara."
        : "Simpan bukti ini. Setelah konfirmasi, tunjukkan QR/kode kepada petugas pada setiap hari acara."
        : "Simpan kartu dan tunjukkan QR/kode kepada panitia saat presensi setiap hari acara.",
      "Tautan QR bersifat pribadi. Jangan meneruskannya kepada orang lain.",
    ] : ["Kode ini adalah bukti pendaftaran, belum berlaku untuk presensi. QR presensi aktif setelah pendaftaran disetujui panitia."]),
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
    whatsappUrl: buildWhatsAppUrl(normalizeWhatsAppNumber(details.whatsapp) || normalizeWhatsAppNumber(details.phone) || "", message),
    // Restrict legacy addresses before constructing mailto to prevent injected headers.
    emailUrl: details.email && !/[?#&%\s]/.test(details.email)
      ? buildParticipantEmailUrl(details.email, `Kode pendaftaran ${details.eventName} — ${details.participantCode}`.replace(/[\uD800-\uDFFF]/g, ""), message) : null,
    cardUrl: participantCardShareUrl(details, origin),
    confirmationUrl: participantConfirmationShareUrl(details, origin),
  };
}
