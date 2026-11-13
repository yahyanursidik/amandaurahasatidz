/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
 * genre: modern-minimal · macrostructure: Split Studio · theme: existing emerald-slate
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Camera, CameraOff, CheckCircle2, LockKeyhole, RefreshCw, ScanLine, ShieldCheck } from "lucide-react";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { eventApi, EventApiError } from "@/lib/eventApi";
import { pickCheckinUnit, type CheckinUnit as Unit } from "@/lib/attendance";
import { eventTimezoneLabel, formatEventDateTime } from "@/lib/eventDateTime";
import { useQrCamera } from "@/lib/useQrCamera";

type KioskSession = { device: { id: string; label: string; deviceExpiresAt: string };
  event: { slug: string; code: string; name: string } };
type CheckinResult = { attendanceUnit: Unit; checkinAt: string; attendanceStatus?: string };
type AttendanceSummary = { unitId: string; total: number; present: number; excused?: number; absent: number };
const isQrToken = (value: string) => /^pqr_[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}$/.test(value.trim());
const dateLabel = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString("id-ID", { dateStyle: "full", timeZone: "UTC" });

export const CheckInPublicPage: React.FC = () => {
  const { eventSlug = "" } = useParams<{ eventSlug: string }>();
  const [session, setSession] = useState<KioskSession | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "locked">("loading");
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState("");
  const [input, setInput] = useState("");
  const [result, setResult] = useState<CheckinResult | null>(null);
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

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!eventSlug) return;
    const schedule = await eventApi<{ units: Unit[]; timezone?: string }>(`/gate/events/${eventSlug}/units`, { signal });
    if (signal?.aborted) return;
    setTimezone(schedule.timezone || "Asia/Jakarta");
    setUnits(schedule.units);
    setUnitId((previous) => pickCheckinUnit(schedule.units, previous));
  }, [eventSlug]);

  const lockIfUnavailable = useCallback((reason: unknown) => {
    if (!(reason instanceof EventApiError) || ![401, 403, 404].includes(reason.status)) return false;
    setState("locked"); setSession(null); setResult(null); setSummary(null); setInput(""); setError(reason.message);
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
    if (state !== "ready" || !selectedUnit) { setSummary(null); return; }
    const controller = new AbortController();
    const update = () => { if (!document.hidden) void eventApi<AttendanceSummary>(`/gate/events/${eventSlug}/summary?unitId=${encodeURIComponent(selectedUnit.id)}`, { signal: controller.signal })
      .then((value) => { if (!controller.signal.aborted) setSummary(value); })
      .catch((reason) => { if (!controller.signal.aborted && !lockIfUnavailable(reason)) setSummary(null); }); };
    update();
    const interval = window.setInterval(update, 20_000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [state, eventSlug, selectedUnit?.id, result?.checkinAt, lockIfUnavailable]);

  const checkin = async (rawToken: string) => {
    if (processingRef.current) return;
    if (!selectedUnit?.isOpen) { setError("Pilih hari atau sesi yang masih membuka absensi."); return; }
    if (!isQrToken(rawToken)) { setError("QR tidak dikenali. Gunakan QR pribadi dari bukti pendaftaran."); return; }
    const controller = new AbortController();
    checkinRequest.current = controller;
    window.clearTimeout(resultTimer.current);
    processingRef.current = true; setBusy(true); setError(""); setResult(null);
    try {
      const checked = await eventApi<CheckinResult>(`/gate/events/${eventSlug}/checkin`, {
        method: "POST", signal: controller.signal, body: JSON.stringify({ qrToken: rawToken.trim(),
          sessionId: selectedUnit.sessionId, dayId: selectedUnit.type === "DAY" ? selectedUnit.dayId : null }),
      });
      if (controller.signal.aborted) return;
      setResult(checked); setInput(""); camera.stopCamera();
      resultTimer.current = window.setTimeout(() => setResult(null), 12_000);
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
  useEffect(() => { if (state !== "ready" || !selectedUnit?.isOpen) camera.stopCamera(); }, [state, selectedUnit?.isOpen, camera.stopCamera]);
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
    </section> : <div className="kiosk-page__grid">
      <section className="kiosk-page__scan" aria-labelledby="kiosk-scan-title">
        <div className="kiosk-page__section-head"><h2 id="kiosk-scan-title">Pilih hari atau sesi</h2></div>
        <label htmlFor="kiosk-unit">Unit kehadiran</label>
        <select id="kiosk-unit" value={unitId} disabled={busy || cameraActive} onChange={(event) => { setUnitId(event.target.value); setResult(null); setError(""); }}>
          <option value="">{units.length ? "Pilih hari atau sesi" : "Belum ada jadwal QR"}</option>
          {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.type === "DAY" ? "Harian" : "Sesi"} · {unit.title} · {unit.isOpen ? "Dibuka" : "Ditutup"}</option>)}
        </select>
        <p className="kiosk-page__unit-state">{selectedUnit ? `${dateLabel(selectedUnit.date)} · ${selectedUnit.isOpen ? "Absensi sedang dibuka" : "Di luar waktu absensi"}` : units.length ? "Pilih unit sebelum memindai." : "Jadwal QR belum diatur. Hubungi admin event."}</p>
        <div className="kiosk-page__section-head kiosk-page__section-head--second"><h2>Pindai QR pribadi</h2></div>
        <div className={`kiosk-page__camera ${result ? "kiosk-page__camera--success" : ""}`}><video ref={camera.videoRef} muted playsInline aria-label="Pratinjau kamera pemindai QR" className={camera.cameraState === "active" ? "" : "kiosk-page__video--hidden"} />
          {result ? <div role="status" aria-live="polite" className="kiosk-page__success"><CheckCircle2 size={42} />
            <h2>{result.attendanceStatus === "LATE" ? "Terlambat tercatat" : "Hadir tercatat"}</h2>
            <p>{result.attendanceUnit.title}</p></div>
            : !cameraActive && <ScanLine size={64} aria-hidden="true" />}</div>
        <button type="button" className="kiosk-page__primary" disabled={busy || !cameraActive && !selectedUnit?.isOpen} onClick={() => { setError(""); setResult(null); if (cameraActive) camera.stopCamera(); else void camera.startCamera(); }}>
          {cameraActive ? <CameraOff size={22} /> : <Camera size={22} />}{camera.cameraState === "starting" ? "Batalkan kamera" : cameraActive ? "Matikan kamera" : result ? "Pindai berikutnya" : "Aktifkan kamera"}
        </button>
        <form onSubmit={submit} className="kiosk-page__scanner-input"><label htmlFor="kiosk-qr-input">Pemindai QR USB / tempel token QR</label>
          <div><input id="kiosk-qr-input" ref={inputRef} type="password" autoComplete="off" maxLength={512} value={input} disabled={busy || !selectedUnit?.isOpen}
            onChange={(event) => setInput(event.target.value)} placeholder="Pindai lalu tekan Enter" />
            <button type="submit" disabled={busy || !selectedUnit?.isOpen || !input.trim()}>Catat hadir</button></div>
        </form>
      </section>
      <aside className="kiosk-page__status" aria-label="Status absensi">
        {(error || camera.cameraError) && <div role="alert" className="kiosk-page__error">{error || camera.cameraError}</div>}
        {busy && <div role="status" className="kiosk-page__pending">Memeriksa QR dan mencatat kehadiran…</div>}
        {result ? <div className="kiosk-page__last"><h2>Terakhir dicatat</h2>
          <p>{result.attendanceUnit.title} · {formatEventDateTime(result.checkinAt, timezone)} {eventTimezoneLabel(timezone)}</p></div>
          : <div className="kiosk-page__waiting"><ScanLine size={32} /><h2>Siap memindai</h2><p>Arahkan QR peserta ke kamera. Satu QR mencatat satu peserta untuk hari atau sesi terpilih.</p></div>}
        <div className="kiosk-page__counts"><div><span>Sudah hadir</span><strong>{summary?.unitId === unitId ? summary?.present ?? "—" : "—"}</strong></div><div><span>Belum hadir</span><strong>{summary?.unitId === unitId ? summary?.absent ?? "—" : "—"}</strong></div></div>
        {summary?.unitId === unitId && Boolean(summary?.excused) && <p>{summary?.excused} peserta tercatat izin.</p>}
        <button type="button" className="kiosk-page__refresh" onClick={() => void refresh().catch((reason) => { if (!lockIfUnavailable(reason)) setError("Jadwal gagal diperbarui."); })}><RefreshCw size={18} /> Perbarui jadwal</button>
        <p className="kiosk-page__hint">Jika QR tidak terbaca, minta petugas mencari nama atau kode Anda di Scanner Peserta.</p>
      </aside>
    </div>}
  </div></PublicLayout>;
};
