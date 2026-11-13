import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useGetIdentity } from "@refinedev/core";
import { ArrowLeft, Printer } from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { CommitteeLayout } from "@/components/layouts/CommitteeLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { eventApi } from "@/lib/eventApi";
import type { AuthIdentity } from "@/lib/refine/authProvider";
import { participantStaffPermissions } from "@/lib/participantManagement";
import { attendanceLabels, checkinMethodLabels } from "@/lib/attendance";
import { eventTimezoneLabel, formatEventDate, formatEventDateTime } from "@/lib/eventDateTime";
import "@/styles/attendance-workspace.css";

type Unit = { unitId: string; type: "DAY" | "SESSION"; title: string; date: string; status: string; dayId: string;
  sessionId: string | null; qrEnabled: boolean; recordId: string | null; checkinAt: string | null; checkinMethod: string | null; canMark: boolean };
type Report = {
  generatedAt: string;
  event: { code: string; name: string; startDate: string; endDate: string; venueName?: string | null; timezone: string };
  participant: { participantCode: string; registrationSource: string; ustadzName: string; institutionName?: string | null };
  attendance: { eligible: boolean; blockReason: string | null; fulfilledUnits: number; requiredUnits: number;
    completionPercentage: number; statusCategory: string; unitStatuses: Unit[] };
};
const statuses = ["PRESENT", "LATE", "EXCUSED", "PERMITTED", "ABSENT"];
const statusVariant = (status: string) => ["PRESENT", "LATE", "HADIR_PENUH"].includes(status) ? "success" as const
  : ["EXCUSED", "PERMITTED", "HADIR_SEBAGIAN", "IZIN_LENGKAP"].includes(status) ? "warning" as const
  : ["ABSENT", "TIDAK_HADIR"].includes(status) ? "danger" as const : "neutral" as const;
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const AttendanceReportPage: React.FC = () => {
  const { id = "", participantId = "" } = useParams();
  const committeeMode = useLocation().pathname.startsWith("/committee/");
  const backHref = committeeMode ? `/committee/attendance?eventId=${encodeURIComponent(id)}` : `/admin/events/${id}/attendance`;
  const { data: identity } = useGetIdentity<AuthIdentity>();
  const permissions = participantStaffPermissions(identity?.assignments, id);
  const scope = `${id}/${participantId}`;
  const [loaded, setLoaded] = useState<{ scope: string; data: Report } | null>(null);
  const report = loaded?.scope === scope ? loaded.data : null;
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [status, setStatus] = useState("PRESENT");
  const [reason, setReason] = useState("");
  const [reload, setReload] = useState(0);
  const mutation = useRef<AbortController | null>(null);
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const canMark = permissions.includes("attendance.record");
  const canCorrect = permissions.includes("attendance.correct");

  useEffect(() => {
    const controller = new AbortController();
    setLoaded(null); setEditing(null); setLoadError(""); setActionError(""); setNotice(""); setBusy(false);
    if (!isUuid(id) || !isUuid(participantId)) {
      setLoadError("Rapor memerlukan event dan peserta yang tersimpan."); setLoading(false);
      return;
    }
    setLoading(true);
    void eventApi<Report>(`/events/${id}/attendance/${participantId}/report`, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setLoaded({ scope, data }); })
      .catch((cause) => { if (!controller.signal.aborted) setLoadError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); mutation.current?.abort(); mutation.current = null; };
  }, [id, participantId, reload, scope]);

  const save = async (form: React.FormEvent) => {
    form.preventDefault();
    if (!editing || !report || mutation.current || (editing.recordId ? !canCorrect || reason.trim().length < 3 : !canMark || !editing.canMark)) return;
    const controller = new AbortController();
    mutation.current = controller;
    setBusy(true); setActionError(""); setNotice("");
    const base = `/events/${id}/attendance`;
    try {
      if (editing.recordId) {
        await eventApi(`${base}/${editing.recordId}/correct`, { method: "POST", signal: controller.signal,
          body: JSON.stringify({ attendanceStatus: status, reason: reason.trim() }) });
      } else {
        await eventApi(`${base}/manual-mark`, { method: "POST", signal: controller.signal,
          body: JSON.stringify({ participantId, attendanceStatus: status, notes: reason.trim() || null,
            ...(editing.type === "DAY" ? { dayId: editing.dayId } : { sessionId: editing.sessionId }) }) });
      }
      if (controller.signal.aborted || activeScope.current !== scope) return;
      setEditing(null);
      setNotice(`${attendanceLabels[status]} tersimpan untuk ${editing.title}.`);
      try {
        const data = await eventApi<Report>(`${base}/${participantId}/report`, { signal: controller.signal });
        if (!controller.signal.aborted && activeScope.current === scope) setLoaded({ scope, data });
      } catch {
        if (!controller.signal.aborted && activeScope.current === scope) {
          setLoaded(null); setLoadError("Perubahan tersimpan, tetapi rapor belum diperbarui. Muat ulang sebelum mengedit lagi.");
        }
      }
    } catch (cause) {
      if (!controller.signal.aborted && activeScope.current === scope) setActionError(cause instanceof Error ? cause.message : "Kehadiran gagal disimpan.");
    } finally {
      if (mutation.current === controller) { mutation.current = null; setBusy(false); }
    }
  };

  const startEdit = (unit: Unit) => {
    setEditing(unit); setActionError(""); setNotice(""); setReason("");
    setStatus(statuses.includes(unit.status) ? unit.status : "PRESENT");
  };

  const content = <>
    <div className="attendance-report-actions">
      <PageHeader title="Rapor kehadiran peserta" description="Kehadiran harian dan sesi untuk satu peserta."
        breadcrumbs={[{ label: committeeMode ? "Panitia" : "Admin", href: committeeMode ? "/committee" : "/admin" }, { label: "Kehadiran", href: backHref }, { label: "Rapor" }]}
        actions={<div className="attendance-actions"><Link to={backHref} className="attendance-control"><ArrowLeft size={16} aria-hidden="true" /> Kembali</Link>
          <button type="button" className="attendance-control" onClick={() => window.print()} disabled={!report || busy}><Printer size={16} aria-hidden="true" /> Cetak / PDF</button></div>} />
    </div>
    {notice && <div className="attendance-report-actions attendance-feedback mb-4" data-tone="success" role="status">{notice}</div>}
    {loadError ? <div className="attendance-panel"><div className="attendance-feedback" data-tone="error" role="alert">{loadError}</div>
      {isUuid(id) && isUuid(participantId) && <div className="attendance-actions"><button type="button" className="attendance-control" onClick={() => setReload((value) => value + 1)}>Muat ulang</button></div>}
    </div> : loading || !report ? <p role="status" className="p-4">Memuat rapor…</p> :
      <article className="attendance-report mx-auto max-w-5xl border border-[var(--color-event-rule)] bg-[var(--color-event-paper)]">
        <header className="border-b border-[var(--color-event-rule)] p-5 sm:p-8">
          <img src="/images/tarbiyah-sunnah-logo.svg" alt="Tarbiyah Sunnah" width="170" height="48" className="mb-4 h-auto w-[150px] object-contain" />
          <p className="text-sm font-bold text-[var(--color-event-accent)]">Daurah Duat dan Pegiat Dakwah · {report.event.code}</p>
          <h1 className="mt-2 break-words text-2xl font-black text-[var(--color-event-ink)]">{report.event.name}</h1>
          <p className="mt-2 text-sm text-[var(--color-event-muted)]">{formatEventDate(report.event.startDate)}–{formatEventDate(report.event.endDate)} · {report.event.venueName || "Lokasi belum dicatat"}</p>
        </header>
        <section className="grid gap-4 border-b border-[var(--color-event-rule)] p-5 sm:p-8 md:grid-cols-[minmax(0,1fr)_16rem]">
          <div><h2 className="break-words text-xl font-black">{report.participant.ustadzName}</h2><p className="mt-1 text-sm">{report.participant.participantCode} · {report.participant.institutionName || "Peserta individual"}</p>
            {report.attendance.blockReason && <p className="mt-2 text-sm">Tidak dihitung dalam presensi wajib: {report.attendance.blockReason}</p>}</div>
          <div>{report.attendance.eligible && <p className="mb-2 text-lg font-bold tabular-nums">{report.attendance.completionPercentage}% · {report.attendance.fulfilledUnits}/{report.attendance.requiredUnits} unit terpenuhi</p>}
            <StatusBadge label={attendanceLabels[report.attendance.statusCategory] || report.attendance.statusCategory} variant={statusVariant(report.attendance.statusCategory)} /></div>
        </section>
        <section className="p-5 sm:p-8">
          <h2 className="text-lg font-black">Rincian hari dan sesi</h2>
          {!report.attendance.unitStatuses.length && <p className="mt-3 text-sm">Belum ada unit presensi yang dijadwalkan.</p>}
          <ol className="mt-3 grid divide-y divide-[var(--color-event-rule)]">{report.attendance.unitStatuses.map((unit) => <li key={unit.unitId} className="grid min-w-0 gap-2 py-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0">
              <p className="text-sm text-[var(--color-event-muted)]">{formatEventDate(unit.date)} · {unit.type === "DAY" ? "Harian" : "Sesi"}{!unit.qrEnabled && " · Manual saja"}</p>
              <h3 className="break-words font-bold">{unit.title}</h3></div>
              <StatusBadge label={attendanceLabels[unit.status] || unit.status} variant={statusVariant(unit.status)} /></div>
            {unit.checkinAt && <p className="text-sm">{formatEventDateTime(unit.checkinAt, report.event.timezone)} {eventTimezoneLabel(report.event.timezone)}{unit.checkinMethod && ` · ${checkinMethodLabels[unit.checkinMethod] || unit.checkinMethod}`}</p>}
            {(unit.recordId ? canCorrect : canMark && unit.canMark) && editing?.unitId !== unit.unitId &&
              <div className="attendance-report-actions attendance-actions"><button type="button" className="attendance-control" disabled={busy} onClick={() => startEdit(unit)}>
                {unit.recordId ? "Koreksi" : "Catat manual"}</button></div>}
            {editing?.unitId === unit.unitId && <form className="attendance-report-actions attendance-panel" onSubmit={(form) => void save(form)} aria-label={unit.recordId ? "Koreksi presensi" : "Catat manual"}>
              <label>Status kehadiran<select value={status} onChange={(change) => setStatus(change.target.value)} disabled={busy}>
                {statuses.map((value) => <option key={value} value={value}>{attendanceLabels[value]}</option>)}</select></label>
              <label>{unit.recordId ? "Alasan koreksi (wajib)" : "Catatan (opsional)"}
                <textarea value={reason} disabled={busy} required={Boolean(unit.recordId)} minLength={unit.recordId ? 3 : undefined} maxLength={500} rows={2}
                  onChange={(change) => setReason(change.target.value)} /></label>
              {actionError && <div className="attendance-feedback" data-tone="error" role="alert">{actionError}</div>}
              <div className="attendance-actions"><button type="submit" className="attendance-control" data-primary disabled={busy || Boolean(unit.recordId) && reason.trim().length < 3}>
                {busy ? "Menyimpan…" : unit.recordId ? "Simpan koreksi" : "Simpan presensi"}</button>
                <button type="button" className="attendance-control" disabled={busy} onClick={() => setEditing(null)}>Batal</button></div>
            </form>}
          </li>)}</ol>
        </section>
        <footer className="border-t border-[var(--color-event-rule)] p-5 text-sm text-[var(--color-event-muted)]">Dibuat {formatEventDateTime(report.generatedAt, report.event.timezone)} {eventTimezoneLabel(report.event.timezone)} · Mengikuti catatan dan koreksi panitia.</footer>
      </article>}
  </>;
  return committeeMode ? <CommitteeLayout>{content}</CommitteeLayout> : <AdminLayout>{content}</AdminLayout>;
};
