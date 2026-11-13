import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Camera, CheckCircle2, RefreshCw, ScanLine, Search } from "lucide-react";
import { StatusBadge } from "@/components/common/StatusBadge";
import { committeeApi, committeeEventsFor, type CommitteeAssignment } from "@/lib/committeeApi";
import { attendanceLabels, attendanceUnitSelection, checkinMethodLabels, pickCheckinUnit, type CheckinSchedule, type CheckinUnit } from "@/lib/attendance";
import { eventTimezoneLabel, formatEventDate, formatEventDateTime } from "@/lib/eventDateTime";
import { useQrCamera } from "@/lib/useQrCamera";
import "@/styles/attendance-workspace.css";
import { AttendanceModeControl, AttendanceRehearsalPanel, AttendanceRehearsalResult } from "@/components/attendance/AttendanceRehearsalPanel";
import type { AttendanceRehearsal } from "@/lib/attendanceRehearsal";

type CheckinLog = {
  id: string; result: "SUCCESS" | "FAILED" | "DUPLICATE"; method: string; failureReason?: string | null;
  createdAt: string; participantCode?: string | null; ustadzName?: string | null;
  metadata?: { kioskDeviceId?: string; attendanceUnitId?: string } | null;
};
type Candidate = { id: string; participantCode: string; ustadzName: string; institutionName?: string | null; blockReason?: string | null };
type CheckinResult = { attendanceStatus: string; participant: { participantCode: string; ustadzName: string }; attendanceUnit: CheckinUnit };

export const OnSiteCheckinPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const rehearsal = params.get("mode") === "test";
  const [events, setEvents] = useState<CommitteeAssignment[]>([]);
  const [schedule, setSchedule] = useState<CheckinSchedule | null>(null);
  const [unitId, setUnitId] = useState("");
  const [logs, setLogs] = useState<CheckinLog[]>([]);
  const [input, setInput] = useState("");
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [searchError, setSearchError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [testResult, setTestResult] = useState<AttendanceRehearsal | null>(null);
  const [reload, setReload] = useState(0);
  const [logsError, setLogsError] = useState("");
  const searchRequest = useRef<AbortController>();
  const recordRequest = useRef<AbortController>();
  const requestedEventId = params.get("eventId");
  const event = requestedEventId ? events.find((item) => item.eventId === requestedEventId) : events[0];
  const eventId = event?.eventId;
  const unit = schedule?.units.find((item) => item.id === unitId);
  const timezone = schedule?.timezone || "Asia/Jakarta";
  const scanAllowed = Boolean(unit && (rehearsal || unit.isOpen));

  const camera = useQrCamera((code) => {
    setCandidate(null); setInput(code); setError("");
    setTestResult(null); setNotice(rehearsal ? "QR terbaca. Tekan Uji QR untuk memeriksa tanpa mencatat hadir." : "QR terbaca. Periksa unit kehadiran, lalu catat.");
  });

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    void committeeApi<{ assignments: CommitteeAssignment[] }>("/committee/context", { signal: controller.signal })
      .then((value) => { if (!controller.signal.aborted) setEvents(committeeEventsFor(value.assignments, "attendance.record")); })
      .catch((cause) => { if (!controller.signal.aborted) { setEvents([]); setError(cause.message); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    setSchedule(null); setUnitId(""); setLogs([]); setLogsError(""); setInput(""); setCandidate(null);
    setQuery(""); setCandidates(null); setSearchError(""); setSearching(false); setNotice(""); setTestResult(null); setBusy(false);
    searchRequest.current?.abort(); recordRequest.current?.abort(); recordRequest.current = undefined;
    camera.stopCamera();
    if (!eventId) return;
    const controller = new AbortController();
    const loadSchedule = () => void committeeApi<CheckinSchedule>(`/events/${eventId}/sessions/active`, { signal: controller.signal })
      .then((value) => { if (!controller.signal.aborted) { setSchedule(value); setUnitId((current) => pickCheckinUnit(value.units, current) || (rehearsal ? value.units[0]?.id || "" : "")); } })
      .catch((cause) => { if (!controller.signal.aborted) { setSchedule(null); setError(cause.message); } });
    const loadLogs = () => void committeeApi<CheckinLog[]>(`/events/${eventId}/checkin/logs?limit=12`, { signal: controller.signal })
      .then((value) => { if (!controller.signal.aborted) { setLogs(value); setLogsError(""); } })
      .catch((cause) => { if (!controller.signal.aborted) setLogsError(cause.message); });
    loadSchedule(); if (!rehearsal) loadLogs();
    const timer = window.setInterval(() => { if (!document.hidden) { loadSchedule(); if (!rehearsal) loadLogs(); } }, 45_000);
    return () => { controller.abort(); searchRequest.current?.abort(); recordRequest.current?.abort(); window.clearInterval(timer); };
  }, [eventId, reload, camera.stopCamera, rehearsal]);

  useEffect(() => { if (!scanAllowed) camera.stopCamera(); }, [scanAllowed, camera.stopCamera]);

  const search = async (form: React.FormEvent) => {
    form.preventDefault();
    if (!eventId || query.trim().length < 2) return;
    searchRequest.current?.abort();
    const controller = new AbortController();
    searchRequest.current = controller;
    setSearchError(""); setSearching(true); setCandidates(null);
    try {
      const results = await committeeApi<Candidate[]>(`/events/${eventId}/checkin/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
      if (!controller.signal.aborted) setCandidates(results);
    } catch (cause) {
      if (!controller.signal.aborted) setSearchError(cause instanceof Error ? cause.message : "Pencarian peserta gagal.");
    } finally { if (!controller.signal.aborted) setSearching(false); }
  };

  const submit = async (form: React.FormEvent) => {
    form.preventDefault();
    if (!eventId || !unit || !scanAllowed || !input.trim() || recordRequest.current || !rehearsal && candidate?.blockReason) return;
    const controller = new AbortController();
    recordRequest.current = controller;
    setBusy(true); setError(""); setNotice(""); setTestResult(null); camera.stopCamera();
    try {
      if (rehearsal) {
        const tested = await committeeApi<AttendanceRehearsal>(`/events/${eventId}/checkin/rehearsal`, { method: "POST", signal: controller.signal,
          body: JSON.stringify({ ...attendanceUnitSelection(unit), qrTokenOrCode: input.trim() }) });
        if (!controller.signal.aborted) { setTestResult(tested); setInput(""); setCandidate(null); }
        return;
      }
      if (input.trim().startsWith("rqr_")) { setError("QR uji tidak dapat dipakai untuk presensi resmi. Pilih Uji scanner."); return; }
      const saved = await committeeApi<CheckinResult>(`/events/${eventId}/checkin`, { method: "POST", signal: controller.signal,
        body: JSON.stringify({ ...attendanceUnitSelection(unit), qrTokenOrCode: input.trim(),
          method: candidate ? "SEARCH_SELECT" : input.trim().startsWith("pqr_") ? "QR_SCAN" : "MANUAL_CODE" }) });
      if (controller.signal.aborted) return;
      setNotice(`${attendanceLabels[saved.attendanceStatus] || "Kehadiran"} · ${saved.participant.ustadzName} · ${saved.attendanceUnit.title}`);
      setInput(""); setCandidate(null);
      await committeeApi<CheckinLog[]>(`/events/${eventId}/checkin/logs?limit=12`, { signal: controller.signal })
        .then((value) => { if (!controller.signal.aborted) { setLogs(value); setLogsError(""); } })
        .catch(() => { if (!controller.signal.aborted) setLogsError("Presensi tersimpan, tetapi log belum diperbarui."); });
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Check-in gagal diproses.");
    } finally {
      if (recordRequest.current === controller) { recordRequest.current = undefined; setBusy(false); }
    }
  };

  return <div className="attendance-workspace">
    <header className="attendance-workspace__head">
      <h1>Scanner peserta</h1>
      <p>Pilih hari atau sesi, lalu pindai QR pribadi atau masukkan kode peserta.</p>
    </header>
    <AttendanceModeControl rehearsal={rehearsal} disabled={busy} onChange={(value) => {
      if (busy) return; camera.stopCamera();
      const next = new URLSearchParams(params); value ? next.set("mode", "test") : next.delete("mode"); setParams(next, { replace: true });
    }} />
    {error && <div className="attendance-feedback" data-tone="error" role="alert">{error}</div>}
    {notice && <div className="attendance-feedback" data-tone="success" role="status"><CheckCircle2 className="mr-2 inline h-5 w-5" aria-hidden="true" />{notice}</div>}
    <section className="attendance-panel" aria-label="Event dan jadwal presensi">
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label>Event penugasan<select value={eventId || ""} onChange={(change) => { setError(""); const next = new URLSearchParams(params); next.set("eventId", change.target.value); setParams(next, { replace: true }); }} disabled={busy || loading || !events.length}>
          {!event && <option value="">{loading ? "Memuat penugasan…" : events.length ? "Pilih event penugasan" : "Tidak ada penugasan check-in"}</option>}
          {events.map((item) => <option key={item.eventId} value={item.eventId}>{item.eventName}</option>)}
        </select></label>
        <label>Hari atau sesi<select value={unitId} disabled={busy || !schedule?.units.length}
          onChange={(change) => { camera.stopCamera(); setUnitId(change.target.value); setInput(""); setCandidate(null); setNotice(""); setTestResult(null); setError(""); }}>
          <option value="">Pilih hari atau sesi</option>
          {schedule?.units.map((item) => <option key={item.id} value={item.id}>{formatEventDate(item.date)} · {item.type === "DAY" ? "Harian" : "Sesi"} · {item.title}{item.isOpen ? " · Dibuka" : ""}</option>)}
        </select></label>
      </div>
      <p>{!loading && requestedEventId && !event ? "Akun ini tidak memiliki akses check-in untuk event pada tautan. Pilih event penugasan Anda."
        : unit ? `${unit.isOpen ? "Dibuka" : "Ditutup"} · ${formatEventDateTime(unit.openAt, timezone)}–${formatEventDateTime(unit.closeAt, timezone)} ${eventTimezoneLabel(timezone)}`
        : schedule?.manualUnitCount && !schedule.units.length ? "Jadwal ini menggunakan catat manual di rapor peserta."
          : "Pilih unit yang dibuka. Jika jadwal belum ada, hubungi admin event."}</p>
      <div className="attendance-actions">
        {event?.eventSlug && schedule?.eventAllowsCheckin && <Link className="attendance-control" to={`/check-in/${event.eventSlug}`}>Kiosk event</Link>}
        {eventId && <><Link className="attendance-control" to={`/committee/location-qr?eventId=${encodeURIComponent(eventId)}`}>QR Lokasi</Link>
          <Link className="attendance-control" to={`/committee/attendance?eventId=${encodeURIComponent(eventId)}`}>Rekap kehadiran</Link></>}
        <button className="attendance-control" type="button" disabled={loading || busy} onClick={() => setReload((value) => value + 1)}><RefreshCw size={16} aria-hidden="true" /> Segarkan</button>
      </div>
    </section>
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,.72fr)]">
      <div className="grid min-w-0 content-start gap-5">
        <section className="attendance-panel" aria-labelledby="staff-checkin-title">
          <h2 id="staff-checkin-title">{rehearsal ? "Uji QR dan perangkat" : "Catat kehadiran"}</h2>
          {!rehearsal && unit && !unit.isOpen && <p>Absensi resmi di luar jadwal. Gunakan Uji scanner untuk mencoba perangkat sekarang tanpa mencatat hadir.</p>}
          {rehearsal && <AttendanceRehearsalPanel key={`${eventId}:${unitId}`} disabled={!eventId || !unit || busy}
            issue={(signal) => committeeApi<AttendanceRehearsal>(`/events/${eventId}/checkin/rehearsal/qr`, { method: "POST", signal, body: JSON.stringify(unit ? attendanceUnitSelection(unit) : {}) })}
            onUseSample={(token) => { camera.stopCamera(); setInput(token); setCandidate(null); setTestResult(null); setNotice("QR contoh diisi. Tekan Uji QR; kehadiran tidak disimpan."); }} />}
          <form className="grid gap-3" onSubmit={(form) => void submit(form)}>
            <label>{candidate ? `Peserta dipilih: ${candidate.ustadzName}` : "Kode peserta atau token QR"}
              <input value={input} type={/^(pqr|rqr)_/.test(input) ? "password" : "text"} disabled={busy || !scanAllowed} maxLength={512}
                onChange={(change) => { setInput(change.target.value); setCandidate(null); }} autoComplete="off" spellCheck={false} />
            </label>
            <div className="attendance-actions"><button type="submit" className="attendance-control" data-primary disabled={busy || !scanAllowed || !input.trim()}>
              <ScanLine size={17} aria-hidden="true" /> {busy ? rehearsal ? "Memeriksa…" : "Mencatat…" : rehearsal ? "Uji QR" : "Catat hadir"}</button>
              <button type="button" className="attendance-control" disabled={busy || !scanAllowed}
                onClick={() => camera.cameraState === "idle" ? void camera.startCamera() : camera.stopCamera()}>
                <Camera size={17} aria-hidden="true" /> {camera.cameraState === "idle" ? "Aktifkan kamera" : camera.cameraState === "starting" ? "Batalkan kamera" : "Matikan kamera"}</button></div>
          </form>
          {camera.cameraError && <div className="attendance-feedback" data-tone="error" role="alert">{camera.cameraError}</div>}
          <video ref={camera.videoRef} hidden={camera.cameraState !== "active"} playsInline muted aria-label="Pratinjau kamera peserta" />
        </section>
        <section className="attendance-panel" aria-labelledby="staff-search-title">
          <h2 id="staff-search-title">Cari peserta</h2>
          <p>Cari bila peserta tidak membawa kartu. Untuk sesi tanpa QR atau koreksi, buka rapor peserta.</p>
          <form className="grid gap-2" onSubmit={(form) => void search(form)}>
            <label>Nama, lembaga, atau kode<input type="search" value={query} maxLength={80}
              onChange={(change) => { searchRequest.current?.abort(); setQuery(change.target.value); setCandidates(null); setSearching(false); setSearchError(""); }} /></label>
            <div className="attendance-actions"><button className="attendance-control" type="submit" disabled={!eventId || searching || query.trim().length < 2}><Search size={16} aria-hidden="true" /> {searching ? "Mencari…" : "Cari peserta"}</button></div>
          </form>
          {searchError && <div className="attendance-feedback" data-tone="error" role="alert">{searchError}</div>}
          {candidates && <div aria-live="polite">{candidates.length ? <ul className="grid gap-3">
            {candidates.map((person) => <li key={person.id} className="grid min-w-0 gap-2 border-t border-[var(--color-event-rule)] pt-3">
              <strong className="break-words">{person.ustadzName}</strong><p>{person.participantCode}{person.institutionName && ` · ${person.institutionName}`}</p>
              {person.blockReason && <p>Belum dapat dicatat: {person.blockReason}</p>}
              <div className="attendance-actions">
                <button type="button" className="attendance-control" disabled={!scanAllowed || busy || !rehearsal && Boolean(person.blockReason)}
                  onClick={() => { setCandidate(person); setInput(person.participantCode); setError(""); setTestResult(null); setNotice(`${person.ustadzName} dipilih. ${rehearsal ? "Tekan Uji QR untuk memeriksa tanpa mencatat hadir." : "Tekan Catat hadir untuk menyimpan."}`); }}>Pilih peserta</button>
                <Link className="attendance-control" to={`/committee/attendance/${eventId}/${person.id}/report`}>Buka rapor</Link>
              </div>
            </li>)}
          </ul> : <p>Tidak ada peserta yang cocok pada event ini.</p>}</div>}
        </section>
      </div>
      <aside className="attendance-panel" aria-label={rehearsal ? "Hasil uji scanner" : "Aktivitas check-in terbaru"}>
        {rehearsal ? testResult ? <AttendanceRehearsalResult result={testResult} /> : <><h2>Hasil uji</h2><p>Hasil pemeriksaan tampil setelah QR dibaca. Rekap resmi tidak ditampilkan atau diubah dalam mode uji.</p></> : <>
        <h2>Aktivitas terbaru</h2>
        {logsError && <div className="attendance-feedback" data-tone="error" role="alert">{logsError}</div>}
        {logs.length ? <ol className="grid gap-3">{logs.map((log) => <li key={log.id} className="grid min-w-0 gap-1 border-t border-[var(--color-event-rule)] pt-3">
          <strong className="break-words">{log.ustadzName || log.participantCode || "Percobaan check-in"}</strong>
          <p>{checkinMethodLabels[log.method] || log.method}{log.metadata?.kioskDeviceId && " · Kiosk"} · {formatEventDateTime(log.createdAt, timezone)} {eventTimezoneLabel(timezone)}</p>
          <div><StatusBadge label={log.result === "SUCCESS" ? "Tercatat" : log.result === "DUPLICATE" ? "Sudah tercatat" : "Gagal"}
            variant={log.result === "SUCCESS" ? "success" : log.result === "DUPLICATE" ? "warning" : "danger"} /></div>
          {log.failureReason && <p className="break-words">{log.failureReason}</p>}
        </li>)}</ol> : <p>Belum ada aktivitas pada event ini.</p>}</>}
      </aside>
    </div>
  </div>;
};
