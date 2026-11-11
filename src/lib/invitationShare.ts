export interface InvitationShareContext {
  institutionName: string;
  recipientType?: "INSTITUTION" | "INDIVIDUAL";
  eventName: string;
  invitationNumber: string;
  invitationUrl: string;
  accessCode?: string | null;
  responseDeadline?: string | null;
  allowGroup?: boolean;
  registrationMode?: "DELEGATION" | "INDIVIDUAL_SELF";
  quota?: number;
  timezone?: string;
}

const formatDeadline = (value?: string | null, timezone = "Asia/Jakarta") => {
  if (!value) return "sesuai informasi dari panitia";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sesuai informasi dari panitia";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"].includes(timezone) ? timezone : "Asia/Jakarta",
  }).format(date);
};

export const normalizeWhatsAppRecipient = (value?: string | null) => {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
};

export const buildInvitationShareText = (context: InvitationShareContext) =>
  [
    "Assalamu'alaikum warahmatullahi wabarakatuh.",
    "",
    `Yth. ${context.institutionName},`,
    context.recipientType === "INDIVIDUAL"
      ? `Kami panitia Daurah Duat dan Pegiat Dakwah mengundang Anda secara pribadi untuk menghadiri ${context.eventName}.`
      : context.registrationMode === "INDIVIDUAL_SELF"
        ? `Kami panitia Daurah Duat dan Pegiat Dakwah mengundang para asatidz dari ${context.institutionName} untuk menghadiri ${context.eventName}.`
        : `Kami panitia Daurah Duat dan Pegiat Dakwah mengundang perwakilan lembaga untuk menghadiri ${context.eventName}.`,
    "",
    context.recipientType === "INDIVIDUAL"
      ? "Silakan konfirmasi kehadiran melalui tautan pribadi berikut:"
      : context.registrationMode === "INDIVIDUAL_SELF"
        ? "Silakan bagikan tautan khusus berikut kepada asatidz di lembaga Anda. Setiap asatidz mengisi data dirinya sendiri:"
        : "Silakan konfirmasi kehadiran dan daftarkan para asatidz yang mewakili lembaga melalui tautan khusus berikut:",
    context.invitationUrl,
    "",
    ...(context.accessCode ? [`Kode unik lembaga: ${context.accessCode}`, ""] : []),
    `Nomor undangan: ${context.invitationNumber}`,
    `Batas konfirmasi: ${formatDeadline(context.responseDeadline, context.timezone)}`,
    ...(context.recipientType === "INDIVIDUAL" ? ["Undangan ini hanya untuk satu asatidz dan tidak dapat dialihkan."]
      : context.registrationMode === "INDIVIDUAL_SELF" ? [`Kuota lembaga: ${context.quota || 1} asatidz. Tautan dapat dipakai berulang sampai kuota penuh atau batas respons berakhir. Setiap pendaftar menunggu persetujuan admin.`]
      : context.allowGroup !== undefined ? [context.allowGroup
      ? `Boleh membawa rombongan, maksimal ${context.quota || 2} peserta termasuk peserta utama.`
      : "Undangan berlaku untuk satu perwakilan, tanpa peserta tambahan."] : []),
    "",
    context.recipientType === "INDIVIDUAL"
      ? "Mohon simpan tautan pribadi ini dan jangan meneruskannya kepada orang lain. Jazakumullahu khairan."
      : `Mohon menjaga tautan${context.accessCode ? " dan kode unik" : ""} ini serta tidak meneruskannya kepada pihak di luar lembaga. Jazakumullahu khairan.`,
    "",
    "Wassalamu'alaikum warahmatullahi wabarakatuh.",
  ].join("\n");

export const buildWhatsAppShareUrl = (
  context: InvitationShareContext,
  recipient?: string | null,
) => {
  const normalizedRecipient = normalizeWhatsAppRecipient(recipient);
  const path = normalizedRecipient ? `/${normalizedRecipient}` : "";
  return `https://wa.me${path}?text=${encodeURIComponent(buildInvitationShareText(context))}`;
};

export const buildEmailShareUrl = (
  context: InvitationShareContext,
  recipient?: string | null,
) => {
  const subject = `Undangan ${context.eventName} — ${context.institutionName}`;
  const address = recipient?.trim() || "";
  return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(buildInvitationShareText(context))}`;
};
