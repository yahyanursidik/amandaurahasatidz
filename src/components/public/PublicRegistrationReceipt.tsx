/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V4
 * genre: modern-minimal · tone: calm-warm · macrostructure: Narrative Workflow · design-system: design.md
 * audience: asatidz senior dan kepala rombongan · use: temukan akses, rundown, lalu simpan QR
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, KeyRound, MessageCircle, UsersRound } from "lucide-react";
import { ParticipantQrCard } from "@/components/public/ParticipantQrCard";
import { publicRundownPath, registrationAttendanceWhatsAppUrl, type ReceiptParticipant } from "@/lib/publicRegistrationReceipt";
import { buildEventWhatsAppUrl } from "@/lib/eventWhatsApp";

type ReceiptProps = {
  event: { name: string; slug?: string; publicContactWhatsapp?: string | null; attendanceConfirmationRequired?: boolean };
  participants: ReceiptParticipant[];
  emailQueued: number;
  approvalStatus?: string;
};

export function PublicRegistrationReceipt({ event, participants, emailQueued, approvalStatus = "PENDING_REVIEW" }: ReceiptProps) {
  const [selectedCode, setSelectedCode] = useState(participants[0]?.participantCode || "");
  const [copyStatus, setCopyStatus] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const selected = participants.find((person) => person.participantCode === selectedCode) || participants[0];
  if (!selected) return null;
  const isGroup = participants.length > 1;
  const approved = approvalStatus === "APPROVED";
  const needsActivation = selected.passwordSetupRequired || Boolean(selected.temporaryPasswordIssued && !selected.temporaryPassword);
  const confirmationShareUrl = isGroup && selected.confirmationUrl && selected.whatsapp
    ? buildEventWhatsAppUrl([
      "Assalamu’alaikum warahmatullahi wabarakatuh.", "",
      `Ustadz ${selected.fullName}, pendaftaran ${event.name} telah tersimpan dengan kode ${selected.participantCode}.`,
      "1. Status & konfirmasi pribadi (setelah disetujui admin, tanpa login):",
      new URL(selected.confirmationUrl, window.location.origin).toString(), "",
      "2. Bukti QR pendaftaran (aktif untuk presensi setelah disetujui dan memilih hadir):",
      new URL(selected.cardUrl, window.location.origin).toString(), "",
      "Kedua tautan ini khusus untuk Ustadz. Jazakumullahu khairan.",
    ].join("\n"), selected.whatsapp) : null;

  const copyPassword = async () => {
    if (!selected.temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(selected.temporaryPassword);
      setCopyStatus("Sandi disalin. Berikan hanya kepada peserta yang bersangkutan.");
    } catch {
      setCopyStatus("Sandi belum dapat disalin. Tekan lama teks sandi untuk menyalinnya.");
    }
  };

  const copyConfirmationLink = async () => {
    if (!selected.confirmationUrl) return;
    try { await navigator.clipboard.writeText(new URL(selected.confirmationUrl, window.location.origin).toString()); setLinkCopied(true); }
    catch { setLinkCopied(false); }
  };

  return <section className="public-receipt" aria-labelledby="public-receipt-title">
    <header className="public-receipt__header">
      <CheckCircle2 aria-hidden="true" />
      <div>
        <h2 id="public-receipt-title">Pendaftaran tersimpan</h2>
        <p>{isGroup ? `${participants.length} asatidz telah didaftarkan. Pilih nama untuk melihat akses dan bukti masing-masing.` : "Data dan bukti pendaftaran pribadi sudah tersimpan."}</p>
      </div>
    </header>

    {!approved && <p className="public-receipt__notice" role="status"><strong>Saat mendaftar: menunggu persetujuan admin.</strong> QR belum dapat dipakai untuk absensi. Lihat status terbaru melalui tautan pribadi di bawah.</p>}
    {selected.confirmationUrl && <div className="public-receipt__confirmation" role="status">
      <Clock3 aria-hidden="true" /><div><strong>Langkah setelah disetujui</strong>
        <p>Pilih hadir atau berhalangan lewat tautan ini. Jika rencana berubah, bisa mengundurkan diri sebelum presensi. Tidak perlu login. {isGroup ? "Tiap asatidz punya tautan sendiri." : ""}</p>
        <div className="public-receipt__confirmation-actions">
          <Link to={selected.confirmationUrl}>Lihat status & konfirmasi <ArrowRight aria-hidden="true" /></Link>
          <button type="button" onClick={() => void copyConfirmationLink()}>{linkCopied ? "Tautan tersalin" : "Salin tautan"}</button>
          {confirmationShareUrl && <a href={confirmationShareUrl} target="_blank" rel="noopener noreferrer">Kirim ke WhatsApp peserta</a>}
        </div>
        {isGroup && confirmationShareUrl && <p className="public-receipt__confirmation-note">Tujuan: {selected.whatsapp}. Pastikan nomor ini milik {selected.fullName} sebelum mengirim.</p>}
      </div>
    </div>}
    {emailQueued < participants.length && <p className="public-receipt__notice" role="status">Email informasi mungkin belum terkirim. Simpan bukti pendaftaran sekarang; data tetap tersimpan.</p>}

    {isGroup && <label className="public-receipt__select" htmlFor="receipt-person">
      <span><UsersRound aria-hidden="true" /> Pilih peserta</span>
      <select id="receipt-person" value={selected.participantCode} onChange={(event) => { setSelectedCode(event.target.value); setCopyStatus(""); setLinkCopied(false); }}>
        {participants.map((person) => <option key={person.participantCode} value={person.participantCode}>{person.fullName} · {person.participantCode}</option>)}
      </select>
    </label>}

    <nav className="public-receipt__shortcuts" aria-label="Tautan bukti pendaftaran">
      <Link to={event.slug ? publicRundownPath(event.slug) : "/programs"}><CalendarDays aria-hidden="true" /> {event.slug ? "Rundown" : "Program"}</Link>
      <a href="#akses-portal"><KeyRound aria-hidden="true" /> Akses portal</a>
      <a href="#kartu-qr"><CheckCircle2 aria-hidden="true" /> Kartu QR</a>
    </nav>

    <div className="public-receipt__layout">
      <div className="public-receipt__next">
        <div className="public-receipt__access" id="akses-portal">
          <KeyRound aria-hidden="true" />
          <h3>Akses Portal Asatidz</h3>
          <dl>
            <dt>Username (email) untuk {selected.fullName}</dt><dd>{selected.email}</dd>
            <dt>{selected.temporaryPassword ? "Password awal" : "Password"}</dt>
            <dd>{selected.temporaryPassword
              ? <code className="public-receipt__password">{selected.temporaryPassword}</code>
              : needsActivation ? "Buat sandi baru dengan kode dari email pribadi."
                : "Gunakan sandi akun yang sudah dimiliki."}</dd>
          </dl>
          {selected.temporaryPassword && <div className="public-receipt__credential-tools">
            <button type="button" onClick={() => void copyPassword()}>Salin sandi</button>
            <p>Password awal hanya tampil sekarang. Simpan secara pribadi.</p>
          </div>}
          {copyStatus && <p className="public-receipt__copy-status" role="status">{copyStatus}</p>}
          {selected.temporaryPasswordIssued && !selected.temporaryPassword && <p className="public-receipt__recovery">Password awal tidak tersimpan setelah halaman dimuat ulang. Buat sandi baru lewat email.</p>}
          <Link to={needsActivation ? "/login/ustadz#ustadz-activation-panel" : "/login/ustadz"} state={{ prefillEmail: selected.email, openActivation: needsActivation }}>
            {needsActivation ? "Buat sandi & masuk" : "Masuk ke portal"} <ArrowRight aria-hidden="true" />
          </Link>
          {isGroup && <p>Setiap asatidz memakai akses pribadi. Pilih nama di atas untuk melihat kartu dan petunjuk masing-masing.</p>}
        </div>
        <div className="public-receipt__actions">
          <a href={registrationAttendanceWhatsAppUrl(event.name, participants, event.publicContactWhatsapp)} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" /><strong>{event.publicContactWhatsapp ? "Kabari panitia" : "Buka draf WhatsApp"}</strong><ArrowRight aria-hidden="true" /></a>
          <p>{event.publicContactWhatsapp ? "Draf WhatsApp ke kontak panitia event." : "Nomor panitia belum tersedia; pilih kontak tujuan sendiri."} Pesan ini tidak mencatat presensi.</p>
        </div>
      </div>
      <div className="public-receipt__card-column" id="kartu-qr">
        <h3>Kartu QR {isGroup ? selected.fullName : "pribadi"}</h3>
        <p className="public-receipt__card-intro">{approved ? "Simpan kartu ini. Tunjukkan QR saat presensi di lokasi acara." : "Simpan sebagai bukti pendaftaran. Periksa status terbaru melalui tautan pribadi. QR berlaku untuk presensi setelah admin menyetujui dan Ustadz mengonfirmasi kehadiran."}</p>
        <ParticipantQrCard key={selected.participantCode} eventName={event.name} person={selected} approvalStatus={approvalStatus} confirmationStatus={event.attendanceConfirmationRequired === false ? "CONFIRMED" : "INVITED"} showShareActions={isGroup} />
        {isGroup && <p className="public-receipt__group-note">Pilih nama berikutnya untuk menyimpan atau membagikan kartu miliknya. Berikan QR hanya kepada peserta yang bersangkutan.</p>}
      </div>
    </div>
  </section>;
}
