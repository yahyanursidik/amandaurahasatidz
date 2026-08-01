/**
 * emailHtmlTemplates.ts
 * Template email HTML premium dengan branding Daurah Asatidz YTS.
 * Inline CSS untuk kompatibilitas maksimal (Gmail, Outlook, Apple Mail).
 * Mobile responsive dengan max-width 600px.
 */

// ─── Shared Styles & Layout ────────────────────────────────────────────────────

const BRAND_PRIMARY = "#1a472a";       // Hijau tua (primary)
const BRAND_SECONDARY = "#2d6a4f";    // Hijau medium
const BRAND_ACCENT = "#d4a017";       // Emas / kuning khas Islamic
const BRAND_LIGHT = "#f0f7f4";        // Latar hijau muda
const BRAND_TEXT = "#2c3e2d";         // Teks gelap

function wrapHtmlLayout(title: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:20px 10px;">

        <!-- Container -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.10);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND_PRIMARY} 0%,${BRAND_SECONDARY} 100%);padding:32px 40px;text-align:center;">
              <p style="margin:0 0 8px 0;font-size:11px;letter-spacing:3px;color:#a8d5b5;text-transform:uppercase;font-weight:600;">بسم الله الرحمن الرحيم</p>
              <h1 style="margin:0 0 4px 0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">Daurah Asatidz</h1>
              <p style="margin:0;font-size:13px;color:#a8d5b5;font-weight:400;">Yayasan Tarbiyah Sunnah</p>
              <div style="margin:16px auto 0;width:40px;height:3px;background-color:${BRAND_ACCENT};border-radius:2px;"></div>
            </td>
          </tr>

          <!-- Body Content -->
          ${bodyContent}

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8faf8;border-top:1px solid #e8f0e8;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 6px 0;font-size:13px;color:#5a6b5c;font-weight:600;">Radio Tarbiyah Sunnah</p>
              <p style="margin:0 0 4px 0;font-size:12px;color:#8a9b8a;">no-reply@radiotarbiyahsunnah.com</p>
              <p style="margin:12px 0 0 0;font-size:11px;color:#aaaaaa;line-height:1.5;">
                Email ini dikirim secara otomatis oleh sistem. Mohon tidak membalas email ini.<br/>
                &copy; ${new Date().getFullYear()} Yayasan Tarbiyah Sunnah. Hak Cipta Dilindungi.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Container -->

      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Utility: Info Badge ──────────────────────────────────────────────────────

function infoBadge(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="width:140px;font-size:12px;color:#8a9b8a;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;padding:8px 12px 8px 0;">${label}</td>
          <td style="font-size:14px;color:${BRAND_TEXT};font-weight:600;border-left:2px solid #e8f0e8;padding:8px 0 8px 12px;">${value}</td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function ctaButton(text: string, url: string): string {
  return `<tr>
    <td align="center" style="padding:24px 0 8px;">
      <a href="${url}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,${BRAND_PRIMARY},${BRAND_SECONDARY});color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:0.5px;box-shadow:0 4px 12px rgba(26,71,42,0.3);">${text}</a>
    </td>
  </tr>`;
}

function qrCodeBadge(qrUrl: string, code: string): string {
  return `<tr>
    <td align="center" style="padding:20px 0;">
      <div style="display:inline-block;background-color:${BRAND_LIGHT};border:2px dashed #a8d5b5;border-radius:12px;padding:20px 32px;text-align:center;">
        <p style="margin:0 0 8px 0;font-size:11px;color:#8a9b8a;text-transform:uppercase;letter-spacing:1px;font-weight:600;">QR Code Presensi</p>
        <div style="background:#ffffff;border-radius:8px;padding:12px;display:inline-block;margin-bottom:12px;">
          <img src="${qrUrl}" alt="QR Code Presensi" width="140" height="140" style="display:block;border:0;" />
        </div>
        <p style="margin:0;font-size:16px;font-weight:700;color:${BRAND_PRIMARY};letter-spacing:2px;font-family:monospace;">${code}</p>
        <p style="margin:4px 0 0;font-size:11px;color:#8a9b8a;">Kode Fallback Manual</p>
      </div>
    </td>
  </tr>`;
}

// ─── Template 1: Undangan Lembaga ─────────────────────────────────────────────

export function renderInvitationInstitutionHtml(vars: {
  institutionName: string;
  invitationNumber: string;
  eventName: string;
  eventDates: string;
  quota: string | number;
  invitationLink: string;
}): string {
  const body = `
  <tr>
    <td style="padding:36px 40px 20px;">
      <p style="margin:0 0 16px;font-size:13px;color:#8a9b8a;font-style:italic;">Assalamu'alaikum Warahmatullah Wabarakatuh,</p>
      <h2 style="margin:0 0 8px;font-size:20px;color:${BRAND_PRIMARY};font-weight:700;">Undangan Resmi Delegasi Asatidz</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#5a6b5c;line-height:1.6;">
        Dengan hormat, kami mengundang <strong>${vars.institutionName}</strong> untuk mengirimkan delegasi Asatidz terbaik pada kegiatan daurah ilmiah berikut:
      </p>

      <!-- Info Card -->
      <div style="background-color:${BRAND_LIGHT};border-left:4px solid ${BRAND_PRIMARY};border-radius:0 8px 8px 0;padding:20px 24px;margin-bottom:24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          ${infoBadge("No. Undangan", vars.invitationNumber)}
          ${infoBadge("Nama Lembaga", vars.institutionName)}
          ${infoBadge("Nama Kegiatan", vars.eventName)}
          ${infoBadge("Tanggal Pelaksanaan", vars.eventDates)}
          ${infoBadge("Kuota Delegasi", `${vars.quota} Ustadz`)}
        </table>
      </div>

      <p style="margin:0 0 8px;font-size:14px;color:${BRAND_TEXT};line-height:1.6;">
        Silakan konfirmasikan kehadiran dan isi data delegasi Ustadz melalui tautan berikut:
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        ${ctaButton("Konfirmasi Kehadiran →", vars.invitationLink)}
      </table>

      <p style="margin:16px 0 0;font-size:12px;color:#aaaaaa;text-align:center;">
        Atau salin tautan: <span style="color:${BRAND_SECONDARY};">${vars.invitationLink}</span>
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding:0 40px 32px;">
      <p style="margin:0;font-size:13px;color:#5a6b5c;line-height:1.7;">
        Jazakumullah Khairan atas perhatian dan kerjasama Bapak/Ibu.<br/>
        <strong style="color:${BRAND_PRIMARY};">Panitia Daurah YTS</strong>
      </p>
    </td>
  </tr>`;

  return wrapHtmlLayout(`Undangan Daurah — ${vars.institutionName}`, body);
}

// ─── Template 2: Bukti Pendaftaran / Konfirmasi Peserta ───────────────────────

export function renderRegistrationConfirmedHtml(vars: {
  ustadzName: string;
  eventName: string;
  eventDates: string;
  eventVenue?: string;
  participantCode: string;
  qrCodeUrl: string;
}): string {
  const body = `
  <tr>
    <td style="padding:36px 40px 20px;">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="display:inline-block;background-color:#d4edda;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:28px;text-align:center;">✅</div>
        <h2 style="margin:12px 0 4px;font-size:20px;color:${BRAND_PRIMARY};font-weight:700;">Pendaftaran Berhasil</h2>
        <p style="margin:0;font-size:13px;color:#8a9b8a;">Bukti Keikutsertaan Resmi</p>
      </div>

      <p style="margin:0 0 20px;font-size:14px;color:${BRAND_TEXT};line-height:1.6;">
        Assalamu'alaikum Warahmatullah Wabarakatuh,<br/><br/>
        Alhamdulillah, pendaftaran <strong>${vars.ustadzName}</strong> sebagai peserta resmi pada kegiatan di bawah ini telah berhasil dikonfirmasi.
      </p>

      <!-- Info Card -->
      <div style="background-color:${BRAND_LIGHT};border-left:4px solid ${BRAND_ACCENT};border-radius:0 8px 8px 0;padding:20px 24px;margin-bottom:24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          ${infoBadge("Nama Ustadz", vars.ustadzName)}
          ${infoBadge("Kode Peserta", `<span style="font-family:monospace;font-size:16px;color:${BRAND_PRIMARY};font-weight:700;">${vars.participantCode}</span>`)}
          ${infoBadge("Nama Kegiatan", vars.eventName)}
          ${infoBadge("Tanggal", vars.eventDates)}
          ${vars.eventVenue ? infoBadge("Lokasi", vars.eventVenue) : ""}
        </table>
      </div>

      <!-- QR Code Section -->
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        ${qrCodeBadge(vars.qrCodeUrl, vars.participantCode)}
      </table>

      <div style="background-color:#fff8e1;border:1px solid #ffe082;border-radius:8px;padding:14px 20px;margin:16px 0 24px;">
        <p style="margin:0;font-size:13px;color:#856404;line-height:1.6;">
          <strong>📌 Petunjuk:</strong> Tunjukkan QR Code ini kepada petugas saat check-in di lokasi acara. Simpan email ini sebagai bukti pendaftaran resmi.
        </p>
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:0 40px 32px;">
      <p style="margin:0;font-size:13px;color:#5a6b5c;line-height:1.7;">
        Jazakumullah Khairan. Semoga kegiatan ini memberikan keberkahan dan manfaat yang besar.<br/>
        <strong style="color:${BRAND_PRIMARY};">Panitia Daurah YTS</strong>
      </p>
    </td>
  </tr>`;

  return wrapHtmlLayout(`Bukti Pendaftaran — ${vars.participantCode}`, body);
}

// ─── Template 3: Ucapan Terima Kasih (Konfirmasi Hadir) ──────────────────────

export function renderThankYouConfirmedHtml(vars: {
  recipientName: string;
  eventName: string;
  eventDates: string;
  participantCode: string;
}): string {
  const body = `
  <tr>
    <td style="padding:36px 40px 20px;">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="display:inline-block;font-size:40px;">🤝</div>
        <h2 style="margin:12px 0 4px;font-size:20px;color:${BRAND_PRIMARY};font-weight:700;">Terima Kasih atas Konfirmasi Kehadiran</h2>
      </div>

      <p style="margin:0 0 20px;font-size:14px;color:${BRAND_TEXT};line-height:1.6;">
        Assalamu'alaikum Warahmatullah Wabarakatuh,<br/><br/>
        Terima kasih, <strong>${vars.recipientName}</strong>. Konfirmasi kehadiran Ustadz untuk kegiatan <strong>${vars.eventName}</strong> telah kami terima dan tercatat dalam sistem.
      </p>

      <!-- Info Card -->
      <div style="background-color:${BRAND_LIGHT};border-left:4px solid ${BRAND_PRIMARY};border-radius:0 8px 8px 0;padding:20px 24px;margin-bottom:24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          ${infoBadge("Nama Peserta", vars.recipientName)}
          ${infoBadge("Kode Peserta", `<span style="font-family:monospace;color:${BRAND_PRIMARY};font-weight:700;">${vars.participantCode}</span>`)}
          ${infoBadge("Kegiatan", vars.eventName)}
          ${infoBadge("Tanggal", vars.eventDates)}
        </table>
      </div>

      <p style="margin:0 0 8px;font-size:14px;color:${BRAND_TEXT};line-height:1.6;">
        Kami menantikan kehadiran Ustadz di lokasi acara. Informasi teknis lebih lanjut akan dikirimkan mendekati hari pelaksanaan.
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding:0 40px 32px;">
      <p style="margin:0;font-size:13px;color:#5a6b5c;line-height:1.7;">
        Jazakumullah Khairan atas komitmen dan semangat Ustadz dalam menuntut ilmu.<br/>
        <strong style="color:${BRAND_PRIMARY};">Panitia Daurah YTS</strong>
      </p>
    </td>
  </tr>`;

  return wrapHtmlLayout(`Terima Kasih Konfirmasi — ${vars.recipientName}`, body);
}

// ─── Template 4: Ucapan Terima Kasih Pasca Kehadiran ─────────────────────────

export function renderThankYouAttendedHtml(vars: {
  recipientName: string;
  eventName: string;
}): string {
  const body = `
  <tr>
    <td style="padding:36px 40px 20px;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-size:48px;line-height:1;">🌿</div>
        <h2 style="margin:12px 0 4px;font-size:22px;color:${BRAND_PRIMARY};font-weight:700;">جَزَاكُمُ اللهُ خَيْرًا</h2>
        <p style="margin:0;font-size:14px;color:#8a9b8a;font-style:italic;">Jazakumullah Khairan atas Kehadiran Ustadz</p>
      </div>

      <p style="margin:0 0 20px;font-size:14px;color:${BRAND_TEXT};line-height:1.7;">
        Assalamu'alaikum Warahmatullah Wabarakatuh,<br/><br/>
        Alhamdulillah, kegiatan <strong>${vars.eventName}</strong> telah berjalan dengan lancar atas izin Allah Ta'ala. Kami mengucapkan <em>Jazakumullah Khairan</em> yang sebesar-besarnya kepada <strong>${vars.recipientName}</strong> atas kehadiran dan partisipasi aktif Ustadz.
      </p>

      <div style="background:linear-gradient(135deg,${BRAND_PRIMARY},${BRAND_SECONDARY});border-radius:12px;padding:24px 28px;margin:20px 0;text-align:center;">
        <p style="margin:0;font-size:15px;color:#a8d5b5;font-style:italic;line-height:1.7;">
          "طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ"<br/>
          <span style="font-size:13px;color:#d4edda;">"Menuntut ilmu adalah kewajiban bagi setiap Muslim."</span>
        </p>
      </div>

      <p style="margin:20px 0 0;font-size:14px;color:${BRAND_TEXT};line-height:1.7;">
        Semoga ilmu yang telah diperoleh dan silaturahmi yang telah terjalin pada <strong>${vars.eventName}</strong> memberikan keberkahan yang besar bagi dakwah kita bersama. Kami berharap dapat berjumpa kembali pada kegiatan-kegiatan mendatang, insya Allah.
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding:8px 40px 32px;">
      <p style="margin:0;font-size:13px;color:#5a6b5c;line-height:1.7;">
        Wassalamu'alaikum Warahmatullah Wabarakatuh,<br/>
        <strong style="color:${BRAND_PRIMARY};">Panitia Daurah YTS — Radio Tarbiyah Sunnah</strong>
      </p>
    </td>
  </tr>`;

  return wrapHtmlLayout(`Jazakumullah Khairan — ${vars.eventName}`, body);
}

// ─── Template 5: Reminder Kehadiran ──────────────────────────────────────────

export function renderEventReminderHtml(vars: {
  ustadzName: string;
  eventName: string;
  eventDates: string;
  eventVenue?: string;
  participantCode: string;
  daysRemaining: string | number;
  portalLink?: string;
}): string {
  const daysNum = Number(vars.daysRemaining);
  let urgencyColor = "#2d6a4f";
  let urgencyText = `${vars.daysRemaining} Hari Lagi`;
  let urgencyIcon = "📅";

  if (daysNum <= 1) {
    urgencyColor = "#c0392b";
    urgencyText = "BESOK! Segera Bersiap";
    urgencyIcon = "🔴";
  } else if (daysNum <= 3) {
    urgencyColor = "#e67e22";
    urgencyText = `${vars.daysRemaining} Hari Lagi — Segera Siapkan Diri`;
    urgencyIcon = "🟠";
  }

  const body = `
  <tr>
    <td style="padding:36px 40px 20px;">
      <!-- Countdown Badge -->
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;background-color:${urgencyColor};color:#ffffff;font-size:13px;font-weight:700;padding:8px 24px;border-radius:20px;letter-spacing:1px;text-transform:uppercase;">
          ${urgencyIcon} ${urgencyText}
        </div>
      </div>

      <h2 style="margin:0 0 4px;font-size:20px;color:${BRAND_PRIMARY};font-weight:700;text-align:center;">Pengingat Kehadiran Daurah</h2>
      <p style="margin:0 0 24px;font-size:13px;color:#8a9b8a;text-align:center;">Kepada ${vars.ustadzName}</p>

      <p style="margin:0 0 20px;font-size:14px;color:${BRAND_TEXT};line-height:1.6;">
        Assalamu'alaikum Warahmatullah Wabarakatuh,<br/><br/>
        Kami mengingatkan bahwa kegiatan yang Ustadz telah daftarkan akan segera dilaksanakan. Jangan sampai terlewatkan!
      </p>

      <!-- Info Card -->
      <div style="background-color:${BRAND_LIGHT};border-left:4px solid ${BRAND_ACCENT};border-radius:0 8px 8px 0;padding:20px 24px;margin-bottom:24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          ${infoBadge("Nama Kegiatan", vars.eventName)}
          ${infoBadge("Tanggal", vars.eventDates)}
          ${vars.eventVenue ? infoBadge("Lokasi", vars.eventVenue) : ""}
          ${infoBadge("Kode Peserta", `<span style="font-family:monospace;font-weight:700;color:${BRAND_PRIMARY};">${vars.participantCode}</span>`)}
        </table>
      </div>

      <!-- Checklist -->
      <div style="background-color:#f8f8f8;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:${BRAND_TEXT};">✅ Checklist Persiapan:</p>
        <ul style="margin:0;padding:0 0 0 20px;font-size:13px;color:#5a6b5c;line-height:2.0;">
          <li>Simpan QR Code dan kode peserta Anda</li>
          <li>Konfirmasi kehadiran jika belum dilakukan</li>
          <li>Siapkan akomodasi dan transportasi ke lokasi</li>
          <li>Bawa identitas diri (KTP/SIM)</li>
        </ul>
      </div>

      ${vars.portalLink ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%">${ctaButton("Buka Portal Peserta →", vars.portalLink)}</table>` : ""}
    </td>
  </tr>
  <tr>
    <td style="padding:0 40px 32px;">
      <p style="margin:0;font-size:13px;color:#5a6b5c;line-height:1.7;">
        Baarakallahu fiikum. Semoga Allah memudahkan perjalanan dan memberikan keberkahan.<br/>
        <strong style="color:${BRAND_PRIMARY};">Panitia Daurah YTS</strong>
      </p>
    </td>
  </tr>`;

  return wrapHtmlLayout(`Pengingat: ${vars.eventName} — ${urgencyText}`, body);
}

// ─── Template 6: OTP Login ────────────────────────────────────────────────────

export function renderOtpCodeHtml(vars: {
  otpCode: string;
  expiresMinutes: string | number;
}): string {
  const body = `
  <tr>
    <td style="padding:36px 40px 20px;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-size:36px;">🔐</div>
        <h2 style="margin:12px 0 4px;font-size:20px;color:${BRAND_PRIMARY};font-weight:700;">Kode Verifikasi</h2>
        <p style="margin:0;font-size:13px;color:#8a9b8a;">Aman Daurah Asatidz</p>
      </div>

      <p style="margin:0 0 24px;font-size:14px;color:${BRAND_TEXT};line-height:1.6;text-align:center;">
        Gunakan kode OTP berikut untuk memverifikasi permintaan Anda. Kode akan kedaluwarsa dalam waktu singkat.
      </p>

      <!-- OTP Display -->
      <div style="text-align:center;margin:0 0 24px;">
        <div style="display:inline-block;background:linear-gradient(135deg,${BRAND_PRIMARY},${BRAND_SECONDARY});border-radius:12px;padding:20px 48px;">
          <p style="margin:0 0 4px;font-size:11px;color:#a8d5b5;text-transform:uppercase;letter-spacing:2px;">Kode OTP Anda</p>
          <p style="margin:0;font-size:38px;font-weight:700;color:#ffffff;letter-spacing:10px;font-family:monospace;">${vars.otpCode}</p>
        </div>
      </div>

      <!-- Expiry Notice -->
      <div style="background-color:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:12px 20px;margin-bottom:24px;text-align:center;">
        <p style="margin:0;font-size:13px;color:#664d03;">
          ⏰ Kode ini berlaku selama <strong>${vars.expiresMinutes} menit</strong> dan hanya dapat digunakan sekali.
        </p>
      </div>

      <div style="background-color:#fff8f8;border:1px solid #ffcccc;border-radius:8px;padding:12px 20px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#cc0000;">
          🚫 <strong>Jangan bagikan kode ini kepada siapapun.</strong> Tim YTS tidak pernah meminta kode OTP Anda.
        </p>
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:0 40px 32px;">
      <p style="margin:0;font-size:12px;color:#aaaaaa;text-align:center;line-height:1.5;">
        Jika Anda tidak meminta kode ini, abaikan email ini. Akun Anda tetap aman.
      </p>
    </td>
  </tr>`;

  return wrapHtmlLayout("Kode OTP — Daurah Asatidz YTS", body);
}

// ─── Dispatcher: render by template code ─────────────────────────────────────

export function renderHtmlByTemplateCode(
  templateCode: string,
  variables: Record<string, any>
): string {
  switch (templateCode) {
    case "INVITATION_INSTITUTION":
      return renderInvitationInstitutionHtml({
        institutionName: variables.institutionName || "",
        invitationNumber: variables.invitationNumber || "",
        eventName: variables.eventName || "",
        eventDates: variables.eventDates || "",
        quota: variables.quota || "",
        invitationLink: variables.invitationLink || "#",
      });

    case "INVITATION_INDIVIDUAL":
      // Render sebagai REGISTRATION_CONFIRMED style untuk individu
      return renderRegistrationConfirmedHtml({
        ustadzName: variables.ustadzName || "",
        eventName: variables.eventName || "",
        eventDates: variables.eventDates || "",
        eventVenue: variables.eventVenue,
        participantCode: variables.participantCode || "-",
        qrCodeUrl: variables.qrCodeUrl || "",
      });

    case "REGISTRATION_CONFIRMED":
      return renderRegistrationConfirmedHtml({
        ustadzName: variables.ustadzName || "",
        eventName: variables.eventName || "",
        eventDates: variables.eventDates || "",
        eventVenue: variables.eventVenue,
        participantCode: variables.participantCode || "",
        qrCodeUrl: variables.qrCodeUrl || "",
      });

    case "THANK_YOU_CONFIRMED":
      return renderThankYouConfirmedHtml({
        recipientName: variables.recipientName || "",
        eventName: variables.eventName || "",
        eventDates: variables.eventDates || "",
        participantCode: variables.participantCode || "",
      });

    case "THANK_YOU_ATTENDED":
      return renderThankYouAttendedHtml({
        recipientName: variables.recipientName || "",
        eventName: variables.eventName || "",
      });

    case "EVENT_REMINDER":
      return renderEventReminderHtml({
        ustadzName: variables.ustadzName || "",
        eventName: variables.eventName || "",
        eventDates: variables.eventDates || "",
        eventVenue: variables.eventVenue,
        participantCode: variables.participantCode || "",
        daysRemaining: variables.daysRemaining || 7,
        portalLink: variables.portalLink,
      });

    case "OTP_CODE":
      return renderOtpCodeHtml({
        otpCode: variables.otpCode || "",
        expiresMinutes: variables.expiresMinutes || 10,
      });

    default:
      // Fallback: plain text wrapper
      return wrapHtmlLayout("Notifikasi Daurah YTS", `
        <tr><td style="padding:40px;">
          <p style="font-size:14px;color:${BRAND_TEXT};line-height:1.7;">${variables.body || "Notifikasi dari Panitia Daurah YTS."}</p>
        </td></tr>`);
  }
}
