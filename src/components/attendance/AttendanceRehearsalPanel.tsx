/* Hallmark · component: rehearsal tools · genre: modern-minimal · theme: existing emerald-slate
 * states: default · hover · focus · active · disabled · loading · error · success
 * pre-emit critique: P5 H5 E5 S5 R5 V4
 */
import React, { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Copy, Download, FlaskConical, RefreshCw } from "lucide-react";
import type { AttendanceRehearsal } from "@/lib/attendanceRehearsal";
import "@/styles/attendance-rehearsal.css";

export function AttendanceModeControl({ rehearsal, onChange, disabled = false }: {
  rehearsal: boolean; onChange: (value: boolean) => void; disabled?: boolean;
}) {
  return <section className="attendance-test-mode" aria-label="Mode scanner">
    <div className="attendance-test-mode__controls" role="group" aria-label="Pilih mode scanner">
      <button type="button" aria-pressed={!rehearsal} disabled={disabled} onClick={() => onChange(false)}>Absensi resmi</button>
      <button type="button" aria-pressed={rehearsal} disabled={disabled} onClick={() => onChange(true)}><FlaskConical size={18} aria-hidden="true" />Uji scanner</button>
    </div>
    {rehearsal ? <div className="attendance-test-mode__notice" role="status"><strong>MODE UJI · Tidak mencatat kehadiran</strong><p>Bisa dicoba sebelum acara. Hasil uji tidak masuk rekap, rapor, atau email peserta.</p></div>
      : <p className="attendance-test-mode__hint">Mode resmi menyimpan presensi sesuai jadwal. Untuk persiapan sebelum acara, pilih Uji scanner.</p>}
  </section>;
}

export function AttendanceRehearsalResult({ result }: { result: AttendanceRehearsal }) {
  return <section className="attendance-test-result" aria-label="Hasil uji scanner" role="status">
    <h2><CheckCircle2 size={22} aria-hidden="true" />{result.status === "TEST_BLOCKED" ? "Uji selesai · QR belum layak" : "QR terbaca · uji berhasil"}</h2>
    <p>Tidak ada kehadiran yang disimpan.</p>
    {result.participant && <p>{result.participant.ustadzName} {result.participant.participantCode && `· ${result.participant.participantCode}`}</p>}
    {result.synthetic && <p>Ini QR contoh, bukan kartu peserta.</p>}
    <h3>Jika absensi resmi dilakukan sekarang</h3>
    {result.blockers.length ? <ul>{result.blockers.map((blocker, index) => <li key={`${blocker.code}:${index}`}>{blocker.message}</li>)}</ul>
      : <p>Syarat peserta dan jadwal saat diperiksa terpenuhi. Mode resmi tetap memeriksa ulang saat mencatat.</p>}
  </section>;
}

export function AttendanceRehearsalPanel({ issue, disabled, onUseSample }: {
  issue: (signal: AbortSignal) => Promise<AttendanceRehearsal>;
  disabled?: boolean;
  onUseSample?: (token: string) => void;
}) {
  const [sample, setSample] = useState<AttendanceRehearsal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(Date.now());
  const request = useRef<AbortController>();
  const qrRef = useRef<HTMLDivElement>(null);
  const expired = Boolean(sample?.expiresAt && new Date(sample.expiresAt).getTime() <= now);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => { window.clearInterval(timer); request.current?.abort(); }; }, []);
  const generate = async () => {
    if (busy || disabled) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(""); setNotice("");
    try { const value = await issue(controller.signal); if (!controller.signal.aborted) { setSample(value); setNow(Date.now()); } }
    catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "QR uji belum dapat dibuat."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  const copy = async () => {
    if (!sample?.qrToken || expired) return;
    try { await navigator.clipboard.writeText(sample.qrToken); setNotice("Token uji disalin. Tempel pada kolom pemindai dalam mode uji."); }
    catch { setError("Token belum tersalin. Gunakan tombol Isi kolom uji atau simpan QR."); }
  };
  const save = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg || expired) return;
    const namespace = "http://www.w3.org/2000/svg";
    const exportSvg = document.createElementNS(namespace, "svg");
    exportSvg.setAttribute("xmlns", namespace); exportSvg.setAttribute("viewBox", "0 0 340 430");
    exportSvg.setAttribute("width", "680"); exportSvg.setAttribute("height", "860");
    const paper = document.createElementNS(namespace, "rect");
    paper.setAttribute("width", "340"); paper.setAttribute("height", "430"); paper.setAttribute("fill", "white"); exportSvg.append(paper);
    const label = (value: string, y: number, size: number, bold = false) => {
      const text = document.createElementNS(namespace, "text");
      text.textContent = value; text.setAttribute("x", "170"); text.setAttribute("y", String(y));
      text.setAttribute("text-anchor", "middle"); text.setAttribute("font-family", "Arial, sans-serif");
      text.setAttribute("font-size", String(size)); text.setAttribute("fill", "black");
      if (bold) text.setAttribute("font-weight", "700");
      if (value.length > 37) { text.setAttribute("textLength", "300"); text.setAttribute("lengthAdjust", "spacingAndGlyphs"); }
      exportSvg.append(text);
    };
    label("QR UJI", 29, 22, true); label("BUKAN PRESENSI", 55, 16, true);
    const qr = svg.cloneNode(true) as SVGSVGElement;
    qr.setAttribute("x", "30"); qr.setAttribute("y", "76"); qr.setAttribute("width", "280"); qr.setAttribute("height", "280"); exportSvg.append(qr);
    label(sample?.attendanceUnit.title || "Uji scanner", 380, 15, true);
    label(sample?.attendanceUnit.date || "", 401, 13);
    label("Tidak berlaku untuk absensi resmi", 420, 12);
    const serialized = new XMLSerializer().serializeToString(exportSvg);
    const url = URL.createObjectURL(new Blob([serialized], { type: "image/svg+xml;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "QR-UJI-bukan-presensi.svg"; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("QR uji disimpan. Buka di perangkat lain untuk menguji kamera.");
  };
  return <section className="attendance-test-tools" aria-label="QR contoh untuk pengujian">
    <h2>Siapkan QR contoh</h2>
    <p>Tidak perlu data peserta. Buka QR ini di perangkat lain untuk mencoba kamera atau pemindai USB.</p>
    <button type="button" onClick={() => void generate()} disabled={disabled || busy}><RefreshCw size={18} aria-hidden="true" />{busy ? "Menyiapkan…" : sample ? "Perbarui QR uji" : "Buat QR uji"}</button>
    {disabled && <p>Pilih hari atau sesi dahulu.</p>}
    {error && <p role="alert" className="attendance-test-tools__error">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {sample?.qrToken && <div className="attendance-test-tools__sample">
      <strong>QR UJI · BUKAN PRESENSI</strong>
      <div ref={qrRef}><QRCodeSVG value={sample.qrToken} size={260} marginSize={4} level="M" title="QR uji scanner, bukan kartu peserta" /></div>
      <p>{expired ? "QR uji kedaluwarsa. Buat yang baru sebelum mencoba lagi." : "Berlaku 30 menit, hanya untuk hari/sesi yang dipilih."}</p>
      <div className="attendance-test-tools__actions">
        <button type="button" onClick={save} disabled={expired}><Download size={16} aria-hidden="true" />Simpan QR uji</button>
        <button type="button" onClick={() => void copy()} disabled={expired}><Copy size={16} aria-hidden="true" />Salin token</button>
        {onUseSample && <button type="button" disabled={expired} onClick={() => onUseSample(sample.qrToken!)}>Isi kolom uji</button>}
      </div>
    </div>}
  </section>;
}
