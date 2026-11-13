import { ValidationError } from "../utils/errors";
import { renderBrandedTextEmailHtml, renderHtmlByTemplateCode } from "./emailHtmlTemplates";
import { DEFAULT_TRANSACTIONAL_EMAIL_COPY, stripLegacyEmailGreeting, transactionalEmailOpening,
  type TransactionalEmailCopy } from "./transactionalEmailCopy";

export interface TemplateDefinition {
  code: string;
  subjectTemplate: string;
  bodyTemplate: string;
  allowedVariables: string[];
}

export const TEMPLATE_WHITELISTS: Record<string, TemplateDefinition> = {
  REGISTRATION_STATUS_ACCESS: {
    code: "REGISTRATION_STATUS_ACCESS",
    subjectTemplate: "Tautan pribadi — {{eventName}}",
    bodyTemplate: "Berikut tautan pribadi yang Ustadz minta untuk {{eventName}}:\n{{registrationStatusLink}}\n\nTautan ini berlaku {{expiresMinutes}} menit. Gunakan untuk mengonfirmasi kehadiran, menyatakan berhalangan, atau membuka QR presensi sesuai status pendaftaran. Jangan teruskan tautan ini. Jika Ustadz tidak memintanya, abaikan email ini.\n\nJazakumullahu khairan,\nPanitia Daurah Duat dan Pegiat Dakwah",
    allowedVariables: ["ustadzName", "eventName", "registrationStatusLink", "expiresMinutes"],
  },
  REGISTRATION_APPROVED: {
    code: "REGISTRATION_APPROVED",
    subjectTemplate: "Pendaftaran disetujui — {{eventName}}",
    bodyTemplate: "Alhamdulillah, pendaftaran Ustadz untuk {{eventName}} telah disetujui. Untuk membuka QR presensi, masuk ke Portal Asatidz atau minta tautan pribadi dari halaman status.\n\nKode pendaftaran: {{participantCode}}\nLihat status: {{registrationStatusLink}}\nRundown: {{rundownLink}}\n\nAkun Portal Asatidz: {{email}}\nMasuk atau buat sandi pribadi: {{portalLink}}\n\nJazakumullahu khairan,\nPanitia Daurah Duat dan Pegiat Dakwah",
    allowedVariables: ["ustadzName", "eventName", "participantCode", "registrationStatusLink", "cardLink", "email", "portalLink", "rundownLink"],
  },
  REGISTRATION_CONFIRMATION_REQUEST: {
    code: "REGISTRATION_CONFIRMATION_REQUEST",
    subjectTemplate: "Pendaftaran disetujui — mohon konfirmasi hadir untuk {{eventName}}",
    bodyTemplate: "Alhamdulillah, pendaftaran Ustadz untuk {{eventName}} telah disetujui. Masih ada satu langkah: konfirmasi kehadiran.\n\nBuka halaman status: {{registrationStatusLink}}\nMasuk ke Portal Asatidz atau minta tautan pribadi ke email Ustadz. Pilih “Insya Allah hadir” agar QR presensi dapat diterbitkan, atau “Berhalangan” jika tidak dapat hadir. Konfirmasi bukan presensi.\n\nKode pendaftaran: {{participantCode}}\nRundown: {{rundownLink}}\n\nJazakumullahu khairan,\nPanitia Daurah Duat dan Pegiat Dakwah",
    allowedVariables: ["ustadzName", "eventName", "participantCode", "registrationStatusLink", "confirmationLink", "rundownLink", "portalLink"],
  },
  PARTICIPANT_ATTENDANCE_CONFIRMED: {
    code: "PARTICIPANT_ATTENDANCE_CONFIRMED",
    subjectTemplate: "Konfirmasi hadir tersimpan — {{eventName}}",
    bodyTemplate: "Konfirmasi hadir Ustadz untuk {{eventName}} telah tersimpan. Konfirmasi ini bukan presensi.\n\n{{nextStep}}\nLihat status pribadi: {{registrationStatusLink}}\nKode pendaftaran: {{participantCode}}\nRundown: {{rundownLink}}\n\nJika rencana berubah, gunakan halaman status untuk melihat pilihan pengunduran diri. Jangan teruskan tautan pribadi ini.\n\nJazakumullahu khairan,\nPanitia Daurah Duat dan Pegiat Dakwah",
    allowedVariables: ["ustadzName", "eventName", "participantCode", "registrationStatusLink", "nextStep", "rundownLink", "portalLink", "cardLink", "cardInstruction", "confirmationLink", "reviewNotice"],
  },
  PARTICIPANT_ATTENDANCE_DECLINED: {
    code: "PARTICIPANT_ATTENDANCE_DECLINED",
    subjectTemplate: "Berhalangan hadir tercatat — {{eventName}}",
    bodyTemplate: "Assalamu’alaikum warahmatullahi wabarakatuh.\n\nYth. {{ustadzName}},\n\nInformasi berhalangan hadir untuk {{eventName}} telah tersimpan. Kode pendaftaran: {{participantCode}}. QR sebelumnya tidak berlaku lagi dan tempat dapat diberikan kepada peserta lain.\n\nBila rencana berubah, hubungi panitia agar data ditinjau kembali.\n\nJazakumullahu khairan,\nPanitia Daurah Duat dan Pegiat Dakwah",
    allowedVariables: ["ustadzName", "eventName", "participantCode", "cardLink", "rundownLink", "reviewNotice"],
  },
  PARTICIPANT_WITHDRAWN: {
    code: "PARTICIPANT_WITHDRAWN",
    subjectTemplate: "Pengunduran diri tercatat — {{eventName}}",
    bodyTemplate: "Assalamu’alaikum warahmatullahi wabarakatuh.\n\nYth. {{ustadzName}},\n\nPermintaan mengundurkan diri dari {{eventName}} telah tersimpan. Kode pendaftaran: {{participantCode}}. Tempat Ustadz dilepas dan QR sebelumnya tidak berlaku lagi.\n\nBila rencana berubah, hubungi panitia agar pendaftaran dapat ditinjau kembali.\n\nJazakumullahu khairan,\nPanitia Daurah Duat dan Pegiat Dakwah",
    allowedVariables: ["ustadzName", "eventName", "participantCode", "cardLink", "rundownLink", "reviewNotice"],
  },
  REGISTRATION_AUTO_APPROVED: {
    code: "REGISTRATION_AUTO_APPROVED",
    subjectTemplate: "Kartu peserta dan QR — {{eventName}}",
    bodyTemplate: "Pendaftaran Ustadz untuk {{eventName}} telah disetujui. Buka halaman status untuk melihat QR presensi pribadi: {{registrationStatusLink}}\n\nKode pendaftaran: {{participantCode}}\nRundown: {{rundownLink}}\nPortal Asatidz: {{portalLink}}\nJangan teruskan tautan pribadi ini.\n\nPanitia Daurah Duat dan Pegiat Dakwah",
    allowedVariables: ["ustadzName", "eventName", "participantCode", "registrationStatusLink", "cardLink", "email", "portalLink", "rundownLink"],
  },
  REGISTRATION_RECEIVED: {
    code: "REGISTRATION_RECEIVED",
    subjectTemplate: "Bukti pendaftaran — {{eventName}}",
    bodyTemplate: "Pendaftaran Ustadz untuk {{eventName}} sudah kami terima. Email ini adalah bukti penerimaan, bukan persetujuan panitia.\n\nKode pendaftaran: {{participantCode}}\nLihat status pendaftaran (tanpa login): {{registrationStatusLink}}\n\nQR presensi tidak terbit saat mendaftar. QR tersedia setelah panitia menyetujui pendaftaran dan Ustadz mengonfirmasi hadir jika diwajibkan.\n\nRundown: {{rundownLink}}\nPortal Asatidz: {{portalLink}}\nJangan teruskan tautan pribadi ini kepada orang lain.\n\nJazakumullahu khairan,\nPanitia Daurah Duat dan Pegiat Dakwah",
    allowedVariables: ["ustadzName", "eventName", "participantCode", "registrationStatusLink", "cardLink", "rundownLink", "portalLink", "confirmationInstruction"],
  },
  ANNOUNCEMENT: {
    code: "ANNOUNCEMENT",
    subjectTemplate: "Pengumuman {{eventName}}: {{title}}",
    bodyTemplate: "Assalamu'alaikum Warahmatullah Wabarakatuh,\n\nYth. {{ustadzName}},\n\n{{title}}\n\n{{body}}\n\nLihat juga pada Portal Asatidz: {{portalLink}}\n\nPanitia Daurah Duat dan Pegiat Dakwah",
    allowedVariables: ["ustadzName", "eventName", "title", "body", "portalLink"],
  },
  EVENT_CONTINUATION_REMINDER: {
    code: "EVENT_CONTINUATION_REMINDER",
    subjectTemplate: "Pengingat agenda berikutnya — {{eventName}}",
    bodyTemplate: "Assalamu'alaikum Warahmatullah Wabarakatuh,\n\nYth. {{ustadzName}},\n\nTerima kasih telah hadir pada hari acara sebelumnya. Agenda berikutnya untuk {{eventName}} berlangsung pada {{nextDate}}. Lokasi: {{eventVenue}}. Kode peserta pribadi: {{participantCode}}.\n\nLihat jadwal dan QR pribadi di {{portalLink}}. Kehadiran dicatat per individu pada setiap hari acara.\n\nPanitia Daurah Duat dan Pegiat Dakwah",
    allowedVariables: ["ustadzName", "eventName", "nextDate", "eventVenue", "participantCode", "portalLink"],
  },
  INVITATION_INSTITUTION: {
    code: "INVITATION_INSTITUTION",
    subjectTemplate: "Undangan Resmi Daurah Duat dan Pegiat Dakwah - {{institutionName}} (No: {{invitationNumber}})",
    bodyTemplate:
      "Assalamu'alaikum Warahmatullah Wabarakatuh,\n\nKepada Perwakilan {{institutionName}},\n\nKami mengundang {{institutionName}} untuk mengirimkan {{quota}} delegasi Asatidz pada kegiatan {{eventName}} yang akan diselenggarakan pada {{eventDates}}.\n\nSilakan konfirmasikan kehadiran dan isi data delegasi melalui tautan berikut:\n{{invitationLink}}\n\nJazakumullah Khairan,\nPanitia Daurah Duat dan Pegiat Dakwah",
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
      "Assalamu'alaikum Warahmatullah Wabarakatuh,\n\nKepada Yth. {{ustadzName}},\n\nKami mengundang Ustadz untuk hadir pada kegiatan {{eventName}} yang akan dilaksanakan pada {{eventDates}}.\n\nSilakan konfirmasikan kehadiran Ustadz melalui tautan berikut:\n{{invitationLink}}\n\nJazakumullah Khairan,\nPanitia Daurah Duat dan Pegiat Dakwah",
    allowedVariables: ["ustadzName", "eventName", "eventDates", "invitationLink", "participantCode", "qrCodeUrl", "eventVenue"],
  },
  REGISTRATION_CONFIRMED: {
    code: "REGISTRATION_CONFIRMED",
    subjectTemplate: "✅ Bukti Pendaftaran Daurah - Kode Peserta: {{participantCode}}",
    bodyTemplate:
      "Data pendaftaran Ustadz untuk {{eventName}} telah tersimpan.\nKode pendaftaran: {{participantCode}}\nLihat status pribadi: {{registrationStatusLink}}\n\nJazakumullahu khairan,\nPanitia Daurah Duat dan Pegiat Dakwah",
    allowedVariables: ["ustadzName", "eventName", "eventDates", "eventVenue", "participantCode", "registrationStatusLink", "qrCodeUrl"],
  },
  OTP_CODE: {
    code: "OTP_CODE",
    subjectTemplate: "Kode verifikasi Daurah Duat dan Pegiat Dakwah: {{otpCode}}",
    bodyTemplate:
      "Kode OTP untuk verifikasi Daurah Duat dan Pegiat Dakwah Anda adalah:\n\n{{otpCode}}\n\nKode ini berlaku selama {{expiresMinutes}} menit. Jangan bagikan kode ini kepada siapa pun.",
    allowedVariables: ["otpCode", "expiresMinutes"],
  },
  THANK_YOU_CONFIRMED: {
    code: "THANK_YOU_CONFIRMED",
    subjectTemplate: "🤝 Terima Kasih atas Konfirmasi Kehadiran - {{eventName}}",
    bodyTemplate:
      "Assalamu'alaikum Warahmatullah Wabarakatuh,\n\nKepada Yth. {{recipientName}},\n\nTerima kasih telah melakukan konfirmasi kehadiran resmi untuk kegiatan {{eventName}}.\nKode Peserta Ustadz adalah: {{participantCode}}\n\nJazakumullah Khairan,\nPanitia Daurah Duat dan Pegiat Dakwah",
    allowedVariables: ["recipientName", "eventName", "eventDates", "participantCode"],
  },
  THANK_YOU_ATTENDED: {
    code: "THANK_YOU_ATTENDED",
    subjectTemplate: "🌿 Jazakumullah Khairan atas Kehadiran Ustadz pada Daurah - {{eventName}}",
    bodyTemplate:
      "Assalamu'alaikum Warahmatullah Wabarakatuh,\n\nKepada Yth. {{recipientName}},\n\nJazakumullah Khairan atas kehadiran dan partisipasi aktif Ustadz pada kegiatan {{eventName}}.\nSemoga ilmu dan silaturahmi yang terjalin memberikan keberkahan bagi dakwah kita bersama.\n\nPanitia Daurah Duat dan Pegiat Dakwah",
    allowedVariables: ["recipientName", "eventName"],
  },
  EVENT_REMINDER: {
    code: "EVENT_REMINDER",
    subjectTemplate: "📅 Pengingat: {{eventName}} — {{daysRemaining}} Hari Lagi",
    bodyTemplate:
      "Assalamu'alaikum Warahmatullah Wabarakatuh,\n\nKepada Yth. {{ustadzName}},\n\nIni adalah pengingat bahwa kegiatan {{eventName}} akan dilaksanakan pada {{eventDates}}.\nKode Peserta Anda: {{participantCode}}\n\nSemoga Allah memudahkan perjalanan Ustadz.\n\nPanitia Daurah Duat dan Pegiat Dakwah",
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
  variables: Record<string, any>,
  copy: TransactionalEmailCopy = DEFAULT_TRANSACTIONAL_EMAIL_COPY,
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
  let body = templateCode === "OTP_CODE" ? tpl.bodyTemplate : stripLegacyEmailGreeting(tpl.bodyTemplate);

  const substitute = (value: string) => value.replace(/{{\s*(\w+)\s*}}/g, (_, key: string) =>
    tpl.allowedVariables.includes(key) ? String(variables[key] ?? "") : "");
  subject = substitute(subject);
  body = substitute(body);

  const opening = transactionalEmailOpening(templateCode, variables, copy);
  return { subject, body: opening ? `${opening}\n\n${body}` : body };
}

/**
 * Render template sebagai HTML premium (menggunakan emailHtmlTemplates.ts).
 * Digunakan oleh emailQueueService untuk pengiriman email nyata.
 */
export function renderHtmlEmailTemplate(
  templateCode: string,
  variables: Record<string, any>,
  copy: TransactionalEmailCopy = DEFAULT_TRANSACTIONAL_EMAIL_COPY,
): { subject: string; htmlBody: string; textBody: string } {
  // Validasi template dan hasilkan subject + plain text
  const { subject, body: textBody } = renderEmailTemplate(templateCode, variables, copy);

  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
  const safeVariables = Object.fromEntries(Object.entries(variables).map(([key, value]) => [key, escapeHtml(String(value ?? ""))]));
  const statusLink = String(variables.registrationStatusLink || "");
  const invitationLink = String(variables.invitationLink || "");
  const portalLink = String(variables.portalLink || "");
  const primaryLink = statusLink || invitationLink || portalLink || undefined;
  const primaryLabel = templateCode === "REGISTRATION_STATUS_ACCESS" ? "Buka akses pribadi"
    : templateCode === "REGISTRATION_CONFIRMATION_REQUEST" ? "Lihat status & akses"
    : ["REGISTRATION_AUTO_APPROVED", "REGISTRATION_APPROVED"].includes(templateCode) && statusLink ? "Lihat status pendaftaran"
      : statusLink ? "Lihat status pendaftaran" : invitationLink ? "Buka undangan pribadi" : "Buka Portal Asatidz";
  const htmlBody = templateCode !== "OTP_CODE"
    ? renderBrandedTextEmailHtml(textBody, "Daurah Duat dan Pegiat Dakwah", primaryLink, primaryLabel, undefined,
      undefined, copy.openingArabic)
    : renderHtmlByTemplateCode(templateCode, safeVariables);

  return { subject, htmlBody, textBody };
}
