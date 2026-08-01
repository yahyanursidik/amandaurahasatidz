export interface InvitationShareContext {
  institutionName: string;
  eventName: string;
  invitationNumber: string;
  invitationUrl: string;
  responseDeadline?: string | null;
}

const formatDeadline = (value?: string | null) => {
  if (!value) return "sesuai informasi dari panitia";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sesuai informasi dari panitia";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
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
    `Kami panitia Aman Daurah Asatidz mengundang perwakilan lembaga untuk menghadiri ${context.eventName}.`,
    "",
    "Silakan konfirmasi kehadiran dan daftarkan para asatidz yang mewakili lembaga melalui tautan khusus berikut:",
    context.invitationUrl,
    "",
    `Nomor undangan: ${context.invitationNumber}`,
    `Batas konfirmasi: ${formatDeadline(context.responseDeadline)}`,
    "",
    "Mohon menjaga tautan ini dan tidak meneruskannya kepada pihak di luar lembaga. Jazakumullahu khairan.",
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
