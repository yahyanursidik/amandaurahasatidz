/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
 * genre: modern-minimal · macrostructure: Split Studio · theme: existing emerald-slate
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Camera, CameraOff, CheckCircle2, LockKeyhole, RefreshCw, ScanLine, ShieldCheck } from "lucide-react";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { eventApi, EventApiError } from "@/lib/eventApi";
import { pickCheckinUnit, type CheckinUnit as Unit } from "@/lib/attendance";
import { eventTimezoneLabel, formatEventDateTime } from "@/lib/eventDateTime";
import { useQrCamera } from "@/lib/useQrCamera";
import { AttendanceModeControl, AttendanceRehearsalPanel, AttendanceRehearsalResult } from "@/components/attendance/AttendanceRehearsalPanel";
import { isRehearsalQr, type AttendanceRehearsal } from "@/lib/attendanceRehearsal";
import { attendanceUnitSelection } from "@/lib/attendance";

type KioskSession = { device: { id: string; label: string; deviceExpiresAt: string };
  event: { slug: string; code: string; name: string } };
type CheckinResult = { attendanceUnit: Unit; checkinAt: string; attendanceStatus?: string };
type AttendanceSummary = { unitId: string; total: number; present: number; excused?: number; absent: number };
const isQrToken = (value: string) => /^pqr_[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}$/.test(value.trim());
const dateLabel = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString("id-ID", { dateStyle: "full", timeZone: "UTC" });

export const CheckInPublicPage: React.FC = () => {
  const { eventSlug = "" } = useParams<{ eventSlug: string }>();
  const [params, setParams] = useSearchParams();
  const rehearsal = params.get("mode") === "test";
  const rehearsalRef = useRef(rehearsal); rehearsalRef.current = rehearsal;
  const [session, setSession] = useState<KioskSession | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "locked">("loading");
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState("");
  const [input, setInput] = useState("");
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [testResult, setTestResult] = useState<AttendanceRehearsal | null>(null);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [timezone, setTimezone] = useState("Asia/Jakarta");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pairingRef = useRef<{ slug: string; promise: Promise<unknown> } | null>(null);
  const processingRef = useRef(false);
  const resultTimer = useRef<number>();
  const checkinRequest = useRef<AbortController>();
  const selectedUnit = units.find((unit) => unit.id === unitId);
  const scanAllowed = Boolean(selectedUnit && (rehearsal || selectedUnit.isOpen));

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!eventSlug) return;
    const schedule = await eventApi<{ units: Unit[]; timezone?: string }>(`/gate/events/${eventSlug}/units`, { signal });
    if (signal?.aborted) return;
    setTimezone(schedule.timezone || "Asia/Jakarta");
    setUnits(schedule.units);
    setUnitId((previous) => pickCheckinUnit(schedule.units, previous) || (rehearsalRef.current ? schedule.units[0]?.id || "" : ""));
  }, [eventSlug]);

  const lockIfUnavailable = useCallback((reason: unknown) => {
    if (!(reason instanceof EventApiError) || ![401, 403, 404].includes(reason.status)) return false;
    setState("locked"); setSession(null); setResult(null); setTestResult(null); setSummary(null); setInput(""); setError(reason.message);
    return true;
  }, []);

  useEffect(() => {
    if (!eventSlug) { setState("locked"); setError("Buka tautan kiosk event dari admin."); return; }
    let active = true;
    const controller = new AbortController();
    setState("loading"); setSession(null); setUnits([]); setUnitId(""); setResult(null); setSummary(null); setInput(""); setBusy(false);
    const pairToken = new URLSearchParams(window.location.hash.slice(1)).get("pair");
    if (pairToken) window.history.replaceState(null, "", window.location.pathname + window.location.search);
    const initialize = async () => {
      try {
        if (pairToken) {
          pairingRef.current = { slug: eventSlug, promise: eventApi(`/gate/events/${eventSlug}/pair`, {
            method: "POST", body: JSON.stringify({ pairingToken: pairToken }),
          }) };
        }
        if (pairingRef.current?.slug === eventSlug) await pairingRef.current.promise;
        const current = await eventApi<KioskSession>(`/gate/events/${eventSlug}/session`, { signal: controller.signal });
        if (!active) return;
        await refresh(controller.signal);
        if (active) { setSession(current); setState("ready"); setError(""); }
      } catch (reason) {
        if (active) { setState("locked"); setSession(null);
          setError(reason instanceof Error ? reason.message : "Perangkat kiosk belum diaktifkan."); }
      }
    };
    void initialize();
    return () => { active = false; controller.abort(); checkinRequest.current?.abort(); checkinRequest.current = undefined;
      processingRef.current = false; window.clearTimeout(resultTimer.current); };
  }, [eventSlug, refresh]);

  useEffect(() => {
    if (state !== "ready") return;
    const controller = new AbortController();
    const update = () => { if (!document.hidden) void refresh(controller.signal).catch((reason) => {
      if (!controller.signal.aborted && !lockIfUnavailable(reason)) setError("Jadwal gagal diperbarui. Coba lagi.");
    }); };
    const interval = window.setInterval(update, 45_000);
    document.addEventListener("visibilitychange", update);
    return () => { controller.abort(); window.clearInterval(interval); document.removeEventListener("visibilitychange", update); };
  }, [state, refresh, lockIfUnavailable]);

  useEffect(() => {
    if (state !== "ready" || !selectedUnit || rehearsal) { setSummary(null); return; }
    const controller = new AbortController();
    const update = () => { if (!document.hidden) void eventApi<AttendanceSummary>(`/gate/events/${eventSlug}/summary?unitId=${encodeURIComponent(selectedUnit.id)}`, { signal: controller.signal })
      .then((value) => { if (!controller.signal.aborted) setSummary(value); })
      .catch((reason) => { if (!controller.signal.aborted && !lockIfUnavailable(reason)) setSummary(null); }); };
    update();
    const interval = window.setInterval(update, 20_000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [state, eventSlug, selectedUnit?.id, result?.checkinAt, lockIfUnavailable, rehearsal]);

  const checkin = async (rawToken: string) => {
    if (processingRef.current) return;
    if (!selectedUnit || !scanAllowed) { setError(rehearsal ? "Pilih hari atau sesi untuk diuji." : "Pilih hari atau sesi yang masih membuka absensi."); return; }
    if (!isQrToken(rawToken) && !(rehearsal && isRehearsalQr(rawToken))) { setError(rehearsal ? "Gunakan QR uji atau QR pribadi peserta, bukan tautan lain." : "QR tidak dikenali. Gunakan QR pribadi dari portal peserta. QR uji hanya untuk mode uji."); return; }
    const controller = new AbortController();
    checkinRequest.current = controller;
    window.clearTimeout(resultTimer.current);
    processingRef.current = true; setBusy(true); setError(""); setResult(null); setTestResult(null);
    try {
      const checked = await eventApi<CheckinResult | AttendanceRehearsal>(`/gate/events/${eventSlug}/${rehearsal ? "rehearsal" : "checkin"}`, {
        method: "POST", signal: controller.signal, body: JSON.stringify({ qrToken: rawToken.trim(),
          sessionId: selectedUnit.sessionId, dayId: selectedUnit.type === "DAY" ? selectedUnit.dayId : null }),
      });
      if (controller.signal.aborted) return;
      if (rehearsal) setTestResult({ ...checked as AttendanceRehearsal, participant: undefined });
      else { setResult(checked as CheckinResult); resultTimer.current = window.setTimeout(() => setResult(null), 12_000); }
      setInput(""); camera.stopCamera();
    } catch (reason) {
      if (controller.signal.aborted) return;
      setInput("");
      const message = reason instanceof Error ? reason.message : "Scan gagal. Coba ulangi.";
      if (!(reason instanceof EventApiError) || reason.status !== 401 || !lockIfUnavailable(reason)) setError(message);
    } finally {
      if (checkinRequest.current === controller) { checkinRequest.current = undefined; processingRef.current = false; if (!controller.signal.aborted) setBusy(false); }
    }
  };
  const camera = useQrCamera((value) => { void checkin(value); });
  const cameraActive = camera.cameraState !== "idle";
  useEffect(() => { if (state !== "ready" || !scanAllowed) camera.stopCamera(); }, [state, scanAllowed, camera.stopCamera]);
  useEffect(() => {
    checkinRequest.current?.abort(); checkinRequest.current = undefined; processingRef.current = false;
    camera.stopCamera(); window.clearTimeout(resultTimer.current); setInput(""); setResult(null); setTestResult(null); setError(""); setBusy(false);
  }, [rehearsal, camera.stopCamera]);
  useEffect(() => { if (!busy && result) inputRef.current?.focus({ preventScroll: true }); }, [busy, result]);

  const submit = (event: React.FormEvent) => { event.preventDefault(); void checkin(input); };

  return <PublicLayout wide kiosk><div className="kiosk-page">
    <header className="kiosk-page__heading"><div><p className="kiosk-page__eyebrow"><ShieldCheck size={18} /> Kiosk absensi acara</p>
      <h1>{session?.event.name || "Pemindai QR peserta"}</h1>
      <p>{session ? `${session.event.code} · ${session.device.label}` : "Aktivasi perangkat diperlukan sebelum memindai."}</p></div>
      {state === "ready" && <span className="kiosk-page__live">Perangkat aktif</span>}
    </header>
    {state !== "ready" ? <section className="kiosk-page__locked" aria-live="polite"><LockKeyhole size={32} aria-hidden="true" />
      <h2>{state === "loading" ? "Menyiapkan perangkat…" : "Kiosk belum aktif"}</h2>
      <p>{error || "Minta admin event membuka tautan aktivasi sekali pakai pada perangkat ini."}</p>
      {state === "locked" && <p className="kiosk-page__hint">Admin → Event → Kiosk QR → Buat tautan aktivasi.</p>}
    </section> : <><AttendanceModeControl rehearsal={rehearsal} disabled={busy} onChange={(value) => {
      if (busy) return; camera.stopCamera();
      const next = new URLSearchParams(params); value ? next.set("mode", "test") : next.delete("mode");
      if (value && !unitId) setUnitId(units[0]?.id || ""); setParams(next, { replace: true });
    }} /><div className="kiosk-page__grid">
      <section className="kiosk-page__scan" aria-labelledby="kiosk-scan-title">
        <div className="kiosk-page__section-head"><h2 id="kiosk-scan-title">Pilih hari atau sesi</h2></div>
        <label htmlFor="kiosk-unit">Unit kehadiran</label>
        <select id="kiosk-unit" value={unitId} disabled={busy || cameraActive} onChange={(event) => { setUnitId(event.target.value); setInput(""); setResult(null); setTestResult(null); setError(""); }}>
          <option value="">{units.length ? "Pilih hari atau sesi" : "Belum ada jadwal QR"}</option>
          {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.type === "DAY" ? "Harian" : "Sesi"} · {unit.title} · {unit.isOpen ? "Dibuka" : "Ditutup"}</option>)}
        </select>
        <p className="kiosk-page__unit-state">{selectedUnit ? `${dateLabel(selectedUnit.date)} · ${selectedUnit.isOpen ? "Absensi sedang dibuka" : "Di luar waktu absensi"}` : units.length ? "Pilih unit sebelum memindai." : "Jadwal QR belum diatur. Hubungi admin event."}</p>
        {!rehearsal && selectedUnit && !selectedUnit.isOpen && <p className="kiosk-page__hint">Belum waktunya absensi resmi. Pilih Uji scanner untuk mencoba kamera sekarang tanpa mencatat hadir.</p>}
        {rehearsal && <AttendanceRehearsalPanel key={`${eventSlug}:${unitId}`} disabled={!selectedUnit || busy}
          issue={(signal) => eventApi<AttendanceRehearsal>(`/gate/events/${eventSlug}/rehearsal-qr`, { method: "POST", signal, body: JSON.stringify(selectedUnit ? attendanceUnitSelection(selectedUnit) : {}) }).catch((reason) => { lockIfUnavailable(reason); throw reason; })}
          onUseSample={(token) => { camera.stopCamera(); setInput(token); setTestResult(null); inputRef.current?.focus({ preventScroll: true }); }} />}
        <div className="kiosk-page__section-head kiosk-page__section-head--second"><h2>{rehearsal ? "Pindai untuk menguji" : "Pindai QR pribadi"}</h2></div>
        <div className={`kiosk-page__camera ${result ? "kiosk-page__camera--success" : ""}`}><video ref={camera.videoRef} muted playsInline aria-label="Pratinjau kamera pemindai QR" className={camera.cameraState === "active" ? "" : "kiosk-page__video--hidden"} />
          {result ? <div role="status" aria-live="polite" className="kiosk-page__success"><CheckCircle2 size={42} />
            <h2>{result.attendanceStatus === "LATE" ? "Terlambat tercatat" : "Hadir tercatat"}</h2>
            <p>{result.attendanceUnit.title}</p></div>
            : !cameraActive && <ScanLine size={64} aria-hidden="true" />}</div>
        <button type="button" className="kiosk-page__primary" disabled={busy || !cameraActive && !scanAllowed} onClick={() => { setError(""); setResult(null); setTestResult(null); if (cameraActive) camera.stopCamera(); else void camera.startCamera(); }}>
          {cameraActive ? <CameraOff size={22} /> : <Camera size={22} />}{camera.cameraState === "starting" ? "Batalkan kamera" : cameraActive ? "Matikan kamera" : result ? "Pindai berikutnya" : "Aktifkan kamera"}
        </button>
        <form onSubmit={submit} className="kiosk-page__scanner-input"><label htmlFor="kiosk-qr-input">Pemindai QR USB / tempel token QR</label>
          <div><input id="kiosk-qr-input" ref={inputRef} type="password" autoComplete="off" maxLength={512} value={input} disabled={busy || !scanAllowed}
            onChange={(event) => setInput(event.target.value)} placeholder="Pindai lalu tekan Enter" />
            <button type="submit" disabled={busy || !scanAllowed || !input.trim()}>{busy ? "Memeriksa…" : rehearsal ? "Uji QR" : "Catat hadir"}</button></div>
        </form>
      </section>
      <aside className="kiosk-page__status" aria-label="Status absensi">
        {(error || camera.cameraError) && <div role="alert" className="kiosk-page__error">{error || camera.cameraError}</div>}
        {busy && <div role="status" className="kiosk-page__pending">{rehearsal ? "Memeriksa QR uji tanpa menyimpan kehadiran…" : "Memeriksa QR dan mencatat kehadiran…"}</div>}
        {rehearsal ? testResult ? <AttendanceRehearsalResult result={testResult} /> : <div className="kiosk-page__waiting"><ScanLine size={32} /><h2>Siap menguji</h2><p>Pindai QR contoh atau QR peserta. Hasilnya hanya pemeriksaan, bukan kehadiran.</p></div> : result ? <div className="kiosk-page__last"><h2>Terakhir dicatat</h2>
          <p>{result.attendanceUnit.title} · {formatEventDateTime(result.checkinAt, timezone)} {eventTimezoneLabel(timezone)}</p></div>
          : <div className="kiosk-page__waiting"><ScanLine size={32} /><h2>Siap memindai</h2><p>Arahkan QR peserta ke kamera. Satu QR mencatat satu peserta untuk hari atau sesi terpilih.</p></div>}
        {!rehearsal && <><div className="kiosk-page__counts"><div><span>Sudah hadir</span><strong>{summary?.unitId === unitId ? summary?.present ?? "—" : "—"}</strong></div><div><span>Belum hadir</span><strong>{summary?.unitId === unitId ? summary?.absent ?? "—" : "—"}</strong></div></div>
        {summary?.unitId === unitId && Boolean(summary?.excused) && <p>{summary?.excused} peserta tercatat izin.</p>}</>}
        <button type="button" className="kiosk-page__refresh" onClick={() => void refresh().catch((reason) => { if (!lockIfUnavailable(reason)) setError("Jadwal gagal diperbarui."); })}><RefreshCw size={18} /> Perbarui jadwal</button>
        <p className="kiosk-page__hint">Jika QR tidak terbaca, minta petugas mencari nama atau kode Anda di Scanner Peserta.</p>
      </aside>
    </div></>}
  </div></PublicLayout>;
};
