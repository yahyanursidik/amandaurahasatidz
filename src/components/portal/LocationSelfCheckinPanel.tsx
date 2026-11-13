import React, { useEffect, useState } from "react";
import { Camera, CheckCircle2, ScanLine } from "lucide-react";
import { eventApi, EventApiError } from "@/lib/eventApi";
import { attendanceLabels, type CheckinUnit } from "@/lib/attendance";
import { formatEventDateTime, eventTimezoneLabel } from "@/lib/eventDateTime";
import { parseLocationCheckinLink, type LocationCheckinTarget } from "@/lib/locationCheckin";
import { useQrCamera } from "@/lib/useQrCamera";
import "@/styles/attendance-workspace.css";

export type LocationCheckinResult = {
  status: "SUCCESS"; attendanceRecordId: string; attendanceStatus: string; checkinAt: string;
  attendanceUnit: CheckinUnit; participantCode: string; method: "SELF_SCAN"; timezone: string;
};
type Props = {
  scan: LocationCheckinTarget | null;
  invalidScan?: boolean;
  disabled?: boolean;
  onScan: (scan: LocationCheckinTarget | null) => void;
  onRecorded: (eventId: string, result: LocationCheckinResult) => void;
  participations: Array<{ eventId: string; eventName: string; eligible: boolean }>;
};

export function LocationSelfCheckinPanel({ scan, invalidScan, disabled, onScan, onRecorded, participations }: Props) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LocationCheckinResult | null>(null);
  const [link, setLink] = useState("");
  const match = scan ? participations.find((item) => item.eventId === scan.eventId) : undefined;
  const canScan = !disabled && participations.some((item) => item.eligible);
  const readCode = (value: string) => {
    const next = parseLocationCheckinLink(value, window.location.origin);
    setResult(null); setError("");
    if (!next) { onScan(null); setError("QR ini bukan QR Lokasi. Pindai QR pada layar panitia, bukan kartu QR pribadi."); return; }
    setLink(""); onScan(next);
  };
  const camera = useQrCamera(readCode);
  useEffect(() => { if (scan) { setError(""); setResult(null); camera.stopCamera(); } }, [scan, camera.stopCamera]);

  const record = async () => {
    if (!scan || !match?.eligible || disabled || busy) return;
    setBusy(true); setError("");
    try {
      const saved = await eventApi<LocationCheckinResult>("/portal/self-checkin", { method: "POST", body: JSON.stringify(scan) });
      setResult(saved); onRecorded(scan.eventId, saved); onScan(null);
    } catch (cause) {
      if (cause instanceof EventApiError && cause.status === 409 && cause.message.includes("sudah memiliki catatan")) {
        setError("Kehadiran untuk hari atau sesi ini sudah tercatat. Lihat riwayat di bawah.");
      } else setError(cause instanceof Error ? cause.message : "Kehadiran belum tercatat. Pindai QR terbaru atau hubungi panitia.");
      onScan(null);
    } finally { setBusy(false); }
  };

  return <section className="attendance-panel mb-5" aria-labelledby="location-self-checkin-title">
    <h2 id="location-self-checkin-title">Check-in mandiri</h2>
    {result ? <div role="status" className="attendance-feedback" data-tone="success"><CheckCircle2 className="mr-2 inline h-5 w-5" aria-hidden="true" />
      {attendanceLabels[result.attendanceStatus] || "Kehadiran"} tercatat · {result.attendanceUnit.title} · {formatEventDateTime(result.checkinAt, result.timezone)} {eventTimezoneLabel(result.timezone)}
    </div> : <p>Pindai QR yang ditampilkan panitia untuk mencatat kehadiran Anda pada hari atau sesi tersebut.</p>}
    {(error || camera.cameraError || invalidScan && !scan) && <div role="alert" className="attendance-feedback" data-tone="error">
      {error || camera.cameraError || "Tautan QR Lokasi tidak lengkap. Pindai QR terbaru pada layar panitia."}
    </div>}
    {disabled ? <p>Check-in tidak tersedia pada mode pratinjau.</p> : scan ? <>
      <p>{match?.eligible ? <><strong>{match.eventName}</strong> · QR Lokasi terbaca. Catat sebelum QR kedaluwarsa.</>
        : match ? "Pendaftaran belum memenuhi syarat presensi. Periksa persetujuan dan konfirmasi kehadiran atau hubungi panitia."
          : "Akun ini tidak terdaftar untuk event pada QR tersebut."}</p>
      <div className="attendance-actions"><button className="attendance-control" data-primary type="button" disabled={!match?.eligible || busy} onClick={() => void record()}>
        {busy ? "Mencatat…" : "Catat kehadiran"}</button><button className="attendance-control" type="button" disabled={busy}
          onClick={() => { onScan(null); setError(""); }}>Pindai ulang</button></div>
    </> : canScan ? <>
      <div className="attendance-actions"><button type="button" className="attendance-control" data-primary onClick={() => camera.cameraState === "idle" ? void camera.startCamera() : camera.stopCamera()}>
        <Camera size={17} aria-hidden="true" />{camera.cameraState === "starting" ? "Batalkan kamera" : camera.cameraState === "active" ? "Matikan kamera" : "Pindai QR Lokasi"}</button></div>
      <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); readCode(link); }}>
        <label>Tautan dari aplikasi kamera<input type="password" value={link} onChange={(event) => setLink(event.target.value)}
          maxLength={512} autoComplete="off" spellCheck={false} aria-invalid={Boolean(error) && Boolean(link)} /></label>
        <div className="attendance-actions"><button className="attendance-control" type="submit" disabled={!link.trim()}><ScanLine size={16} aria-hidden="true" /> Periksa tautan</button></div>
      </form>
    </> : <p>Check-in tersedia setelah pendaftaran disetujui dan, bila diwajibkan, Anda sudah mengonfirmasi hadir.</p>}
    <video ref={camera.videoRef} hidden={camera.cameraState !== "active"} playsInline muted aria-label="Kamera QR Lokasi" />
  </section>;
}
