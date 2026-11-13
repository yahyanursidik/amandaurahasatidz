/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V4
 * genre: modern-minimal · tone: calm-warm · macrostructure: Narrative Workflow · design-system: design.md
 * One personal decision at a time; administrative approval and daily attendance stay distinct.
 */
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, CalendarDays, CheckCircle2, CircleHelp, Clock3, RefreshCw, XCircle } from "lucide-react";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { ParticipantQrCard } from "@/components/public/ParticipantQrCard";
import { ENV } from "@/config/env";
import { formatEventDate, formatEventDateTime, eventTimezoneLabel } from "@/lib/eventDateTime";
import { publicRundownPath } from "@/lib/publicRegistrationReceipt";
import { buildEventWhatsAppUrl } from "@/lib/eventWhatsApp";
import { registrationStage, registrationStageCopy } from "@/lib/registrationStatus";

type Confirmation = {
  participantName: string; participantCode: string; approvalStatus: string; confirmationStatus: string;
  eventName: string; eventSlug: string; eventStatus: string; eventOpen: boolean; startDate: string; endDate: string;
  timezone: string; venueName: string | null; publicContactWhatsapp: string | null;
  attendanceConfirmationRequired: boolean; attendanceConfirmationDeadline: string | null;
  lateConfirmationPolicy: string; canConfirm: boolean; canDecline: boolean; qrToken: string | null;
  cancellationKind?: "WITHDRAWN" | "DECLINED" | null;
};

export function PublicParticipantConfirmationPage() {
  const { hash } = useLocation();
  let token = "";
  try { token = decodeURIComponent(hash.slice(1)); } catch { /* The status view will explain an invalid link. */ }
  return <ParticipantStatus key={token} token={token} />;
}

function ParticipantStatus({ token }: { token: string }) {
  const [details, setDetails] = useState<Confirmation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [declineReview, setDeclineReview] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setDetails(null); setError(""); setLoading(true); setDeclineReview(false);
    if (!token.startsWith("pcf_")) { setError("Tautan pribadi tidak lengkap. Buka tautan yang diberikan setelah mendaftar atau hubungi panitia."); setLoading(false); return; }
    void fetch(`${ENV.API_BASE_URL}/confirmations/public/status`,
      { method: "POST", signal: controller.signal, cache: "no-store", referrerPolicy: "no-referrer",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message || "Status pendaftaran tidak dapat dimuat.");
        if (!controller.signal.aborted) setDetails(body.data);
      })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Status pendaftaran tidak dapat dimuat."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, reload]);

  const decide = async (decision: "CONFIRM" | "DECLINE") => {
    if (saving || !details || (decision === "CONFIRM" ? !details.canConfirm : !details.canDecline)) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`${ENV.API_BASE_URL}/confirmations/public/decision`, {
        method: "POST", cache: "no-store", referrerPolicy: "no-referrer",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, decision }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Pilihan belum tersimpan. Coba lagi.");
      setDetails(body.data); setDeclineReview(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Pilihan belum tersimpan. Coba lagi."); }
    finally { setSaving(false); }
  };

  const confirmed = details?.confirmationStatus === "CONFIRMED";
  const stage = details ? registrationStage(details) : "PENDING_REVIEW";
  const inactive = stage === "INACTIVE";
  const qrToken = details?.eventOpen && stage === "READY" && details.qrToken?.startsWith("pqr_") ? details.qrToken : null;
  const defaultCopy = registrationStageCopy[stage];
  const stateCopy = details && inactive
    ? { label: details.confirmationStatus === "REPLACED" ? "Perwakilan telah diganti"
        : details.cancellationKind === "WITHDRAWN" ? "Pengunduran diri tercatat"
          : details.cancellationKind === "DECLINED" ? "Berhalangan hadir tercatat" : "Pendaftaran dibatalkan",
      next: "QR lama tidak berlaku. Hubungi panitia bila rencana berubah." }
    : details && !details.eventOpen && stage !== "DECLINED"
      ? { label: "Presensi tidak tersedia", next: "Acara belum aktif atau sudah selesai. Masuk ke Portal Asatidz untuk melihat riwayat atau hubungi panitia." }
      : stage === "AWAITING_CONFIRMATION" && !details?.canConfirm
        ? { label: "Disetujui · tenggat konfirmasi lewat", next: "QR belum diterbitkan. Hubungi panitia untuk peninjauan." }
        : stage === "READY" && !qrToken
          ? { label: "Pendaftaran disetujui", next: "QR belum dapat dimuat. Perbarui status atau masuk ke Portal Asatidz." }
          : defaultCopy;
  const StateIcon = inactive || stage === "DECLINED" ? XCircle : qrToken ? CheckCircle2 : Clock3;
  const helpUrl = details?.publicContactWhatsapp
    ? buildEventWhatsAppUrl(`Assalamu’alaikum warahmatullahi wabarakatuh. Saya ${details.participantName} (${details.participantCode}) perlu bantuan mengenai pendaftaran ${details.eventName}. Jazakumullahu khairan.`, details.publicContactWhatsapp)
    : null;

  return <PublicLayout><div className="public-confirm" aria-labelledby="public-confirm-title">
    <div className="public-confirm__eyebrow"><CheckCircle2 aria-hidden="true" /> Daurah Duat dan Pegiat Dakwah · respons pribadi</div>
    <h1 id="public-confirm-title">Status pendaftaran</h1>
    {loading ? <p className="public-confirm__feedback" role="status">Memuat status pendaftaran…</p> : !details ?
      <div className="public-confirm__feedback" role="alert"><strong>Status belum dapat dibuka</strong><p>{error}</p>
        <Link className="inline-flex min-h-11 items-center font-bold underline" to="/login/ustadz">Masuk Portal Asatidz</Link>
      </div> : <>
      <section className="public-confirm__identity" aria-label="Pendaftaran Anda">
        <p>Assalamu’alaikum, {details.participantName}</p>
        <h2>{details.eventName}</h2>
        <div className="public-confirm__facts">
          <span><CalendarDays aria-hidden="true" /> {formatEventDate(details.startDate)}{details.endDate !== details.startDate ? ` – ${formatEventDate(details.endDate)}` : ""}</span>
          <span>Kode pendaftaran: <strong>{details.participantCode}</strong></span>
        </div>
      </section>

      <section className={`public-confirm__state${inactive || stage === "DECLINED" ? " public-confirm__state--muted" : ""}`} role="status">
        <StateIcon aria-hidden="true" /><div><h2>{stateCopy.label}</h2><p>{stateCopy.next}</p></div>
      </section>

      {stage === "AWAITING_CONFIRMATION" && details.eventOpen && details.attendanceConfirmationDeadline && <p className="public-confirm__deadline">
        Batas konfirmasi: {formatEventDateTime(details.attendanceConfirmationDeadline, details.timezone)} {eventTimezoneLabel(details.timezone)}
      </p>}

      {details.canConfirm && !declineReview && <div className="public-confirm__decision">
        <button type="button" className="public-confirm__primary" onClick={() => void decide("CONFIRM")} disabled={saving}>
          <CheckCircle2 aria-hidden="true" /> {saving ? "Menyimpan…" : "Insya Allah hadir"} <ArrowRight aria-hidden="true" />
        </button>
        <p>Konfirmasi ini bukan absensi. QR atau kode pribadi akan dicatat oleh petugas pada setiap hari acara.</p>
      </div>}
      {qrToken && !declineReview && <div className="public-confirm__card"><ParticipantQrCard key={qrToken} eventName={details.eventName}
        person={{ fullName: details.participantName, participantCode: details.participantCode, qrToken }}
        approvalStatus={details.approvalStatus} confirmationStatus={details.confirmationStatus}
        confirmationRequired={details.attendanceConfirmationRequired} showStatus={false} /></div>}
      {details.canDecline && !declineReview && <button type="button" className="public-confirm__secondary" onClick={() => setDeclineReview(true)} disabled={saving}>
        <XCircle aria-hidden="true" /> {confirmed ? "Mengundurkan diri" : "Berhalangan hadir"}
      </button>}
      {declineReview && <section className="public-confirm__decline" aria-labelledby="public-confirm-decline-title">
        <h2 id="public-confirm-decline-title">{confirmed ? "Yakin ingin mengundurkan diri?" : "Benar berhalangan hadir?"}</h2>
        <p>Tempat Ustadz akan dilepas dan QR tidak berlaku. Jika rencana berubah lagi, panitia perlu meninjau pendaftaran.</p>
        <div><button type="button" className="public-confirm__danger" onClick={() => void decide("DECLINE")} disabled={saving}>{saving ? "Menyimpan…" : confirmed ? "Ya, saya mengundurkan diri" : "Ya, saya berhalangan"}</button>
          <button type="button" className="public-confirm__cancel" onClick={() => setDeclineReview(false)} disabled={saving}>Kembali</button></div>
      </section>}
      {error && <p className="public-confirm__error" role="alert">{error}</p>}
      {!qrToken && !declineReview && !details.canConfirm && <button type="button" className="public-confirm__secondary" onClick={() => setReload((value) => value + 1)} disabled={saving}>
        <RefreshCw aria-hidden="true" /> Perbarui status
      </button>}
      <nav className="public-confirm__links" aria-label="Langkah lain">
        <Link to={publicRundownPath(details.eventSlug)}><CalendarDays aria-hidden="true" /> Lihat rundown</Link>
        <Link to="/login/ustadz"><ArrowRight aria-hidden="true" /> Portal Asatidz</Link>
        {helpUrl && <a href={helpUrl} target="_blank" rel="noopener noreferrer"><CircleHelp aria-hidden="true" /> Hubungi panitia</a>}
      </nav>
      <p className="public-confirm__privacy">Tautan ini khusus untuk Ustadz. Jangan bagikan kepada orang lain.</p>
    </>}
  </div></PublicLayout>;
}
