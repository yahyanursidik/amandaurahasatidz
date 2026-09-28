import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Camera, CameraOff, CheckCircle2, RefreshCw, ScanLine, Search } from "lucide-react";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { committeeApi, type CommitteeAssignment } from "@/lib/committeeApi";

type Unit = { id: string; type: "DAY" | "SESSION"; dayId: string; sessionId: string | null;
  title: string; date: string; isOpen: boolean; openAt: string; closeAt: string };
type Candidate = { id: string; participantCode: string; ustadzName: string; institutionName: string | null;
  approvalStatus: string; confirmationStatus: string };

export const CheckInPublicPage: React.FC = () => {
  const { eventSlug } = useParams<{ eventSlug: string }>();
  const [assignments, setAssignments] = useState<CommitteeAssignment[]>([]);
  const [eventId, setEventId] = useState("");
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState("");
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const selectedUnit = units.find((unit) => unit.id === unitId);

  useEffect(() => {
    void committeeApi<{ assignments: CommitteeAssignment[] }>("/committee/context")
      .then((context) => {
        const allowed = context.assignments.filter((item) => item.effectivePermissions?.includes("attendance.record"));
        setAssignments(allowed);
        setEventId((allowed.find((item) => item.eventSlug === eventSlug) || allowed[0])?.eventId || "");
        if (!allowed.length) setError("Akun ini belum mendapat penugasan check-in. Hubungi admin event.");
        else if (eventSlug && !allowed.some((item) => item.eventSlug === eventSlug)) setError("Anda tidak ditugaskan pada event dari tautan ini. Pilih event penugasan yang tersedia.");
      }).catch((reason) => setError(reason instanceof Error ? reason.message : "Penugasan gate gagal dimuat."));
  }, [eventSlug]);

  const refresh = async () => {
    if (!eventId) return;
    try {
      const result = await committeeApi<{ units: Unit[] }>(`/events/${eventId}/sessions/active`);
      setUnits(result.units);
      setUnitId((previous) => result.units.find((item) => item.id === previous)?.id || result.units.find((item) => item.isOpen)?.id || result.units[0]?.id || "");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Jadwal check-in gagal dimuat."); }
  };
  useEffect(() => { void refresh(); }, [eventId]);

  useEffect(() => {
    if (query.trim().length < 2 || !eventId) { setCandidates([]); return; }
    let active = true;
    const timer = window.setTimeout(() => {
      void committeeApi<Candidate[]>(`/events/${eventId}/checkin/search?q=${encodeURIComponent(query.trim())}`)
        .then((result) => { if (active) setCandidates(result); })
        .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Pencarian peserta gagal."); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, eventId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !cameraActive) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let interval: number | null = null;
    const Decoder = (window as typeof window & { BarcodeDetector?: new (options: { formats: string[] }) => {
      detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
    if (!Decoder || !navigator.mediaDevices?.getUserMedia) { setError("Pemindai kamera tidak tersedia di browser ini. Gunakan kode atau cari nama peserta."); setCameraActive(false); return; }
    void navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then(async (media) => {
        if (stopped) { media.getTracks().forEach((track) => track.stop()); return; }
        stream = media; video.srcObject = media; await video.play();
        const detector = new Decoder({ formats: ["qr_code"] });
        let scanning = false;
        interval = window.setInterval(async () => {
          if (scanning || stopped) return;
          scanning = true;
          try { const code = (await detector.detect(video))[0]?.rawValue?.trim();
            if (code) { setInput(code); setSelected(null); setCameraActive(false); setMessage("QR terbaca. Periksa unit kehadiran lalu tekan Catat kehadiran."); }
          } catch { /* Frame tanpa QR adalah kondisi normal. */ }
          finally { scanning = false; }
        }, 350);
      }).catch((reason) => { setCameraActive(false); setError(reason instanceof Error ? reason.message : "Kamera tidak dapat dibuka."); });
    return () => { stopped = true; if (interval !== null) window.clearInterval(interval);
      stream?.getTracks().forEach((track) => track.stop()); video.srcObject = null; };
  }, [cameraActive]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setMessage("");
    if (!selectedUnit?.isOpen) { setError("Pilih unit kehadiran yang masih dibuka."); return; }
    if (!input.trim()) return;
    setBusy(true);
    try {
      const latest = await committeeApi<{ units: Unit[] }>(`/events/${eventId}/sessions/active`);
      if (!latest.units.find((unit) => unit.id === unitId)?.isOpen) { setUnits(latest.units); throw new Error("Jendela check-in telah berubah. Pilih unit yang masih dibuka."); }
      const result = await committeeApi<{ participant: { ustadzName: string; participantCode: string }; attendanceUnit: Unit }>(`/events/${eventId}/checkin`, {
        method: "POST", body: JSON.stringify({ qrTokenOrCode: input.trim(), method: selected ? "SEARCH_SELECT" : input.trim().startsWith("pqr_") ? "QR_SCAN" : "MANUAL_CODE",
          sessionId: selectedUnit.sessionId, dayId: selectedUnit.type === "DAY" ? selectedUnit.dayId : null }),
      });
      setMessage(`${result.participant.ustadzName} (${result.participant.participantCode}) tercatat di ${result.attendanceUnit.title}.`);
      setInput(""); setQuery(""); setCandidates([]); setSelected(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Check-in gagal."); }
    finally { setBusy(false); }
  };

  return <PublicLayout wide><div className="mx-auto max-w-4xl space-y-5 pb-8">
    <header className="rounded-xl bg-slate-950 p-5 text-white sm:p-7"><p className="text-xs font-black uppercase tracking-widest text-emerald-300">Gate panitia · akses petugas</p><h1 className="mt-2 text-2xl font-black">Check-in cepat peserta</h1><p className="mt-2 text-sm text-slate-300">Pindai QR pribadi, ketik kode peserta, atau cari nama. Kehadiran dicatat hanya sesudah petugas memilih identitas dan unit yang benar.</p></header>
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><Link to="/committee" className="font-bold text-emerald-800 underline">Portal panitia</Link><button type="button" onClick={() => void refresh()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3"><RefreshCw className="h-4 w-4" /> Perbarui jadwal</button></div>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-900">{error}</div>}
    {message && <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-950"><CheckCircle2 className="h-5 w-5 shrink-0" />{message}</div>}
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <form onSubmit={(event) => void submit(event)} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <label className="block text-sm font-bold">Event penugasan<select value={eventId} onChange={(change) => { setCameraActive(false); setEventId(change.target.value); setUnits([]); setUnitId(""); setInput(""); setQuery(""); setCandidates([]); setSelected(null); }} className="mt-2 min-h-12 w-full rounded-lg border border-slate-300 px-3">{assignments.length ? assignments.map((item) => <option key={item.eventId} value={item.eventId}>{item.eventCode} · {item.eventName}</option>) : <option value="">Belum ada penugasan</option>}</select></label>
        <label className="block text-sm font-bold">Hari / sesi kehadiran<select value={unitId} onChange={(change) => setUnitId(change.target.value)} className="mt-2 min-h-12 w-full rounded-lg border border-slate-300 px-3">{units.length ? units.map((unit) => <option key={unit.id} value={unit.id}>{unit.type === "DAY" ? "Harian" : "Sesi"} · {unit.title} · {unit.isOpen ? "DIBUKA" : "DITUTUP"}</option>) : <option value="">Belum ada unit check-in</option>}</select></label>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">{selectedUnit ? `${selectedUnit.date} · ${selectedUnit.title} · ${selectedUnit.isOpen ? "Bisa check-in" : "Belum dibuka / sudah ditutup"}` : "Pilih unit kehadiran terlebih dahulu."}</div>
        <label className="block text-sm font-bold">Token QR / kode peserta<input value={input} onChange={(change) => { setInput(change.target.value); setSelected(null); }} autoComplete="off" placeholder="Pindai QR atau ketik kode P-…" className="mt-2 min-h-12 w-full rounded-lg border border-slate-300 px-3 font-mono text-base" /></label>
        {selected && <p className="text-sm text-emerald-900">Dipilih: <strong>{selected.ustadzName} · {selected.participantCode}</strong></p>}
        <button type="submit" disabled={busy || !selectedUnit?.isOpen || !input.trim()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 font-black text-white disabled:opacity-50"><ScanLine className="h-5 w-5" />{busy ? "Mencatat…" : "Catat kehadiran"}</button>
        <p className="text-xs text-slate-600">Pencatatan ganda pada hari/sesi yang sama ditolak otomatis. Status persetujuan dan jendela check-in diverifikasi server.</p>
      </form>
      <aside className="space-y-4"><div className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="font-black">Pindai kamera</h2><p className="mt-1 text-xs text-slate-600">Kamera hanya membaca QR peserta dan tidak menyimpan gambar.</p><button type="button" onClick={() => setCameraActive((value) => !value)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-bold">{cameraActive ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}{cameraActive ? "Matikan kamera" : "Aktifkan kamera"}</button><video ref={videoRef} muted playsInline aria-label="Pratinjau kamera gate" className={`${cameraActive ? "mt-3 block" : "hidden"} max-h-48 w-full rounded-lg bg-slate-950 object-cover`} /></div>
      <div className="rounded-xl border border-slate-200 bg-white p-4"><label className="text-sm font-bold">Cari nama peserta<div className="relative mt-2"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" /><input value={query} onChange={(change) => setQuery(change.target.value)} placeholder="Ketik min. 2 huruf" className="min-h-11 w-full rounded-lg border border-slate-300 pl-10 pr-2 text-sm" /></div></label><p className="mt-2 text-xs text-slate-600">Pilih satu hasil yang tepat sebelum check-in.</p><ul className="mt-3 max-h-64 divide-y divide-slate-100 overflow-y-auto">{candidates.map((person) => <li key={person.id}><button type="button" onClick={() => { setSelected(person); setInput(person.participantCode); }} className="w-full py-2 text-left text-sm hover:text-emerald-800"><strong>{person.ustadzName}</strong><span className="block text-xs text-slate-500">{person.participantCode} · {person.institutionName || "Individu"} · {person.approvalStatus}</span></button></li>)}</ul></div></aside>
    </section>
  </div></PublicLayout>;
};
