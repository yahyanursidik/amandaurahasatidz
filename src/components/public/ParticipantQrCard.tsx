import { useId } from "react";
import { QRCodeSVG } from "qrcode.react";

export type ParticipantCardDetails = {
  fullName: string;
  participantCode: string;
  qrToken: string;
  cardUrl: string;
  email?: string;
  whatsapp?: string | null;
};

export function ParticipantQrCard({ person, eventName, showShareActions = true }: { person: ParticipantCardDetails; eventName: string; showShareActions?: boolean }) {
  const canvasId = useId();
  const url = new URL(person.cardUrl, window.location.origin).toString();
  const message = `Kartu peserta ${person.fullName} untuk ${eventName} (kode ${person.participantCode}). Tunjukkan QR pribadi saat presensi.`;
  const digits = person.whatsapp?.replace(/\D/g, "").replace(/^0/, "62") || "";

  const download = async () => {
    const qr = document.getElementById(canvasId) as SVGSVGElement | null;
    if (!qr) return;
    const qrCopy = qr.cloneNode(true) as SVGSVGElement;
    qrCopy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const blobUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(qrCopy)], { type: "image/svg+xml;charset=utf-8" }));
    const qrImage = new Image();
    try { await new Promise<void>((resolve, reject) => {
      qrImage.onload = () => resolve();
      qrImage.onerror = () => reject(new Error("QR tidak dapat diunduh."));
      qrImage.src = blobUrl;
    }); } catch { URL.revokeObjectURL(blobUrl); return; }
    const image = document.createElement("canvas");
    image.width = 600;
    image.height = 720;
    const ctx = image.getContext("2d");
    if (!ctx) { URL.revokeObjectURL(blobUrl); return; }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, image.width, image.height);
    ctx.fillStyle = "#064e3b";
    ctx.fillRect(0, 0, image.width, 130);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 25px sans-serif";
    ctx.fillText("KARTU PESERTA DAURAH", 35, 55);
    ctx.font = "18px sans-serif";
    ctx.fillText(eventName.slice(0, 47), 35, 92);
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText(person.fullName.slice(0, 32), 35, 185);
    ctx.font = "bold 28px sans-serif";
    ctx.fillText(`Kode: ${person.participantCode}`, 35, 222, 530);
    ctx.drawImage(qrImage, 105, 255, 390, 390);
    URL.revokeObjectURL(blobUrl);
    ctx.fillStyle = "#475569";
    ctx.font = "18px sans-serif";
    ctx.fillText("Tunjukkan QR ini saat presensi", 126, 686);
    const link = document.createElement("a");
    link.download = `kartu-${person.participantCode}.png`;
    link.href = image.toDataURL("image/png");
    link.click();
  };

  return <article className="rounded-2xl border border-emerald-200 bg-white p-5 text-slate-900 shadow-sm">
    <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Kartu QR pribadi</p>
    <h3 className="mt-2 text-lg font-black">{person.fullName}</h3>
    <p className="mt-1 text-sm">{eventName}</p>
    <p className="mt-3 text-sm font-bold text-slate-600">KODE PENDAFTARAN</p>
    <p className="break-all font-mono text-3xl font-black tracking-wider text-emerald-950 sm:text-4xl"><strong>{person.participantCode}</strong></p>
    {person.email && <p className="mt-1 break-all text-sm">Email: {person.email}</p>}
    <div className="my-5 flex justify-center rounded-xl border-2 border-slate-300 bg-white p-3">
      {person.qrToken?.startsWith("pqr_") ? <QRCodeSVG id={canvasId} value={person.qrToken} size={320} marginSize={4} level="M" style={{ display: "block", width: "min(100%, 320px)", height: "auto", background: "white" }} aria-label={`QR peserta ${person.fullName}`} /> : <p role="alert" className="p-5 text-rose-800">QR belum tersedia. Buka Portal Asatidz atau hubungi panitia.</p>}
    </div>
    <p className="text-center text-xs text-slate-600">Simpan kartu ini untuk presensi. Bagikan tautannya hanya kepada peserta yang bersangkutan.</p>
    <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold">
      <button type="button" onClick={() => void download()} disabled={!person.qrToken?.startsWith("pqr_")} className="min-h-11 rounded-lg bg-emerald-800 px-3 py-2 text-white disabled:opacity-50">Unduh kartu PNG</button>
      <a className="inline-flex min-h-11 items-center rounded-lg border border-emerald-700 px-3 py-2 text-emerald-800" href={url} target="_blank" rel="noopener noreferrer">Buka kartu QR</a>
      {showShareActions && <a className="inline-flex min-h-11 items-center rounded-lg border border-emerald-700 px-3 py-2 text-emerald-800" href={`https://wa.me/${digits}?text=${encodeURIComponent(`${message} ${url}`)}`} target="_blank" rel="noopener noreferrer">Bagikan WhatsApp</a>}
      {showShareActions && <a className="inline-flex min-h-11 items-center rounded-lg border border-emerald-700 px-3 py-2 text-emerald-800" href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">Bagikan Telegram</a>}
    </div>
  </article>;
}
