/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V4
 * genre: modern-minimal · tone: calm-warm · macrostructure: Narrative Workflow · design-system: design.md
 * audience: asatidz senior dan kepala rombongan · use: simpan bukti dan pantau keputusan panitia
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, KeyRound, MessageCircle, UsersRound } from "lucide-react";
import { ParticipantQrCard } from "@/components/public/ParticipantQrCard";
import { publicRundownPath, registrationAttendanceWhatsAppUrl, type ReceiptParticipant } from "@/lib/publicRegistrationReceipt";
import { buildEventWhatsAppUrl } from "@/lib/eventWhatsApp";
import { registrationStage, registrationStageCopy } from "@/lib/registrationStatus";
import { registrationStatusHref } from "@/lib/registrationStatusLink";

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
  const confirmationRequired = event.attendanceConfirmationRequired !== false;
  const personApproval = selected.approvalStatus ?? approvalStatus;
  const confirmationStatus = selected.confirmationStatus ?? "INVITED";
  const stage = registrationStage({ approvalStatus: personApproval, confirmationStatus, attendanceConfirmationRequired: confirmationRequired });
  const copy = registrationStageCopy[stage];
  const statusUrl = typeof window === "undefined" ? null : registrationStatusHref(
    selected.registrationStatusUrl || selected.confirmationUrl, window.location.origin);
  const needsActivation = selected.passwordSetupRequired || Boolean(selected.temporaryPasswordIssued && !selected.temporaryPassword);
  const statusShareUrl = isGroup && statusUrl && selected.whatsapp
    ? buildEventWhatsAppUrl([
      "Assalamu’alaikum warahmatullahi wabarakatuh.", "",
      `Ustadz ${selected.fullName}, pendaftaran ${event.name} telah tersimpan dengan kode ${selected.participantCode}.`,
      "Lihat status pendaftaran melalui tautan pribadi ini. Tidak perlu login:",
      statusUrl, "",
      "QR presensi hanya tersedia jika pendaftaran sudah memenuhi syarat. Jangan teruskan tautan ini. Jazakumullahu khairan.",
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

  const copyStatusLink = async () => {
    if (!statusUrl) return;
    try { await navigator.clipboard.writeText(statusUrl); setLinkCopied(true); }
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

    {isGroup && <label className="public-receipt__select" htmlFor="receipt-person">
      <span><UsersRound aria-hidden="true" /> Pilih peserta</span>
      <select id="receipt-person" value={selected.participantCode} onChange={(event) => { setSelectedCode(event.target.value); setCopyStatus(""); setLinkCopied(false); }}>
        {participants.map((person) => <option key={person.participantCode} value={person.participantCode}>{person.fullName} · {person.participantCode}</option>)}
      </select>
    </label>}

    <div className="public-receipt__confirmation">
      <Clock3 aria-hidden="true" /><div>
        <div role="status"><strong>{copy.label}</strong>
          <p>{stage === "READY" ? "Buka halaman status untuk melihat QR presensi terbaru." : copy.next}</p></div>
        <div className="public-receipt__confirmation-actions">
          {statusUrl ? <a href={statusUrl}>{stage === "AWAITING_CONFIRMATION" ? "Konfirmasi hadir" : "Lihat status pendaftaran"} <ArrowRight aria-hidden="true" /></a>
            : <Link to="/login/ustadz">Cek status di Portal Asatidz <ArrowRight aria-hidden="true" /></Link>}
          {statusUrl && <button type="button" onClick={() => void copyStatusLink()}>{linkCopied ? "Tautan tersalin" : "Salin tautan pribadi"}</button>}
          {statusShareUrl && <a href={statusShareUrl} target="_blank" rel="noopener noreferrer">Kirim ke WhatsApp peserta</a>}
        </div>
        {statusUrl && <p className="public-receipt__confirmation-note">{statusShareUrl ? `Kirim hanya kepada ${selected.fullName} (${selected.whatsapp}).` : "Tautan pribadi ini dapat dibuka tanpa login."}</p>}
      </div>
    </div>
    {emailQueued < participants.length && <p className="public-receipt__notice" role="status">Email informasi mungkin belum terkirim. Simpan bukti atau salin tautan pribadi; pendaftaran tetap tersimpan.</p>}

    <nav className="public-receipt__shortcuts" aria-label="Tautan bukti pendaftaran">
      <Link to={event.slug ? publicRundownPath(event.slug) : "/programs"}><CalendarDays aria-hidden="true" /> {event.slug ? "Rundown" : "Program"}</Link>
      <a href="#akses-portal"><KeyRound aria-hidden="true" /> Akses portal</a>
      <a href="#bukti-pendaftaran" aria-label="Ke bukti pendaftaran"><CheckCircle2 aria-hidden="true" /> Bukti</a>
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
          {isGroup && <p>Setiap asatidz memakai akses pribadi. Pilih nama di atas untuk melihat akses masing-masing.</p>}
        </div>
        <div className="public-receipt__actions">
          <a href={registrationAttendanceWhatsAppUrl(event.name, participants, event.publicContactWhatsapp)} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" /><strong>{event.publicContactWhatsapp ? "Tanya panitia via WhatsApp" : "Buka draf WhatsApp"}</strong><ArrowRight aria-hidden="true" /></a>
          <p>{event.publicContactWhatsapp ? "Pesan ini tidak mengubah status pendaftaran." : "Nomor panitia belum tersedia; pilih kontak tujuan sendiri."}</p>
        </div>
      </div>
      <div className="public-receipt__card-column" id="bukti-pendaftaran">
        <ParticipantQrCard key={selected.participantCode} eventName={event.name}
          person={{ fullName: selected.fullName, participantCode: selected.participantCode }}
          approvalStatus={personApproval} confirmationStatus={confirmationStatus}
          confirmationRequired={confirmationRequired} showStatus={false} />
        {isGroup && <p className="public-receipt__group-note">Pilih nama berikutnya untuk menyimpan bukti pendaftaran miliknya.</p>}
      </div>
    </div>
  </section>;
}
