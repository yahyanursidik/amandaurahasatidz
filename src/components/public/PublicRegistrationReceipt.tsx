/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4
 * genre: modern-minimal · tone: calm-warm · macrostructure: Index-First
 * audience: asatidz senior dan kepala rombongan · use: simpan QR lalu temukan langkah berikutnya
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, CheckCircle2, KeyRound, MessageCircle, UsersRound } from "lucide-react";
import { ParticipantQrCard } from "@/components/public/ParticipantQrCard";
import { publicRundownPath, registrationAttendanceWhatsAppUrl, type ReceiptParticipant } from "@/lib/publicRegistrationReceipt";

type ReceiptProps = {
  event: { name: string; slug?: string; publicContactWhatsapp?: string | null };
  participants: ReceiptParticipant[];
  emailQueued: number;
};

export function PublicRegistrationReceipt({ event, participants, emailQueued }: ReceiptProps) {
  const [selectedCode, setSelectedCode] = useState(participants[0]?.participantCode || "");
  const [copyStatus, setCopyStatus] = useState("");
  const selected = participants.find((person) => person.participantCode === selectedCode) || participants[0];
  if (!selected) return null;
  const isGroup = participants.length > 1;
  const needsActivation = selected.passwordSetupRequired || Boolean(selected.temporaryPasswordIssued && !selected.temporaryPassword);

  const copyPassword = async () => {
    if (!selected.temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(selected.temporaryPassword);
      setCopyStatus("Sandi disalin. Berikan hanya kepada peserta yang bersangkutan.");
    } catch {
      setCopyStatus("Sandi belum dapat disalin. Tekan lama teks sandi untuk menyalinnya.");
    }
  };

  return <section className="public-receipt" aria-labelledby="public-receipt-title">
    <header className="public-receipt__header">
      <CheckCircle2 aria-hidden="true" />
      <div>
        <h2 id="public-receipt-title">Pendaftaran tersimpan</h2>
        <p>{isGroup ? `${participants.length} asatidz terdaftar. Setiap orang memiliki QR sendiri.` : "QR pribadi sudah siap disimpan."} Tidak perlu login untuk menyimpan kartu.</p>
      </div>
    </header>

    {emailQueued < participants.length && <p className="public-receipt__notice" role="status">Email informasi mungkin belum terkirim. Simpan kartu QR sekarang; data pendaftaran tetap tersimpan.</p>}

    <div className="public-receipt__layout">
      <div className="public-receipt__card-column">
        {isGroup && <label className="public-receipt__select" htmlFor="receipt-person">
          <span><UsersRound aria-hidden="true" /> Pilih kartu peserta</span>
          <select id="receipt-person" value={selected.participantCode} onChange={(event) => { setSelectedCode(event.target.value); setCopyStatus(""); }}>
            {participants.map((person) => <option key={person.participantCode} value={person.participantCode}>{person.fullName} · {person.participantCode}</option>)}
          </select>
        </label>}
        <ParticipantQrCard key={selected.participantCode} eventName={event.name} person={selected} showShareActions={isGroup} />
        {isGroup && <p className="public-receipt__group-note">Pilih nama berikutnya untuk menyimpan atau membagikan kartu miliknya. Berikan QR hanya kepada peserta yang bersangkutan.</p>}
      </div>

      <div className="public-receipt__next">
        <h3>Langkah berikutnya</h3>
        <div className="public-receipt__actions">
          <div><Link to={event.slug ? publicRundownPath(event.slug) : "/programs"}><CalendarDays aria-hidden="true" /><strong>{event.slug ? "Lihat rundown" : "Lihat program"}</strong><ArrowRight aria-hidden="true" /></Link><p>Jadwal terbaru di halaman program.</p></div>
          <div><a href={registrationAttendanceWhatsAppUrl(event.name, participants, event.publicContactWhatsapp)} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" /><strong>{event.publicContactWhatsapp ? "Kabari panitia" : "Buka draf WhatsApp"}</strong><ArrowRight aria-hidden="true" /></a><p>{event.publicContactWhatsapp ? "Draf WhatsApp ke kontak panitia event." : "Nomor panitia belum tersedia; pilih kontak tujuan sendiri."}</p></div>
        </div>
        <p className="public-receipt__wa-note">Pesan WhatsApp tidak mencatat presensi. Saat acara, tunjukkan QR masing-masing kepada panitia.</p>

        <div className="public-receipt__access">
          <KeyRound aria-hidden="true" />
          <h3>Masuk Portal Asatidz</h3>
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
      </div>
    </div>
  </section>;
}
