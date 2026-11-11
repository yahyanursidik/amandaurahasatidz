/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V4
 * genre: modern-minimal · tone: calm-warm · macrostructure: Narrative Workflow · design-system: design.md
 * One personal decision at a time; administrative approval and daily attendance stay distinct.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, CalendarDays, CheckCircle2, CircleHelp, Clock3, XCircle } from "lucide-react";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { ParticipantQrCard } from "@/components/public/ParticipantQrCard";
import { ENV } from "@/config/env";
import { formatEventDate, formatEventDateTime, eventTimezoneLabel } from "@/lib/eventDateTime";
import { publicRundownPath } from "@/lib/publicRegistrationReceipt";
import { buildEventWhatsAppUrl } from "@/lib/eventWhatsApp";

type Confirmation = {
  participantName: string; participantCode: string; approvalStatus: string; confirmationStatus: string;
  eventName: string; eventSlug: string; eventStatus: string; startDate: string; endDate: string;
  timezone: string; venueName: string | null; publicContactWhatsapp: string | null;
  attendanceConfirmationRequired: boolean; attendanceConfirmationDeadline: string | null;
  lateConfirmationPolicy: string; canConfirm: boolean; canDecline: boolean; cardUrl: string | null;
  cancellationKind?: "WITHDRAWN" | "DECLINED" | null;
};

export function PublicParticipantConfirmationPage() {
  const location = useLocation();
  const token = useMemo(() => {
    try { return decodeURIComponent(location.hash.slice(1)); } catch { return ""; }
  }, [location.hash]);
  const [details, setDetails] = useState<Confirmation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [declineReview, setDeclineReview] = useState(false);

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
  }, [token]);

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

  const approved = details?.approvalStatus === "APPROVED";
  const confirmed = details?.confirmationStatus === "CONFIRMED";
  const inactive = details && ["CANCELLED", "REPLACED"].includes(details.confirmationStatus);
  const needsLateReview = Boolean(details?.approvalStatus === "PENDING_REVIEW" && confirmed);
  const helpUrl = details?.publicContactWhatsapp
    ? buildEventWhatsAppUrl(`Assalamu’alaikum warahmatullahi wabarakatuh. Saya ${details.participantName} (${details.participantCode}) perlu bantuan mengenai konfirmasi hadir ${details.eventName}. Jazakumullahu khairan.`, details.publicContactWhatsapp)
    : null;
  const qrToken = details?.cardUrl ? new URL(details.cardUrl, window.location.origin).searchParams.get("token") : null;

  return <PublicLayout><div className="public-confirm" aria-labelledby="public-confirm-title">
    <div className="public-confirm__eyebrow"><CheckCircle2 aria-hidden="true" /> Daurah Duat dan Pegiat Dakwah · respons pribadi</div>
    <h1 id="public-confirm-title">Konfirmasi kehadiran</h1>
    {loading ? <p className="public-confirm__feedback" role="status">Memuat status pendaftaran…</p> : !details ?
      <div className="public-confirm__feedback" role="alert"><strong>Tautan tidak dapat dibuka</strong><p>{error}</p><Link to="/programs">Lihat informasi acara</Link></div> : <>
      <section className="public-confirm__identity" aria-label="Pendaftaran Anda">
        <p>Assalamu’alaikum, {details.participantName}</p>
        <h2>{details.eventName}</h2>
        <div className="public-confirm__facts">
          <span><CalendarDays aria-hidden="true" /> {formatEventDate(details.startDate)}{details.endDate !== details.startDate ? ` – ${formatEventDate(details.endDate)}` : ""}</span>
          <span>Kode pribadi: <strong>{details.participantCode}</strong></span>
        </div>
      </section>

      {inactive ? <section className="public-confirm__state public-confirm__state--muted" role="status">
        <XCircle aria-hidden="true" /><div><h2>{details.confirmationStatus === "REPLACED" ? "Perwakilan telah diganti"
          : details.cancellationKind === "WITHDRAWN" ? "Pengunduran diri tercatat"
            : details.cancellationKind === "DECLINED" ? "Berhalangan hadir tercatat" : "Pendaftaran dibatalkan"}</h2>
          <p>QR lama tidak berlaku. Bila rencana berubah, hubungi panitia agar data ditinjau kembali.</p></div>
      </section> : !approved ? <section className="public-confirm__state" role="status">
        <Clock3 aria-hidden="true" />
        <div><h2>{needsLateReview ? "Konfirmasi tersimpan, menunggu tinjauan admin" : details.approvalStatus === "WAITLISTED" ? "Masih dalam daftar tunggu" : ["DECLINED", "REJECTED"].includes(details.approvalStatus) ? "Pendaftaran belum disetujui" : "Menunggu persetujuan admin"}</h2>
          <p>{needsLateReview ? "Konfirmasi Ustadz melewati tenggat dan sedang ditinjau kembali. QR akan aktif setelah disetujui admin." : "Belum perlu mengisi konfirmasi hadir. Buka kembali tautan ini setelah mendapat kabar dari panitia."}</p></div>
      </section> : confirmed ? <section className="public-confirm__state" role="status">
        <CheckCircle2 aria-hidden="true" /><div><h2>Insya Allah hadir — tersimpan</h2>
          <p>Terima kasih. Simpan kartu QR pribadi di bawah. Presensi tetap dilakukan setiap hari. Jika rencana berubah sebelum presensi, Ustadz bisa mengundurkan diri di halaman ini.</p></div>
      </section> : <section className="public-confirm__state" role="status">
        <Clock3 aria-hidden="true" /><div><h2>Pendaftaran disetujui</h2>
          <p>Sekarang pilih rencana kehadiran Ustadz. Tidak perlu login.</p></div>
      </section>}

      {approved && !inactive && !confirmed && details.attendanceConfirmationDeadline && <p className="public-confirm__deadline">
        Batas konfirmasi: {formatEventDateTime(details.attendanceConfirmationDeadline, details.timezone)} {eventTimezoneLabel(details.timezone)}
      </p>}

      {details.canConfirm && !declineReview && <div className="public-confirm__decision">
        <button type="button" className="public-confirm__primary" onClick={() => void decide("CONFIRM")} disabled={saving}>
          <CheckCircle2 aria-hidden="true" /> {saving ? "Menyimpan…" : "Insya Allah hadir"} <ArrowRight aria-hidden="true" />
        </button>
        <p>Konfirmasi ini bukan absensi. QR atau kode pribadi akan dicatat oleh petugas pada setiap hari acara.</p>
      </div>}
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
      {approved && !inactive && !confirmed && !details.canConfirm && <p className="public-confirm__feedback" role="status">Batas konfirmasi telah lewat. Hubungi panitia untuk peninjauan.</p>}
      {qrToken && details.cardUrl && <div className="public-confirm__card"><ParticipantQrCard eventName={details.eventName}
        person={{ fullName: details.participantName, participantCode: details.participantCode, qrToken,
          cardUrl: details.cardUrl }} approvalStatus={details.approvalStatus} confirmationStatus={details.confirmationStatus}
        showShareActions={false} /></div>}
      <nav className="public-confirm__links" aria-label="Langkah lain">
        <Link to={publicRundownPath(details.eventSlug)}><CalendarDays aria-hidden="true" /> Lihat rundown</Link>
        <Link to="/login/ustadz"><ArrowRight aria-hidden="true" /> Portal Asatidz</Link>
        {helpUrl && <a href={helpUrl} target="_blank" rel="noopener noreferrer"><CircleHelp aria-hidden="true" /> Hubungi panitia</a>}
      </nav>
      <p className="public-confirm__privacy">Tautan ini khusus untuk Ustadz. Jangan bagikan kepada orang lain.</p>
    </>}
  </div></PublicLayout>;
}
