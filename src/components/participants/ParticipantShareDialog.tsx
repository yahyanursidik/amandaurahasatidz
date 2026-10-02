import { useEffect, useRef, useState } from "react";
import { Check, Clipboard, Loader2, Mail, MessageCircle, Share2, X } from "lucide-react";
import { ENV } from "@/config/env";
import { ParticipantQrCard } from "@/components/public/ParticipantQrCard";
import { buildParticipantRegistrationShareLinks, type ParticipantShareDetails } from "@/lib/participantShare";

type Props = {
  eventId: string;
  participantId: string;
  participantName: string;
  demoMode?: boolean;
};

export function ParticipantShareDialog({ eventId, participantId, participantName, demoMode = false }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [details, setDetails] = useState<ParticipantShareDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => () => requestRef.current?.abort(), [eventId, participantId]);
  const links = details ? buildParticipantRegistrationShareLinks(details, window.location.origin) : null;
  const buttonClass = "inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50";

  const open = async () => {
    dialogRef.current?.showModal();
    requestRef.current?.abort();
    setDetails(null);
    setCopied(false);
    setError("");
    if (demoMode) {
      setError("Pratinjau: berbagi kode dan QR tersedia pada event yang tersimpan. Tidak ada pesan yang dikirim.");
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const token = localStorage.getItem("yts_auth_token") || "";
      const response = await fetch(`${ENV.API_BASE_URL}/events/${eventId}/participants/${participantId}/share`, {
        credentials: "include",
        signal: controller.signal,
        headers: token ? { Authorization: token } : {},
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Informasi berbagi tidak dapat dimuat.");
      if (result.data?.eventId !== eventId || result.data?.participantId !== participantId) {
        throw new Error("Kartu peserta tidak sesuai dengan event yang dipilih.");
      }
      if (!controller.signal.aborted) setDetails(result.data);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Informasi berbagi tidak dapat dimuat.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const copyMessage = async () => {
    if (!links) return;
    try {
      await navigator.clipboard.writeText(links.message);
      setCopied(true);
      setError("");
    } catch {
      setError("Pesan gagal disalin. Pilih dan salin teks pratinjau secara manual.");
    }
  };

  return <>
    <button type="button" onClick={() => void open()} className={buttonClass} aria-label={`Bagikan QR dan kode ${participantName}`}>
      <Share2 className="h-4 w-4" aria-hidden="true" /> Bagikan QR / kode
    </button>
    <dialog ref={dialogRef} aria-labelledby={`participant-share-${participantId}`}
      onClose={() => { requestRef.current?.abort(); setLoading(false); setDetails(null); }}
      className="m-auto max-h-[90dvh] w-[min(44rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/60">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 p-5">
        <div><h2 id={`participant-share-${participantId}`} className="text-lg font-black">Bagikan QR dan kode pendaftaran</h2><p className="mt-1 text-sm text-slate-600">{participantName}</p></div>
        <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Tutup berbagi peserta" className={buttonClass}><X className="h-4 w-4" /></button>
      </header>
      <div className="space-y-4 p-5">
        {loading && <p role="status" className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Memuat kode dan kartu peserta…</p>}
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
        {details && links && <>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-bold uppercase text-emerald-800">Kode pendaftaran</p>
            <p className="mt-1 break-all font-mono text-2xl font-black">{details.participantCode}</p>
            {!links.cardUrl && <p className="mt-2 text-sm">QR belum tersedia. Kode dapat dibagikan, tetapi belum berlaku untuk presensi hingga disetujui panitia.</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {links.whatsappUrl ? <a href={links.whatsappUrl} target="_blank" rel="noopener noreferrer" className={buttonClass}><MessageCircle className="h-4 w-4" /> WhatsApp</a> : <button disabled className={buttonClass}>WhatsApp tidak tersedia</button>}
            {links.emailUrl ? <a href={links.emailUrl} className={buttonClass}><Mail className="h-4 w-4" /> Email</a> : <button disabled className={buttonClass}>Email tidak tersedia</button>}
            <button type="button" onClick={() => void copyMessage()} className={buttonClass}>{copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}{copied ? "Pesan tersalin" : "Salin pesan"}</button>
          </div>
          <p className="text-xs leading-5 text-slate-600">WhatsApp/email membuka pesan siap kirim di aplikasi Anda. Klik Kirim di aplikasi tujuan; tindakan ini tidak mengirim otomatis. QR dibagikan sebagai tautan kartu, bukan lampiran otomatis.</p>
          <label className="block text-sm font-bold">Pratinjau pesan<textarea readOnly value={links.message} rows={12} className="mt-2 w-full rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm font-normal leading-6" /></label>
          {links.cardUrl && details.qrToken && <ParticipantQrCard showShareActions={false} eventName={details.eventName} person={{ fullName: details.fullName, participantCode: details.participantCode, qrToken: details.qrToken, cardUrl: links.cardUrl, email: details.email || undefined, whatsapp: details.whatsapp || details.phone }} />}
        </>}
      </div>
    </dialog>
  </>;
}