import { ValidationError } from "../utils/errors";
import { renderBrandedTextEmailHtml, renderHtmlByTemplateCode } from "./emailHtmlTemplates";

export interface TemplateDefinition {
  code: string;
  subjectTemplate: string;
  bodyTemplate: string;
  allowedVariables: string[];
}

export const TEMPLATE_WHITELISTS: Record<string, TemplateDefinition> = {
  REGISTRATION_APPROVED: {
    code: "REGISTRATION_APPROVED",
    subjectTemplate: "Pendaftaran disetujui — {{eventName}}",
    bodyTemplate: "Assalamu'alaikum {{ustadzName}},\n\nAlhamdulillah, pendaftaran Anda untuk {{eventName}} telah disetujui panitia. Kode pribadi: {{participantCode}}.\nSimpan kartu QR pribadi: {{cardLink}}\nLihat rundown terbaru: {{rundownLink}}\n\nUsername Portal Asatidz: {{email}}\nMasuk dengan sandi yang sudah dimiliki atau buat sandi melalui email: {{portalLink}}. Jangan membagikan QR atau sandi kepada pihak lain.\n\nPanitia Daurah Duat dan Pegiat Dakwah",
    allowedVariables: ["ustadzName", "eventName", "participantCode", "cardLink", "email", "portalLink", "rundownLink"],
  },
  REGISTRATION_CONFIRMATION_REQUEST: {
    code: "REGISTRATION_CONFIRMATION_REQUEST",
    subjectTemplate: "Pendaftaran disetujui — mohon konfirmasi hadir untuk {{eventName}}",
    bodyTemplate: "Assalamu’alaikum warahmatullahi wabarakatuh.\n\nYth. {{ustadzName}},\n\nAlhamdulillah, pendaftaran Ustadz untuk {{eventName}} telah disetujui admin. Mohon pilih kehadiran pribadi melalui tautan berikut; tidak perlu login:\n{{confirmationLink}}\n\nKode pendaftaran: {{participantCode}}. Setelah memilih ‘Insya Allah hadir’, kartu QR pribadi siap digunakan saat presensi di lokasi. Setiap hari acara tetap dipindai terpisah.\n\nRundown: {{rundownLink}}\nJangan bagikan tautan pribadi ini kepada orang lain.\n\nJazakumullahu khairan,\nPanitia Daurah Duat dan Pegiat Dakwah",
    allowedVariables: ["ustadzName", "eventName", "participantCode", "confirmationLink", "rundownLink"],
  },
  PARTICIPANT_ATTENDANCE_CONFIRMED: {
    code: "PARTICIPANT_ATTENDANCE_CONFIRMED",
    subjectTemplate: "Konfirmasi hadir tersimpan — {{eventName}}",
    bodyTemplate: "Assalamu’alaikum warahmatullahi wabarakatuh.\n\nYth. {{ustadzName}},\n\nKonfirmasi ‘Insya Allah hadir’ untuk {{eventName}} telah tersimpan. Kode pribadi: {{participantCode}}.\n{{reviewNotice}}\n{{cardInstruction}}\nRundown acara: {{rundownLink}}\n\nJika rencana berubah sebelum presensi, Ustadz dapat mengundurkan diri tanpa login melalui tautan pribadi ini: {{confirmationLink}}\n\nTunjukkan QR atau kode pribadi saat presensi pada setiap hari acara. Konfirmasi ini bukan absensi.\n\nJazakumullahu khairan,\nPanitia Daurah Duat dan Pegiat Dakwah",
    allowedVariables: ["ustadzName", "eventName", "participantCode", "cardLink", "cardInstruction", "confirmationLink", "rundownLink", "reviewNotice"],
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
    bodyTemplate: "Assalamu'alaikum {{ustadzName}},\n\nPendaftaran Anda untuk {{eventName}} telah tercatat. Kode pribadi: {{participantCode}}.\nSimpan kartu QR pribadi: {{cardLink}}\nLihat rundown terbaru: {{rundownLink}}\n\nUsername Portal Asatidz: {{email}}\nMasuk dengan sandi yang sudah dimiliki atau buat sandi pribadi melalui aktivasi email: {{portalLink}}. Jangan membagikan QR atau sandi kepada pihak lain.\n\nPanitia Daurah Duat dan Pegiat Dakwah",
    allowedVariables: ["ustadzName", "eventName", "participantCode", "cardLink", "email", "portalLink", "rundownLink"],
  },
  REGISTRATION_RECEIVED: {
    code: "REGISTRATION_RECEIVED",
    subjectTemplate: "Pendaftaran diterima untuk ditinjau — {{eventName}}",
    bodyTemplate: "Assalamu'alaikum Warahmatullah Wabarakatuh,\n\nYth. {{ustadzName}},\n\nPendaftaran Anda untuk {{eventName}} telah diterima dan sedang ditinjau panitia. Kode peserta pribadi: {{participantCode}}. Kode dan bukti QR ini belum berarti kursi disetujui dan belum dapat digunakan untuk absensi.\n\nSimpan bukti pendaftaran: {{cardLink}}\nLihat rundown: {{rundownLink}}\n{{confirmationInstruction}}\nAktivasi atau masuk akun pribadi di {{portalLink}} untuk memantau status. Jangan bagikan QR, tautan konfirmasi pribadi, kode masuk email, atau password kepada orang lain.\n\nJazakumullah khairan,\nPanitia Daurah Duat dan Pegiat Dakwah",
    allowedVariables: ["ustadzName", "eventName", "participantCode", "cardLink", "rundownLink", "portalLink", "confirmationInstruction"],
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
      "Assalamu'alaikum Warahmatullah Wabarakatuh,\n\nKepada Yth. {{ustadzName}},\n\nKonfirmasi keikutsertaan Ustadz pada {{eventName}} telah berhasil disimpan.\nKode Peserta Ustadz adalah: {{participantCode}}\n\nQR Code Registrasi:\n{{qrCodeUrl}}\n\nJazakumullah Khairan,\nPanitia Daurah Duat dan Pegiat Dakwah",
    allowedVariables: ["ustadzName", "eventName", "eventDates", "eventVenue", "participantCode", "qrCodeUrl"],
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

  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
  const safeVariables = Object.fromEntries(Object.entries(variables).map(([key, value]) => [key, escapeHtml(String(value ?? ""))]));
  const confirmationLink = String(variables.confirmationLink || "");
  const cardLink = String(variables.cardLink || "");
  const primaryLink = templateCode === "REGISTRATION_CONFIRMATION_REQUEST" ? confirmationLink
    : templateCode === "PARTICIPANT_ATTENDANCE_CONFIRMED" ? cardLink || confirmationLink
      : ["REGISTRATION_RECEIVED", "REGISTRATION_AUTO_APPROVED", "REGISTRATION_APPROVED"].includes(templateCode) ? cardLink : undefined;
  const primaryLabel = templateCode === "REGISTRATION_RECEIVED" ? "Buka bukti pendaftaran"
    : templateCode === "REGISTRATION_CONFIRMATION_REQUEST" ? "Konfirmasi kehadiran"
      : templateCode === "PARTICIPANT_ATTENDANCE_CONFIRMED" && !cardLink ? "Lihat status pribadi" : "Buka kartu QR pribadi";
  const htmlBody = ["ANNOUNCEMENT", "REGISTRATION_RECEIVED", "EVENT_CONTINUATION_REMINDER", "REGISTRATION_AUTO_APPROVED", "REGISTRATION_APPROVED",
    "REGISTRATION_CONFIRMATION_REQUEST", "PARTICIPANT_ATTENDANCE_CONFIRMED", "PARTICIPANT_ATTENDANCE_DECLINED", "PARTICIPANT_WITHDRAWN"].includes(templateCode)
    ? renderBrandedTextEmailHtml(textBody, "Daurah Duat dan Pegiat Dakwah", primaryLink, primaryLabel,
      templateCode === "PARTICIPANT_ATTENDANCE_CONFIRMED" && cardLink ? confirmationLink : undefined,
      "Status & pengunduran diri")
    : renderHtmlByTemplateCode(templateCode, safeVariables);

  return { subject, htmlBody, textBody };
}
