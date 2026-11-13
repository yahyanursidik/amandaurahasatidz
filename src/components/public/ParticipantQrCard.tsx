import { useId, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { registrationStage, registrationStageCopy } from "@/lib/registrationStatus";

export type ParticipantCardDetails = {
  fullName: string;
  participantCode: string;
  qrToken?: string | null;
};

export function ParticipantQrCard({
  person, eventName, approvalStatus = "PENDING_REVIEW", confirmationStatus = "INVITED",
  confirmationRequired = true, eventOpen = true, showStatus = true,
}: {
  person: ParticipantCardDetails; eventName: string; approvalStatus?: string; confirmationStatus?: string;
  confirmationRequired?: boolean; eventOpen?: boolean; showStatus?: boolean;
}) {
  const canvasId = useId();
  const [downloadError, setDownloadError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const stage = registrationStage({ approvalStatus, confirmationStatus, attendanceConfirmationRequired: confirmationRequired });
  // Defense in depth for old cached responses that contained a signed token while pending.
  const qrToken = eventOpen && stage === "READY" && person.qrToken?.startsWith("pqr_") ? person.qrToken : null;
  const copy = !eventOpen && stage === "READY" ? { label: "Presensi tidak tersedia", next: "Buka Portal Asatidz untuk melihat riwayat atau hubungi panitia." }
    : stage === "READY" && !qrToken ? { label: "Pendaftaran disetujui", next: "Lihat status terbaru untuk mendapatkan QR presensi." }
      : registrationStageCopy[stage];

  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    setDownloadError("");
    let svgUrl: string | undefined;
    try {
      const image = document.createElement("canvas");
      image.width = 600;
      image.height = qrToken ? 720 : 352;
      const ctx = image.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, image.width, image.height);
      ctx.fillStyle = "#064e3b";
      ctx.fillRect(0, 0, image.width, 130);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 25px sans-serif";
      ctx.fillText(qrToken ? "KARTU QR PRESENSI" : "BUKTI PENDAFTARAN", 35, 55, 530);
      ctx.font = "20px sans-serif";
      ctx.fillText(eventName, 35, 92, 530);
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 27px sans-serif";
      ctx.fillText(person.fullName, 35, 181, 530);
      ctx.font = "22px sans-serif";
      ctx.fillText(`Kode pendaftaran: ${person.participantCode}`, 35, 220, 530);
      if (qrToken) {
        const qr = document.getElementById(canvasId);
        if (!qr) throw new Error("QR unavailable");
        const qrCopy = qr.cloneNode(true) as SVGSVGElement;
        qrCopy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        svgUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(qrCopy)], { type: "image/svg+xml;charset=utf-8" }));
        const qrImage = new Image();
        const url = svgUrl;
        await new Promise<void>((resolve, reject) => {
          qrImage.onload = () => resolve();
          qrImage.onerror = reject;
          qrImage.src = url;
        });
        ctx.drawImage(qrImage, 105, 251, 390, 390);
        ctx.fillStyle = "#334155";
        ctx.fillText("Tunjukkan QR pribadi saat presensi.", 35, 683, 530);
      } else {
        ctx.fillStyle = "#334155";
        ctx.fillText(copy.label, 35, 270, 530);
        ctx.font = "bold 21px sans-serif";
        ctx.fillText("BUKAN KARTU PRESENSI", 35, 316, 530);
      }
      const link = document.createElement("a");
      link.download = `${qrToken ? "qr-presensi" : "bukti-pendaftaran"}-${person.participantCode}.png`;
      link.href = image.toDataURL("image/png");
      link.click();
    } catch {
      setDownloadError("Gambar belum dapat disimpan. Coba lagi atau buka kembali tautan pribadi dari email.");
    } finally {
      if (svgUrl) URL.revokeObjectURL(svgUrl);
      setDownloading(false);
    }
  };

  return <article className="participant-qr-card rounded-2xl border border-emerald-200 bg-white p-5 text-slate-900 shadow-sm">
    <p className="text-sm font-bold text-emerald-800">{qrToken ? "Kartu QR presensi" : "Bukti pendaftaran"}</p>
    <h3 className="mt-2 text-lg font-black">{person.fullName}</h3>
    <p className="mt-1 text-sm">{eventName}</p>
    <p className="mt-4 text-sm font-bold text-slate-600">Kode pendaftaran</p>
    <p className="break-all font-mono text-2xl font-black tracking-wide text-emerald-950 sm:text-3xl"><strong>{person.participantCode}</strong></p>
    {qrToken ? <div className="my-5 flex justify-center rounded-xl border-2 border-slate-300 bg-white p-3">
      <QRCodeSVG id={canvasId} value={qrToken} size={320} marginSize={4} level="M" style={{ display: "block", width: "min(100%, 320px)", height: "auto", background: "white" }} aria-label={`QR presensi ${person.fullName}`} />
    </div> : null}
    {showStatus && <div className={qrToken ? "mt-3 text-sm text-slate-700" : "mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700"}>
      <strong>{copy.label}</strong><p>{copy.next}</p>
    </div>}
    {downloadError && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{downloadError}</p>}
    <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold">
      <button type="button" onClick={() => void download()} disabled={downloading}
        className="min-h-11 rounded-lg border border-emerald-700 bg-emerald-800 px-3 py-2 text-white disabled:opacity-50">
        {downloading ? "Menyiapkan gambar…" : qrToken ? "Simpan QR presensi" : "Simpan bukti pendaftaran"}
      </button>
    </div>
  </article>;
}
