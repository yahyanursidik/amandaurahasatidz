/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
 * genre: modern-minimal · macrostructure: Split Studio · theme: existing emerald-slate
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Camera, CameraOff, CheckCircle2, LockKeyhole, RefreshCw, ScanLine, ShieldCheck } from "lucide-react";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { eventApi } from "@/lib/eventApi";

type Unit = { id: string; type: "DAY" | "SESSION"; dayId: string; sessionId: string | null;
  title: string; date: string; isOpen: boolean; openAt: string; closeAt: string };
type KioskSession = { device: { id: string; label: string; deviceExpiresAt: string };
  event: { slug: string; code: string; name: string } };
type CheckinResult = { participant: { ustadzName: string; institutionName: string | null };
  attendanceUnit: Unit; checkinAt: string };
type AttendanceSummary = { unitId: string; total: number; present: number; absent: number };
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
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pairingRef = useRef<Promise<unknown> | null>(null);
  const processingRef = useRef(false);
  const scanHandlerRef = useRef<(code: string) => void>(() => {});
  const selectedUnit = units.find((unit) => unit.id === unitId);

  const refresh = useCallback(async () => {
    if (!eventSlug) return;
    const schedule = await eventApi<{ units: Unit[] }>(`/gate/events/${eventSlug}/units`);
    setUnits(schedule.units);
    setUnitId((previous) => schedule.units.find((unit) => unit.id === previous)?.id ||
      schedule.units.find((unit) => unit.isOpen)?.id || schedule.units[0]?.id || "");
  }, [eventSlug]);

  useEffect(() => {
    if (!eventSlug) { setState("locked"); setError("Buka tautan kiosk event dari admin."); return; }
    let active = true;
    const pairToken = new URLSearchParams(window.location.hash.slice(1)).get("pair");
    if (pairToken) window.history.replaceState(null, "", window.location.pathname + window.location.search);
    const initialize = async () => {
      try {
        if (pairToken) {
          if (!pairingRef.current) pairingRef.current = eventApi(`/gate/events/${eventSlug}/pair`, {
            method: "POST", body: JSON.stringify({ pairingToken: pairToken }),
          });
          await pairingRef.current;
        } else if (pairingRef.current) await pairingRef.current;
        const current = await eventApi<KioskSession>(`/gate/events/${eventSlug}/session`);
        if (!active) return;
        setSession(current); setState("ready"); setError("");
        await refresh();
      } catch (reason) {
        if (active) { setState("locked"); setSession(null);
          setError(reason instanceof Error ? reason.message : "Perangkat kiosk belum diaktifkan."); }
      }
    };
    void initialize();
    return () => { active = false; };
  }, [eventSlug, refresh]);

  useEffect(() => {
    if (state !== "ready") return;
    const interval = window.setInterval(() => { void refresh().catch(() => setError("Jadwal gagal diperbarui. Coba lagi.")); }, 60_000);
    return () => window.clearInterval(interval);
  }, [state, refresh]);

  useEffect(() => {
    if (state !== "ready" || !selectedUnit) { setSummary(null); return; }
    let active = true;
    const update = () => void eventApi<AttendanceSummary>(`/gate/events/${eventSlug}/summary?unitId=${encodeURIComponent(selectedUnit.id)}`)
      .then((value) => { if (active) setSummary(value); })
      .catch(() => { if (active) setSummary(null); });
    update();
    const interval = window.setInterval(update, 20_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [state, eventSlug, selectedUnit?.id, result]);

  const checkin = async (rawToken: string) => {
    if (processingRef.current) return;
    if (!selectedUnit?.isOpen) { setError("Pilih hari atau sesi yang masih membuka absensi."); return; }
    if (!isQrToken(rawToken)) { setError("QR tidak dikenali. Gunakan QR pribadi dari bukti pendaftaran."); return; }
    processingRef.current = true; setBusy(true); setError(""); setResult(null);
    try {
      const checked = await eventApi<CheckinResult>(`/gate/events/${eventSlug}/checkin`, {
        method: "POST", body: JSON.stringify({ qrToken: rawToken.trim(),
          sessionId: selectedUnit.sessionId, dayId: selectedUnit.type === "DAY" ? selectedUnit.dayId : null }),
      });
      setResult(checked); setInput(""); setCameraActive(false);
      window.setTimeout(() => setResult(null), 12_000);
      inputRef.current?.focus();
    } catch (reason) {
      setInput("");
      const message = reason instanceof Error ? reason.message : "Scan gagal. Coba ulangi.";
      if (/kiosk|diaktifkan|dicabut|kedaluwarsa/i.test(message)) { setState("locked"); setSession(null); setCameraActive(false); }
      setError(message);
    } finally { processingRef.current = false; setBusy(false); }
  };
  scanHandlerRef.current = (code) => { void checkin(code); };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !cameraActive) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let interval: number | null = null;
    const Detector = (window as typeof window & { BarcodeDetector?: new (options: { formats: string[] }) => {
      detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setCameraActive(false); setError("Kamera tidak didukung browser ini. Gunakan pemindai QR USB atau browser lain."); return;
    }
    void navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then(async (media) => {
        if (stopped) { media.getTracks().forEach((track) => track.stop()); return; }
        stream = media; video.srcObject = media; await video.play();
        const detector = new Detector({ formats: ["qr_code"] });
        let scanning = false;
        interval = window.setInterval(async () => {
          if (scanning || stopped) return;
          scanning = true;
          try {
            const code = (await detector.detect(video))[0]?.rawValue?.trim();
            if (code) { stopped = true; if (interval !== null) window.clearInterval(interval);
              setCameraActive(false); scanHandlerRef.current(code); }
          } catch { /* Bingkai tanpa QR adalah kondisi biasa. */ }
          finally { scanning = false; }
        }, 350);
      }).catch(() => { setCameraActive(false); setError("Kamera tidak dapat dibuka. Periksa izin browser."); });
    return () => { stopped = true; if (interval !== null) window.clearInterval(interval);
      stream?.getTracks().forEach((track) => track.stop()); video.srcObject = null; };
  }, [cameraActive]);

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
          {units.length ? units.map((unit) => <option key={unit.id} value={unit.id}>{unit.type === "DAY" ? "Harian" : "Sesi"} · {unit.title} · {unit.isOpen ? "Dibuka" : "Ditutup"}</option>) : <option value="">Belum ada jadwal</option>}
        </select>
        <p className="kiosk-page__unit-state">{selectedUnit ? `${dateLabel(selectedUnit.date)} · ${selectedUnit.isOpen ? "Absensi sedang dibuka" : "Di luar waktu absensi"}` : "Jadwal kehadiran belum diatur."}</p>
        <div className="kiosk-page__section-head kiosk-page__section-head--second"><h2>Pindai QR pribadi</h2></div>
        <div className={`kiosk-page__camera ${result ? "kiosk-page__camera--success" : ""}`}><video ref={videoRef} muted playsInline aria-label="Pratinjau kamera pemindai QR" className={cameraActive ? "" : "kiosk-page__video--hidden"} />
          {result ? <div role="status" aria-live="polite" className="kiosk-page__success"><CheckCircle2 size={42} />
            <h2>Hadir tercatat</h2><strong>{result.participant.ustadzName}</strong>
            {result.participant.institutionName && <p>{result.participant.institutionName}</p>}
            <p>{result.attendanceUnit.title}</p></div>
            : !cameraActive && <ScanLine size={64} aria-hidden="true" />}</div>
        <button type="button" className="kiosk-page__primary" disabled={busy || !selectedUnit?.isOpen} onClick={() => { setError(""); setResult(null); setCameraActive((value) => !value); }}>
          {cameraActive ? <CameraOff size={22} /> : <Camera size={22} />}{cameraActive ? "Matikan kamera" : result ? "Pindai berikutnya" : "Aktifkan kamera"}
        </button>
        <form onSubmit={submit} className="kiosk-page__scanner-input"><label htmlFor="kiosk-qr-input">Pemindai QR USB / tempel token QR</label>
          <div><input id="kiosk-qr-input" ref={inputRef} type="password" autoComplete="off" value={input} disabled={busy || !selectedUnit?.isOpen}
            onChange={(event) => setInput(event.target.value)} placeholder="Pindai lalu tekan Enter" />
            <button type="submit" disabled={busy || !selectedUnit?.isOpen || !input.trim()}>Catat hadir</button></div>
        </form>
      </section>
      <aside className="kiosk-page__status" aria-label="Status absensi">
        {error && <div role="alert" className="kiosk-page__error">{error}</div>}
        {busy && <div role="status" className="kiosk-page__pending">Memeriksa QR dan mencatat kehadiran…</div>}
        {result ? <div className="kiosk-page__last"><h2>Terakhir dicatat</h2>
          <p>{result.attendanceUnit.title} · {new Date(result.checkinAt).toLocaleString("id-ID")}</p></div>
          : <div className="kiosk-page__waiting"><ScanLine size={32} /><h2>Siap memindai</h2><p>Arahkan QR peserta ke kamera. Satu QR mencatat satu peserta untuk hari atau sesi terpilih.</p></div>}
        <div className="kiosk-page__counts"><div><span>Sudah hadir</span><strong>{summary?.present ?? "—"}</strong></div><div><span>Belum hadir</span><strong>{summary?.absent ?? "—"}</strong></div></div>
        <button type="button" className="kiosk-page__refresh" onClick={() => void refresh().catch(() => setError("Jadwal gagal diperbarui."))}><RefreshCw size={18} /> Perbarui jadwal</button>
        <p className="kiosk-page__hint">Koreksi manual dan pencarian peserta hanya tersedia pada portal panitia.</p>
      </aside>
    </div>}
  </div></PublicLayout>;
};
