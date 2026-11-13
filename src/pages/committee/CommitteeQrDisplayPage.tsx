/* Hallmark · macrostructure: Workbench · theme: existing emerald-slate · nav: N3 · footer: Ft2
 * Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, RefreshCw, ScanLine } from "lucide-react";
import { CommitteeLayout } from "@/components/layouts/CommitteeLayout";
import { committeeApi, committeeEventsFor, type CommitteeAssignment } from "@/lib/committeeApi";
import { attendanceUnitSelection, pickCheckinUnit, type CheckinSchedule } from "@/lib/attendance";
import { eventTimezoneLabel, formatEventDate, formatEventDateTime } from "@/lib/eventDateTime";
import { locationCheckinUrl, type LocationCheckinTarget } from "@/lib/locationCheckin";
import "@/styles/attendance-workspace.css";

type LocationQr = Omit<LocationCheckinTarget, "rawLocationQrToken"> & { rawToken: string; validForMs: number };

export const CommitteeQrDisplayPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [events, setEvents] = useState<CommitteeAssignment[]>([]);
  const [schedule, setSchedule] = useState<CheckinSchedule | null>(null);
  const [unitId, setUnitId] = useState("");
  const [qr, setQr] = useState<(LocationCheckinTarget & { displayUntil: number }) | null>(null);
  const [now, setNow] = useState(Date.now);
  const [display, setDisplay] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const request = useRef<AbortController | null>(null);
  const requestedEventId = params.get("eventId");
  const event = requestedEventId ? events.find((item) => item.eventId === requestedEventId) : events[0];
  const eventId = event?.eventId;
  const unit = schedule?.units.find((item) => item.id === unitId);
  const seconds = qr ? Math.max(0, Math.ceil((qr.displayUntil - now) / 1000)) : 0;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    void committeeApi<{ assignments: CommitteeAssignment[] }>("/committee/context", { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setEvents(committeeEventsFor(data.assignments, "attendance.record")); })
      .catch((cause) => { if (!controller.signal.aborted) { setEvents([]); setError(cause.message); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  const stopDisplay = useCallback(() => {
    request.current?.abort(); request.current = null;
    setDisplay(false); setQr(null); setBusy(false);
  }, []);
  useEffect(() => () => request.current?.abort(), []);

  useEffect(() => {
    setSchedule(null); setUnitId(""); stopDisplay();
    if (!eventId) return;
    const controller = new AbortController();
    const load = () => void committeeApi<CheckinSchedule>(`/events/${eventId}/sessions/active`, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) { setSchedule(data); setUnitId((previous) => pickCheckinUnit(data.units, previous)); } })
      .catch((cause) => { if (!controller.signal.aborted) { setSchedule(null); stopDisplay(); setError(cause.message); } });
    load();
    const timer = window.setInterval(() => { if (!document.hidden) load(); }, 45_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [eventId, reload, stopDisplay]);

  const issue = useCallback(async (rotate = false) => {
    if (!eventId || !unit?.isOpen || request.current || document.hidden) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError("");
    try {
      const started = Date.now();
      const result = await committeeApi<LocationQr>(`/events/${eventId}/location-qr`, { method: "POST", signal: controller.signal,
        body: JSON.stringify({ ...attendanceUnitSelection(unit), rotate }) });
      if (!controller.signal.aborted) {
        const { rawToken, validForMs, ...target } = result;
        setQr({ ...target, rawLocationQrToken: rawToken, displayUntil: started + validForMs });
        setNow(Date.now());
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setQr(null); setDisplay(false);
        setError(cause instanceof Error ? cause.message : "QR Lokasi tidak dapat dibuat.");
      }
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  }, [eventId, unit?.id, unit?.isOpen]);

  useEffect(() => {
    if (!display) return;
    if (!unit?.isOpen) { stopDisplay(); return; }
    const tick = () => {
      setNow(Date.now());
      if (!document.hidden && (!qr || qr.displayUntil <= Date.now())) void issue();
    };
    tick();
    const timer = window.setInterval(tick, 500);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [display, unit?.isOpen, qr, issue, stopDisplay]);

  const qrValue = display && unit?.isOpen && qr?.eventId === eventId &&
    (qr?.sessionId || qr?.dayId) === (unit.sessionId || unit.dayId) && qr && seconds > 0 ? locationCheckinUrl(window.location.origin, qr) : null;

  return <CommitteeLayout>
    <div className="attendance-workspace">
      <header className="attendance-workspace__head">
        <h1>QR Lokasi</h1>
        <p>Tampilkan QR untuk dicatat sendiri oleh asatidz yang berada di lokasi.</p>
      </header>
      {error && <div className="attendance-feedback" role="alert" data-tone="error">{error}</div>}
      <div className="attendance-workspace__grid">
        <section className="attendance-workspace__controls" aria-label="Pengaturan QR Lokasi">
          <label>Event penugasan<select aria-label="Event penugasan" value={eventId || ""} disabled={loading || !events.length}
            onChange={(change) => { stopDisplay(); setSchedule(null); setUnitId(""); setError(""); setParams({ eventId: change.target.value }, { replace: true }); }}>
            {!event && <option value="">{loading ? "Memuat event…" : events.length ? "Pilih event penugasan" : "Tidak ada penugasan"}</option>}
            {events.map((item) => <option key={item.eventId} value={item.eventId}>{item.eventName}</option>)}
          </select></label>
          <label>Hari atau sesi<select aria-label="Hari atau sesi" value={unitId} disabled={!schedule?.units.length}
            onChange={(change) => { stopDisplay(); setError(""); setUnitId(change.target.value); }}>
            <option value="">Pilih hari atau sesi</option>
            {schedule?.units.map((item) => <option key={item.id} value={item.id}>{formatEventDate(item.date)} · {item.type === "DAY" ? "Harian" : "Sesi"} · {item.title}{item.isOpen ? " · Dibuka" : ""}</option>)}
          </select></label>
          {unit && schedule ? <p>{unit.isOpen ? "Check-in dibuka hingga" : "Jadwal check-in"} {unit.isOpen ? "" : `${formatEventDateTime(unit.openAt, schedule.timezone)} – `}{formatEventDateTime(unit.closeAt, schedule.timezone)} {eventTimezoneLabel(schedule.timezone)}.</p>
            : <p>{loading ? "Memeriksa penugasan…" : requestedEventId && !event ? "Akun ini tidak memiliki akses QR untuk event pada tautan. Pilih event penugasan Anda."
              : !events.length ? "Hubungi admin untuk mendapat akses pencatatan." : schedule?.manualUnitCount && !schedule.units.length ? "Jadwal ini menggunakan pencatatan manual melalui rapor." : "Pilih unit yang sedang membuka check-in."}</p>}
          <div className="attendance-actions">
            {display ? <><button type="button" className="attendance-control" onClick={stopDisplay}>Jeda layar</button>
              <button type="button" className="attendance-control" disabled={busy || !unit?.isOpen} onClick={() => void issue(true)}><RefreshCw size={16} aria-hidden="true" /> Putar QR</button></>
              : <button type="button" className="attendance-control" data-primary disabled={busy || !unit?.isOpen} onClick={() => { setError(""); setDisplay(true); }}><QrCode size={18} aria-hidden="true" /> Tampilkan QR</button>}
            {eventId && <Link className="attendance-control" to={`/committee/check-in?eventId=${encodeURIComponent(eventId)}`}><ScanLine size={16} aria-hidden="true" /> Scanner peserta</Link>}
            {error && !display && <button className="attendance-control" type="button" onClick={() => setReload((value) => value + 1)}>Muat ulang</button>}
          </div>
        </section>
        <section className="attendance-workspace__display" aria-label="Layar QR Lokasi">
          <h2>{unit?.title || "Check-in mandiri"}</h2>
          {event && <p>{event.eventName}{unit && ` · ${formatEventDate(unit.date)}`}</p>}
          {qrValue ? <>
            <QRCodeSVG value={qrValue} size={384} marginSize={4} level="M" className="attendance-workspace__qr" title="Pindai QR Lokasi dengan kamera ponsel" />
            <p className="attendance-workspace__countdown">Berganti dalam <strong>{seconds} dtk</strong></p>
            <p>Masuk ke Portal Asatidz, pindai QR ini, lalu tekan <strong>Catat kehadiran</strong>.</p>
          </> : <div className="attendance-workspace__empty" role="status"><QrCode size={42} aria-hidden="true" />
            <p>{display ? "Menyiapkan QR terbaru…" : "QR belum ditampilkan."}</p></div>}
        </section>
      </div>
    </div>
  </CommitteeLayout>;
};
