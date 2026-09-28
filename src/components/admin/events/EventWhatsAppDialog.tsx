import React, { useEffect, useRef, useState } from "react";
import { Check, Clipboard, MessageCircle, X } from "lucide-react";
import { buildEventWhatsAppMessage, buildEventWhatsAppUrl, EventWhatsAppContext, EventWhatsAppType } from "@/lib/eventWhatsApp";

export const EventWhatsAppDialog: React.FC<{ event: EventWhatsAppContext }> = ({ event }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [type, setType] = useState<EventWhatsAppType>("INVITATION");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const published = ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING", "COMPLETED"].includes(event.status);

  useEffect(() => {
    setMessage(buildEventWhatsAppMessage(type, event, window.location.origin));
    setCopied(false);
  }, [event.name, event.slug, event.startDate, event.endDate, event.venueName, event.status, event.audienceMode, type]);

  const send = () => {
    const url = buildEventWhatsAppUrl(message, phone);
    if (!url) { setError("Nomor WhatsApp tidak valid. Gunakan format 08… atau +62… atau kosongkan untuk memilih penerima di WhatsApp."); return; }
    setError("");
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return <>
    <button type="button" onClick={() => dialogRef.current?.showModal()} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-emerald-200 px-3 text-xs font-bold text-emerald-800 hover:bg-emerald-50" aria-label={`Template WhatsApp ${event.name}`}>
      <MessageCircle className="h-4 w-4" /> WhatsApp
    </button>
    <dialog ref={dialogRef} className="m-auto max-h-[90dvh] w-[min(38rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl" onClick={(interaction) => { if (interaction.target === dialogRef.current) dialogRef.current?.close(); }}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 p-5">
        <div><h2 className="text-lg font-black">Bagikan {event.name}</h2><p className="mt-1 text-sm text-slate-600">Tinjau pesan sebelum membuka wa.me. Pengiriman diselesaikan di aplikasi WhatsApp.</p></div>
        <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Tutup template WhatsApp" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-300"><X className="h-5 w-5" /></button>
      </div>
      <div className="space-y-4 p-5">
        <label className="block text-sm font-bold">Jalur komunikasi<select value={type} onChange={(change) => setType(change.target.value as EventWhatsAppType)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"><option value="INVITATION">Undangan (tautan khusus dari panitia)</option><option value="REGULAR">Pendaftaran reguler</option></select></label>
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">Undangan lembaga dengan tautan dan kode unik dibagikan melalui menu <strong>Undangan</strong> pada event ini. Pesan umum ini tidak memuat kredensial pribadi.</p>
        <label className="block text-sm font-bold">Nomor tujuan (opsional)<input type="tel" value={phone} onChange={(change) => setPhone(change.target.value)} placeholder="08… atau +62…; kosongkan untuk pilih kontak" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label>
        <label className="block text-sm font-bold">Pesan yang akan dikirim<textarea value={message} onChange={(change) => { setMessage(change.target.value); setCopied(false); }} rows={12} className="mt-1 w-full resize-y rounded-lg border border-slate-300 p-3 text-sm font-normal leading-6" /></label>
        {!published && <p role="alert" className="text-sm font-bold text-amber-800">Event ini masih draft atau dibatalkan. Terbitkan dulu sebelum membagikan tautan publik.</p>}
        {error && <p role="alert" className="text-sm font-bold text-rose-800">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void navigator.clipboard.writeText(message).then(() => setCopied(true)).catch(() => setError("Tidak dapat menyalin pesan. Pilih teks lalu salin manual."))} disabled={!message.trim()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold disabled:opacity-50">{copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}{copied ? "Tersalin" : "Salin pesan"}</button>
          <button type="button" onClick={send} disabled={!published || !message.trim()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50"><MessageCircle className="h-4 w-4" /> Buka wa.me</button>
        </div>
      </div>
    </dialog>
  </>;
};
