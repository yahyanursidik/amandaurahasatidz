import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, QrCode, RefreshCw, ScanLine } from "lucide-react";
import { StatusBadge } from "@/components/common/StatusBadge";
import { CommitteeAssignment, committeeApi } from "@/lib/committeeApi";

type CheckinUnit = {
  id: string;
  type: "DAY" | "SESSION";
  dayId: string;
  sessionId: string | null;
  title: string;
  date: string;
  openAt: string;
  closeAt: string;
  isOpen: boolean;
};

type CheckinSchedule = {
  attendanceMode: "DAILY_ONLY" | "SESSION_ONLY" | "DAILY_AND_SESSION";
  units: CheckinUnit[];
  checkinWindow: { isOpen: boolean; openAt: string; closeAt: string };
};

type CheckinLog = {
  id: string;
  result: "SUCCESS" | "FAILED" | "DUPLICATE";
  method: string;
  failureReason?: string | null;
  createdAt: string;
  participantCode?: string | null;
  ustadzName?: string | null;
  institutionName?: string | null;
};

type CheckinResult = {
  status: "SUCCESS";
  checkinAt: string;
  participant: { participantCode: string; ustadzName: string };
  attendanceUnit: CheckinUnit;
};

const previewAssignments: CommitteeAssignment[] = [{
  id: "preview-checkin",
  eventId: "preview-event",
  eventName: "Daurah Asatidz Nasional 2026",
  eventCode: "ADA-2026-BDG",
  eventStatus: "ONGOING",
  committeeRole: "CHECKIN_OFFICER",
  effectivePermissions: ["attendance.read", "attendance.record"],
}];

const previewUnits: CheckinUnit[] = [
  { id: "DAY:preview-day-1", type: "DAY", dayId: "preview-day-1", sessionId: null, title: "Kehadiran harian · Hari 1", date: "2026-08-15", openAt: "2026-08-15T00:00:00+07:00", closeAt: "2026-08-15T23:59:59+07:00", isOpen: true },
  { id: "SESSION:preview-session-1", type: "SESSION", dayId: "preview-day-1", sessionId: "preview-session-1", title: "Pembukaan dan materi pertama", date: "2026-08-15", openAt: "2026-08-15T07:00:00+07:00", closeAt: "2026-08-15T10:00:00+07:00", isOpen: true },
];

const formatWindow = (unit?: CheckinUnit) => unit
  ? `${new Date(unit.openAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}–${new Date(unit.closeAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
  : "Belum diatur";

export const OnSiteCheckinPage: React.FC = () => {
  const [assignments, setAssignments] = useState<CommitteeAssignment[]>([]);
  const [eventId, setEventId] = useState("");
  const [units, setUnits] = useState<CheckinUnit[]>([]);
  const [unitId, setUnitId] = useState("");
  const [logs, setLogs] = useState<CheckinLog[]>([]);
  const [inputCode, setInputCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [lastResult, setLastResult] = useState<CheckinResult | null>(null);

  const selectedUnit = units.find((unit) => unit.id === unitId) || units[0];
  const selectedAssignment = assignments.find((assignment) => assignment.eventId === eventId);
  const groupedUnits = useMemo(() => {
    const groups = new Map<string, CheckinUnit[]>();
    for (const unit of units) groups.set(unit.date, [...(groups.get(unit.date) || []), unit]);
    return [...groups.entries()];
  }, [units]);

  const loadSchedule = useCallback(async (targetEventId: string, previewMode: boolean) => {
    if (!targetEventId) return;
    if (previewMode) {
      setUnits(previewUnits);
      setUnitId(previewUnits[1].id);
      setLogs([]);
      return;
    }
    const [schedule, recentLogs] = await Promise.all([
      committeeApi<CheckinSchedule>(`/events/${targetEventId}/sessions/active`),
      committeeApi<CheckinLog[]>(`/events/${targetEventId}/checkin/logs?limit=12`),
    ]);
    setUnits(schedule.units);
    setUnitId((current) =>
      schedule.units.some((unit) => unit.id === current)
        ? current
        : schedule.units.find((unit) => unit.isOpen)?.id || schedule.units[0]?.id || "",
    );
    setLogs(recentLogs);
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const context = await committeeApi<{ assignments: CommitteeAssignment[] }>("/committee/context");
        const available = context.assignments.filter((assignment) =>
          assignment.effectivePermissions?.includes("attendance.record"),
        );
        if (!available.length) throw new Error("Akun belum memiliki penugasan check-in aktif.");
        setAssignments(available);
        setEventId(available[0].eventId);
        await loadSchedule(available[0].eventId, false);
      } catch (error) {
        setPreview(true);
        setAssignments(previewAssignments);
        setEventId("preview-event");
        await loadSchedule("preview-event", true);
        setFeedback({ kind: "error", message: error instanceof Error ? error.message : "Mode pratinjau aktif." });
      } finally {
        setLoading(false);
      }
    })();
  }, [loadSchedule]);

  const changeEvent = async (nextEventId: string) => {
    setEventId(nextEventId);
    setLoading(true);
    setFeedback(null);
    try { await loadSchedule(nextEventId, preview); }
    catch (error) { setFeedback({ kind: "error", message: error instanceof Error ? error.message : "Jadwal gagal dimuat." }); }
    finally { setLoading(false); }
  };

  const submitCheckin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedUnit || !inputCode.trim()) return;
    if (!selectedUnit.isOpen) {
      setFeedback({ kind: "error", message: "Jendela check-in unit ini belum dibuka atau telah ditutup." });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const result = preview
        ? { status: "SUCCESS" as const, checkinAt: new Date().toISOString(), participant: { participantCode: inputCode.toUpperCase(), ustadzName: "Peserta pratinjau" }, attendanceUnit: selectedUnit }
        : await committeeApi<CheckinResult>(`/events/${eventId}/checkin`, {
            method: "POST",
            body: JSON.stringify({
              qrTokenOrCode: inputCode.trim(),
              method: "MANUAL_CODE",
              sessionId: selectedUnit.sessionId,
              dayId: selectedUnit.type === "DAY" ? selectedUnit.dayId : null,
            }),
          });
      setLastResult(result);
      setFeedback({ kind: "success", message: `Kehadiran ${result.participant.ustadzName} berhasil dicatat pada ${result.attendanceUnit.title}.` });
      setInputCode("");
      if (!preview) await loadSchedule(eventId, false);
    } catch (error) {
      setFeedback({ kind: "error", message: error instanceof Error ? error.message : "Check-in gagal diproses." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="border-t-4 border-emerald-700 bg-slate-950 p-5 text-white sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-emerald-300">Operasional kehadiran</p>
            <h1 className="mt-2 text-2xl font-black">Scanner dan check-in peserta</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Pilih event dan unit kehadiran sebelum memindai. Hari berjeda hanya menampilkan tanggal kegiatan yang benar-benar dijadwalkan.</p>
          </div>
          <label className="text-xs font-bold text-slate-200">Event penugasan<select value={eventId} onChange={(event) => void changeEvent(event.target.value)} className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white">{assignments.map((assignment) => <option key={assignment.eventId} value={assignment.eventId}>{assignment.eventCode} · {assignment.eventName}</option>)}</select></label>
        </div>
      </header>

      {feedback && <div role={feedback.kind === "error" ? "alert" : "status"} className={`flex items-center gap-3 border-y p-3 text-sm font-bold ${feedback.kind === "error" ? "border-rose-200 bg-rose-50 text-rose-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>{feedback.kind === "error" ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}{feedback.message}</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4 sm:p-5">
            <label className="text-sm font-black text-slate-900">Unit kehadiran<select value={selectedUnit?.id || ""} onChange={(event) => setUnitId(event.target.value)} disabled={loading} className="mt-2 min-h-[48px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">{groupedUnits.map(([date, dateUnits]) => <optgroup key={date} label={new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", { dateStyle: "full" })}>{dateUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.type === "DAY" ? "Harian" : "Sesi"} · {unit.title}{unit.isOpen ? " · DIBUKA" : ""}</option>)}</optgroup>)}</select></label>
            {selectedUnit && <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600"><StatusBadge label={selectedUnit.isOpen ? "CHECK-IN DIBUKA" : "CHECK-IN DITUTUP"} variant={selectedUnit.isOpen ? "success" : "warning"} /><span className="inline-flex items-center gap-1 font-bold"><Clock3 className="h-4 w-4" /> {formatWindow(selectedUnit)}</span><span>{selectedUnit.type === "DAY" ? "Presensi harian" : "Presensi per sesi"}</span></div>}
          </div>

          <form onSubmit={submitCheckin} className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_14rem]">
            <div>
              <label htmlFor="participant-code" className="text-sm font-black text-slate-900">Kode atau token QR peserta</label>
              <div className="relative mt-2"><QrCode className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" /><input id="participant-code" value={inputCode} onChange={(event) => setInputCode(event.target.value)} autoComplete="off" autoFocus placeholder="Pindai QR atau masukkan kode peserta" className="min-h-[48px] w-full rounded-lg border border-slate-300 pl-11 pr-3 text-base font-bold outline outline-2 outline-transparent focus-visible:outline-emerald-700" /></div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Pemindaian dicatat pada unit yang dipilih. Peserta yang sama tidak dapat dicatat dua kali pada hari atau sesi yang sama.</p>
            </div>
            <button disabled={submitting || loading || !selectedUnit?.isOpen || !inputCode.trim()} className="mt-auto inline-flex min-h-[48px] items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-emerald-700 px-5 text-sm font-black text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-55"><ScanLine className="h-5 w-5" />{submitting ? "Memproses…" : "Proses check-in"}</button>
          </form>

          {lastResult && <div className="border-t border-emerald-200 bg-emerald-50 p-4 sm:p-5"><p className="text-xs font-black uppercase tracking-wide text-emerald-700">Check-in terakhir</p><p className="mt-1 text-lg font-black text-emerald-950">{lastResult.participant.ustadzName}</p><p className="mt-1 text-sm text-emerald-900">{lastResult.participant.participantCode} · {lastResult.attendanceUnit.title}</p></div>}
        </section>

        <aside className="border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 p-4"><div><h2 className="text-sm font-black text-slate-900">Aktivitas terbaru</h2><p className="mt-1 text-xs text-slate-500">{selectedAssignment?.eventCode || "Event"}</p></div><button type="button" onClick={() => void loadSchedule(eventId, preview)} disabled={loading} aria-label="Segarkan aktivitas" className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-700"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div>
          {logs.length ? <ol className="divide-y divide-slate-100">{logs.map((log) => <li key={log.id} className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-900">{log.ustadzName || log.participantCode || "Pemindaian tanpa peserta"}</p><p className="mt-1 truncate text-xs text-slate-500">{log.institutionName || log.failureReason || log.method}</p></div><StatusBadge label={log.result} variant={log.result === "SUCCESS" ? "success" : log.result === "DUPLICATE" ? "warning" : "danger"} /></div><time className="mt-2 block text-[11px] font-bold text-slate-400">{new Date(log.createdAt).toLocaleString("id-ID")}</time></li>)}</ol> : <p className="p-8 text-center text-sm text-slate-500">Belum ada aktivitas check-in.</p>}
        </aside>
      </div>
    </div>
  );
};
