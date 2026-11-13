/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4
 * genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app
 */
import React, { useEffect, useState } from "react";
import { useGetIdentity } from "@refinedev/core";
import { Link, useParams } from "react-router-dom";
import {
  CheckCircle2,
  Download,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EventWorkspaceNav } from "@/components/admin/events/EventWorkspaceNav";
import { EventCommunicationCenter } from "@/components/admin/events/EventCommunicationCenter";
import { eventApi } from "@/lib/eventApi";
import type { AuthIdentity } from "@/lib/refine/authProvider";
import { attendanceLabels as attendanceStatusLabel } from "@/lib/attendance";

type Mode = "attendance" | "communications" | "reports";
type Props = { mode: Mode };

type AttendanceRecap = {
  attendanceMode?: string;
  totalParticipants: number;
  requiredUnits?: Array<{ id: string; type: "DAY" | "SESSION"; title: string; date: string; qrEnabled?: boolean }>;
  recapSummary: {
    fullAttendance: number;
    partialAttendance: number;
    lateAttendance: number;
    excused: number;
    absent: number;
  };
  participantDetails: Array<{
    participantId: string;
    participantCode: string;
    ustadzName: string;
    institutionName: string | null;
    totalSessionsAttended: number;
    totalUnitsAttended?: number;
    requiredUnits?: number;
    completionPercentage?: number;
    eligible?: boolean;
    statusCategory: string;
    unitStatuses?: Array<{ unitId: string; type: "DAY" | "SESSION"; title: string; date: string; status: string }>;
  }>;
};

type ReportResult = {
  data?: Array<Record<string, unknown>>;
  meta?: { total: number; page: number; pageSize: number; pageCount: number };
};

const reportTypes = [
  { value: "invitations", label: "Undangan" },
  { value: "responses", label: "Respons undangan" },
  { value: "institution-participants", label: "Peserta per lembaga" },
  { value: "attendance-daily", label: "Kehadiran harian" },
  { value: "attendance-session", label: "Kehadiran per sesi" },
  { value: "no-show", label: "Peserta tidak hadir" },
  { value: "returning-participants", label: "Peserta berulang" },
];

export const EventOperationsPage: React.FC<Props> = ({ mode }) => {
  const { data: identity } = useGetIdentity<AuthIdentity>();
  const canViewCrossEventReports = identity?.assignments.some((assignment) =>
    ["SUPER_ADMIN", "REPORT_VIEWER", "COMMITTEE_ORGANIZER"].includes(assignment.roleCode) && !assignment.eventId
    && (!assignment.startsAt || new Date(assignment.startsAt).getTime() <= Date.now())
    && (!assignment.endsAt || new Date(assignment.endsAt).getTime() > Date.now())) ?? false;
  const { id = "" } = useParams<{ id: string }>();
  const previewMode = import.meta.env.DEV && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attendance, setAttendance] = useState<AttendanceRecap | null>(null);
  const [reportType, setReportType] = useState("invitations");
  const [reportPage, setReportPage] = useState(1);
  const [report, setReport] = useState<ReportResult | null>(null);
  const [communicationRefreshKey, setCommunicationRefreshKey] = useState(0);
  const [attendanceSearch, setAttendanceSearch] = useState("");

  const load = async () => {
    if (mode === "communications") {
      setCommunicationRefreshKey((current) => current + 1);
      setLoading(false);
      setError("");
      setNotice("");
      return;
    }
    setLoading(true);
    setError("");
    if (previewMode) {
      if (mode === "attendance") {
        setAttendance({
          totalParticipants: 0,
          recapSummary: { fullAttendance: 0, partialAttendance: 0, lateAttendance: 0, excused: 0, absent: 0 },
          participantDetails: [],
        });
      } else {
        setReport({ data: [], meta: { total: 0, page: 1, pageSize: 25, pageCount: 1 } });
      }
      setNotice("Mode pratinjau: struktur submodul dapat dicoba, tetapi data tidak disimpan.");
      setLoading(false);
      return;
    }
    try {
      if (mode === "attendance") {
        setAttendance(await eventApi<AttendanceRecap>(`/events/${id}/attendance/recap`));
      } else {
        setReport(await eventApi<ReportResult>(`/reports/${reportType}?eventId=${encodeURIComponent(id)}&page=${reportPage}&pageSize=25`));
      }
    } catch (loadError) {
      if (mode === "attendance") setAttendance(null);
      else setReport(null);
      setError(loadError instanceof Error ? loadError.message : "Data submodul gagal dimuat.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id, mode, reportType, reportPage]);

  const exportReport = async () => {
    if (previewMode) {
      setNotice("Ekspor memerlukan event tersimpan dan layanan API aktif.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await eventApi<{ filename?: string; data?: string; contentType?: string; truncated?: boolean }>("/reports/export", {
        method: "POST",
        body: JSON.stringify({ reportType, format: "CSV", eventId: id }),
      });
      if (!result.data || !result.filename) throw new Error("Konten berkas ekspor tidak tersedia.");
      const blob = new Blob(["\uFEFF", result.data], { type: result.contentType || "text/csv;charset=utf-8" });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = result.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
      setNotice(result.truncated ? `Ekspor ${result.filename} berhasil, tetapi dibatasi sesuai batas maksimum.` : `Ekspor ${result.filename} berhasil diunduh.`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Laporan gagal diekspor.");
    } finally {
      setBusy(false);
    }
  };

  const pageTitle = mode === "attendance" ? "Kehadiran Event" : mode === "communications" ? "Komunikasi Event" : "Laporan Event";
  const description =
    mode === "attendance"
      ? "Pantau kehadiran individu, keterlambatan, izin, dan peserta yang belum tercatat."
      : mode === "communications"
        ? "Kelola pengumuman dan komunikasi kepada peserta berdasarkan segmentasi."
        : "Tinjau dan ekspor laporan khusus event tanpa mencampur data event lain.";
  const filteredParticipants = attendance?.participantDetails.filter((item) =>
    `${item.ustadzName} ${item.participantCode} ${item.institutionName || ""}`.toLocaleLowerCase("id-ID")
      .includes(attendanceSearch.trim().toLocaleLowerCase("id-ID"))) || [];

  return (
    <AdminLayout>
      <PageHeader
        title={pageTitle}
        description={description}
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Event", href: "/admin/events" }, { label: pageTitle }]}
        actions={
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Segarkan
          </button>
        }
      />
      <EventWorkspaceNav eventId={id} />

      {(error || notice) && (
        <div role={error ? "alert" : "status"} className={`mb-5 border-t-2 p-3 text-xs ${error ? "border-rose-500 bg-rose-50 text-rose-900" : "border-emerald-600 bg-emerald-50 text-emerald-950"}`}>
          {error || notice}
        </div>
      )}

      {mode === "attendance" && (
        <div className="space-y-5">
          <section className="grid grid-cols-2 border-y border-slate-200 bg-white sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Wajib presensi", attendance?.totalParticipants],
              ["Hadir penuh", attendance?.recapSummary.fullAttendance],
              ["Hadir sebagian", attendance?.recapSummary.partialAttendance],
              ["Terlambat", attendance?.recapSummary.lateAttendance],
              ["Izin", attendance?.recapSummary.excused],
              ["Tidak hadir", attendance?.recapSummary.absent],
            ].map(([label, value]) => (
              <div key={String(label)} className="border-b border-r border-slate-200 p-4">
                <p className="text-2xl font-black tabular-nums text-slate-950">{loading ? "—" : value ?? "—"}</p>
                <p className="mt-1 truncate text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
              </div>
            ))}
          </section>
          <p className="text-sm text-slate-600">Angka ringkasan mengikuti peserta yang memenuhi syarat check-in. Gunakan rapor untuk catat manual atau koreksi sesuai izin.</p>
          <label className="relative block max-w-xl"><span className="sr-only">Cari peserta dalam rekap kehadiran</span><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" aria-hidden="true" /><input type="search" value={attendanceSearch} onChange={(event) => setAttendanceSearch(event.target.value)} placeholder="Cari nama, kode, atau lembaga" className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700" /></label>
          <div className="overflow-hidden border border-slate-200 bg-white">
            <div className="hidden grid-cols-[9rem_minmax(12rem,1fr)_minmax(10rem,1fr)_8rem_9rem_7rem] gap-3 bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500 lg:grid">
              <span>Kode</span><span>Asatidz</span><span>Lembaga</span><span>Unit hadir</span><span>Status</span><span>Rapor</span>
            </div>
            {loading ? <div className="h-64 animate-pulse bg-slate-100" /> : filteredParticipants.length ? (
              <ul className="divide-y divide-slate-100">
                {filteredParticipants.map((participant) => (
                  <li key={participant.participantId} className="grid gap-2 px-4 py-4 text-sm lg:grid-cols-[9rem_minmax(12rem,1fr)_minmax(10rem,1fr)_8rem_9rem_7rem] lg:items-center lg:gap-3">
                    <span className="font-mono font-bold text-emerald-800">{participant.participantCode}</span>
                    <span className="font-black text-slate-900">{participant.ustadzName}</span>
                    <span className="text-slate-500">{participant.institutionName || "Individu"}</span>
                    <span className="font-bold tabular-nums text-slate-700">{participant.eligible === false ? `${participant.totalUnitsAttended ?? participant.totalSessionsAttended} historis`
                      : `${participant.totalUnitsAttended ?? participant.totalSessionsAttended}/${participant.requiredUnits ?? "—"}`}</span>
                    <StatusBadge label={attendanceStatusLabel[participant.statusCategory] || participant.statusCategory.replaceAll("_", " ")} variant={participant.statusCategory === "HADIR_PENUH" ? "success" : participant.statusCategory === "TIDAK_HADIR" ? "danger" : participant.statusCategory === "BELUM_DIMULAI" ? "neutral" : "warning"} />
                    <Link to={`/admin/events/${id}/attendance/${participant.participantId}/report`} className="inline-flex min-h-[40px] items-center justify-center whitespace-nowrap rounded-lg border border-emerald-300 bg-emerald-50 px-3 font-bold text-emerald-900 hover:bg-emerald-100">Buka rapor</Link>
                  </li>
                ))}
              </ul>
            ) : <div className="p-10 text-center text-sm text-slate-600">{attendanceSearch ? "Tidak ada peserta yang cocok." : "Belum ada data kehadiran untuk event ini."}</div>}
          </div>
          {attendance?.requiredUnits?.length ? (
            <section className="border border-slate-200 bg-white">
              <div className="border-b border-slate-200 p-4">
                <h2 className="text-sm font-black text-slate-900">Matriks kehadiran wajib</h2>
                <p className="mt-1 text-sm text-slate-600">Mode {attendance.attendanceMode === "DAILY_ONLY" ? "harian" : attendance.attendanceMode === "SESSION_ONLY" ? "per sesi" : "harian & sesi"} · tanggal tanpa kegiatan tidak dihitung.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-max text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="sticky left-0 z-10 min-w-56 border-r border-slate-200 bg-slate-50 px-4 py-3">Peserta</th>
                      {attendance.requiredUnits.map((unit) => <th key={unit.id} scope="col" className="min-w-40 border-r border-slate-200 px-3 py-3"><span className="block text-emerald-700">{unit.type === "DAY" ? "Harian" : unit.qrEnabled === false ? "Sesi manual" : "Sesi QR"} · {new Date(`${unit.date}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span><span className="mt-1 block normal-case tracking-normal text-slate-700">{unit.title}</span></th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredParticipants.map((participant) => <tr key={participant.participantId}><th className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-3"><span className="block font-black text-slate-900">{participant.ustadzName}</span><span className="mt-1 block font-mono text-[10px] text-slate-500">{participant.participantCode}</span></th>{attendance.requiredUnits!.map((unit) => { const status = participant.unitStatuses?.find((item) => item.unitId === unit.id)?.status || "NOT_RECORDED"; return <td key={unit.id} className="border-r border-slate-100 px-3 py-3"><StatusBadge label={attendanceStatusLabel[status] || status.replaceAll("_", " ")} variant={["PRESENT", "LATE"].includes(status) ? "success" : ["EXCUSED", "PERMITTED"].includes(status) ? "warning" : status === "ABSENT" ? "danger" : "neutral"} /></td>; })}</tr>)}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>
      )}

      {mode === "communications" && (
        <EventCommunicationCenter key={id} eventId={id} previewMode={previewMode} refreshKey={communicationRefreshKey} />
      )}

      {mode === "reports" && (
        <div className="space-y-5">
          <div className="grid gap-3 border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Jenis laporan</span><select value={reportType} onChange={(event) => { setReportType(event.target.value); setReportPage(1); setReport(null); }} className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold">{reportTypes.filter((type) => type.value !== "returning-participants" || canViewCrossEventReports).map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
            <button type="button" onClick={() => void exportReport()} disabled={busy} className="mt-auto inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"><Download className="h-4 w-4" /> Ekspor CSV</button>
          </div>
          <div className="overflow-x-auto border border-slate-200 bg-white">
            {loading ? <div className="h-64 animate-pulse bg-slate-100" /> : report?.data?.length ? (
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-50 text-xs font-black text-slate-600"><tr>{Object.keys(report.data[0]).map((key) => <th key={key} className="whitespace-nowrap px-4 py-3">{key.replaceAll("_", " ")}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">{report.data.map((row, index) => <tr key={String(row.id || index)}>{Object.keys(report.data![0]).map((key) => <td key={key} title={String(row[key] ?? "—")} className="max-w-64 truncate whitespace-nowrap px-4 py-3 text-sm text-slate-700">{String(row[key] ?? "—")}</td>)}</tr>)}</tbody>
              </table>
            ) : <div className="p-10 text-center text-sm text-slate-600">Belum ada data untuk laporan ini.</div>}
          </div>
          {report?.meta && report.meta.total > 0 && <nav aria-label="Halaman laporan event" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <span>{(report.meta.page - 1) * report.meta.pageSize + 1}–{Math.min(report.meta.page * report.meta.pageSize, report.meta.total)} dari {report.meta.total} data</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setReportPage((page) => Math.max(1, page - 1))} disabled={loading || report.meta.page <= 1} className="min-h-11 rounded-lg border border-slate-300 px-3 disabled:opacity-50">Sebelumnya</button>
              <span className="whitespace-nowrap">{report.meta.page}/{report.meta.pageCount}</span>
              <button type="button" onClick={() => setReportPage((page) => page + 1)} disabled={loading || report.meta.page >= report.meta.pageCount} className="min-h-11 rounded-lg border border-slate-300 px-3 disabled:opacity-50">Berikutnya</button>
            </div>
          </nav>}
        </div>
      )}
    </AdminLayout>
  );
};
