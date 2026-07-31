import { ValidationError } from "../utils/errors";
import { renderHtmlByTemplateCode } from "./emailHtmlTemplates";

export interface TemplateDefinition {
  code: string;
  subjectTemplate: string;
  bodyTemplate: string;
  allowedVariables: string[];
}

export const TEMPLATE_WHITELISTS: Record<string, TemplateDefinition> = {
  INVITATION_INSTITUTION: {
    code: "INVITATION_INSTITUTION",
    subjectTemplate: "Undangan Resmi Daurah Asatidz - {{institutionName}} (No: {{invitationNumber}})",
    bodyTemplate:
      "Assalamu'alaikum Warahmatullah Wabarakatuh,\n\nKepada Perwakilan {{institutionName}},\n\nKami mengundang {{institutionName}} untuk mengirimkan {{quota}} delegasi Asatidz pada kegiatan {{eventName}} yang akan diselenggarakan pada {{eventDates}}.\n\nSilakan konfirmasikan kehadiran dan isi data delegasi melalui tautan berikut:\n{{invitationLink}}\n\nJazakumullah Khairan,\nPanitia Daurah YTS",
    allowedVariables: [
      "institutionName",
      "invitationNumber",
      "eventName",
      "eventDates",
      "quota",
      "invitationLink",
    ],
  },
  INVITATION_INDIVIDUAL: {
    code: "INVITATION_INDIVIDUAL",
    subjectTemplate: "Undangan Keikutsertaan Daurah Asatidz - {{ustadzName}}",
    bodyTemplate:
      "Assalamu'alaikum Warahmatullah Wabarakatuh,\n\nKepada Yth. {{ustadzName}},\n\nKami mengundang Ustadz untuk hadir pada kegiatan {{eventName}} yang akan dilaksanakan pada {{eventDates}}.\n\nSilakan konfirmasikan kehadiran Ustadz melalui tautan berikut:\n{{invitationLink}}\n\nJazakumullah Khairan,\nPanitia Daurah YTS",
    allowedVariables: ["ustadzName", "eventName", "eventDates", "invitationLink", "participantCode", "qrCodeUrl", "eventVenue"],
  },
  REGISTRATION_CONFIRMED: {
    code: "REGISTRATION_CONFIRMED",
    subjectTemplate: "✅ Bukti Pendaftaran Daurah - Kode Peserta: {{participantCode}}",
    bodyTemplate:
      "Assalamu'alaikum Warahmatullah Wabarakatuh,\n\nKepada Yth. {{ustadzName}},\n\nKonfirmasi keikutsertaan Ustadz pada {{eventName}} telah berhasil disimpan.\nKode Peserta Ustadz adalah: {{participantCode}}\n\nQR Code Registrasi:\n{{qrCodeUrl}}\n\nJazakumullah Khairan,\nPanitia Daurah YTS",
    allowedVariables: ["ustadzName", "eventName", "eventDates", "eventVenue", "participantCode", "qrCodeUrl"],
  },
  OTP_CODE: {
    code: "OTP_CODE",
    subjectTemplate: "🔐 Kode Otentikasi Masuk Sistem Daurah YTS: {{otpCode}}",
    bodyTemplate:
      "Kode OTP untuk verifikasi masuk Sistem Informasi Daurah Asatidz YTS Anda adalah:\n\n{{otpCode}}\n\nKode ini berlaku selama {{expiresMinutes}} menit. Jangan bagikan kode ini kepada siapapun.",
    allowedVariables: ["otpCode", "expiresMinutes"],
  },
  THANK_YOU_CONFIRMED: {
    code: "THANK_YOU_CONFIRMED",
    subjectTemplate: "🤝 Terima Kasih atas Konfirmasi Kehadiran - {{eventName}}",
    bodyTemplate:
      "Assalamu'alaikum Warahmatullah Wabarakatuh,\n\nKepada Yth. {{recipientName}},\n\nTerima kasih telah melakukan konfirmasi kehadiran resmi untuk kegiatan {{eventName}}.\nKode Peserta Ustadz adalah: {{participantCode}}\n\nJazakumullah Khairan,\nPanitia Daurah YTS",
    allowedVariables: ["recipientName", "eventName", "eventDates", "participantCode"],
  },
  THANK_YOU_ATTENDED: {
    code: "THANK_YOU_ATTENDED",
    subjectTemplate: "🌿 Jazakumullah Khairan atas Kehadiran Ustadz pada Daurah - {{eventName}}",
    bodyTemplate:
      "Assalamu'alaikum Warahmatullah Wabarakatuh,\n\nKepada Yth. {{recipientName}},\n\nJazakumullah Khairan atas kehadiran dan partisipasi aktif Ustadz pada kegiatan {{eventName}}.\nSemoga ilmu dan silaturahmi yang terjalin memberikan keberkahan bagi dakwah kita bersama.\n\nPanitia Daurah YTS",
    allowedVariables: ["recipientName", "eventName"],
  },
  EVENT_REMINDER: {
    code: "EVENT_REMINDER",
    subjectTemplate: "📅 Pengingat: {{eventName}} — {{daysRemaining}} Hari Lagi",
    bodyTemplate:
      "Assalamu'alaikum Warahmatullah Wabarakatuh,\n\nKepada Yth. {{ustadzName}},\n\nIni adalah pengingat bahwa kegiatan {{eventName}} akan dilaksanakan pada {{eventDates}}.\nKode Peserta Anda: {{participantCode}}\n\nSemoga Allah memudahkan perjalanan Ustadz.\n\nPanitia Daurah YTS",
    allowedVariables: [
      "ustadzName",
      "eventName",
      "eventDates",
      "eventVenue",
      "participantCode",
      "daysRemaining",
      "portalLink",
    ],
  },
};

/**
 * Render template sebagai plain text (untuk fallback / audit log).
 * Menggunakan subject dari whitelist + substitusi variabel.
 */
export function renderEmailTemplate(
  templateCode: string,
  variables: Record<string, any>
): { subject: string; body: string } {
  const tpl = TEMPLATE_WHITELISTS[templateCode];
  if (!tpl) {
    throw new ValidationError(`Template email '${templateCode}' tidak ditemukan dalam sistem.`);
  }

  // Verify variable whitelist (only check provided keys)
  const providedKeys = Object.keys(variables);
  for (const key of providedKeys) {
    if (!tpl.allowedVariables.includes(key)) {
      throw new ValidationError(
        `Variabel '${key}' tidak diizinkan (unwhitelisted) untuk template email '${templateCode}'.`
      );
    }
  }

  let subject = tpl.subjectTemplate;
  let body = tpl.bodyTemplate;

  for (const varName of tpl.allowedVariables) {
    const val = variables[varName] !== undefined ? String(variables[varName]) : "";
    const placeholder = new RegExp(`{{\\s*${varName}\\s*}}`, "g");
    subject = subject.replace(placeholder, val);
    body = body.replace(placeholder, val);
  }

  return { subject, body };
}

/**
 * Render template sebagai HTML premium (menggunakan emailHtmlTemplates.ts).
 * Digunakan oleh emailQueueService untuk pengiriman email nyata.
 */
export function renderHtmlEmailTemplate(
  templateCode: string,
  variables: Record<string, any>
): { subject: string; htmlBody: string; textBody: string } {
  // Validasi template dan hasilkan subject + plain text
  const { subject, body: textBody } = renderEmailTemplate(templateCode, variables);

  // Render HTML premium
  const htmlBody = renderHtmlByTemplateCode(templateCode, variables);

  return { subject, htmlBody, textBody };
}
