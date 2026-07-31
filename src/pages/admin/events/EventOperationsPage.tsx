import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Bell,
  CheckCircle2,
  Download,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EventWorkspaceNav } from "@/components/admin/events/EventWorkspaceNav";
import { eventApi } from "@/lib/eventApi";

type Mode = "attendance" | "communications" | "reports";
type Props = { mode: Mode };

type AttendanceRecap = {
  totalParticipants: number;
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
    statusCategory: string;
  }>;
};

type Announcement = {
  id: string;
  title: string;
  body: string;
  audienceType: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
};

type ReportResult = {
  data?: Array<Record<string, unknown>>;
  meta?: Record<string, unknown>;
  total?: number;
  page?: number;
  pageSize?: number;
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
  const { id = "" } = useParams<{ id: string }>();
  const previewMode = !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attendance, setAttendance] = useState<AttendanceRecap | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [reportType, setReportType] = useState("invitations");
  const [report, setReport] = useState<ReportResult | null>(null);
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    if (previewMode) {
      if (mode === "attendance") {
        setAttendance({
          totalParticipants: 0,
          recapSummary: { fullAttendance: 0, partialAttendance: 0, lateAttendance: 0, excused: 0, absent: 0 },
          participantDetails: [],
        });
      } else if (mode === "communications") {
        setAnnouncements([]);
      } else {
        setReport({ data: [], total: 0, page: 1, pageSize: 25 });
      }
      setNotice("Mode pratinjau: struktur submodul dapat dicoba, tetapi data tidak disimpan.");
      setLoading(false);
      return;
    }
    try {
      if (mode === "attendance") {
        setAttendance(await eventApi<AttendanceRecap>(`/events/${id}/attendance/recap`));
      } else if (mode === "communications") {
        setAnnouncements(await eventApi<Announcement[]>(`/events/${id}/announcements`));
      } else {
        setReport(await eventApi<ReportResult>(`/reports/${reportType}?eventId=${encodeURIComponent(id)}&page=1&pageSize=25`));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Data submodul gagal dimuat.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id, mode, reportType]);

  const createAnnouncement = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (previewMode) {
      setAnnouncements((current) => [
        {
          id: `preview-${Date.now()}`,
          title: String(form.get("title") || ""),
          body: String(form.get("body") || ""),
          audienceType: String(form.get("audienceType") || "ALL_PARTICIPANTS"),
          status: "DRAFT",
          publishedAt: null,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ]);
      setShowAnnouncementForm(false);
      setNotice("Draft ditambahkan hanya pada pratinjau lokal.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await eventApi(`/events/${id}/announcements`, {
        method: "POST",
        body: JSON.stringify({
          title: form.get("title"),
          body: form.get("body"),
          audienceType: form.get("audienceType"),
        }),
      });
      setShowAnnouncementForm(false);
      setNotice("Pengumuman disimpan sebagai draft.");
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Pengumuman gagal dibuat.");
    } finally {
      setBusy(false);
    }
  };

  const publishAnnouncement = async (announcementId: string) => {
    if (previewMode) {
      setAnnouncements((current) =>
        current.map((announcement) =>
          announcement.id === announcementId
            ? { ...announcement, status: "PUBLISHED", publishedAt: new Date().toISOString() }
            : announcement,
        ),
      );
      setNotice("Status diperbarui hanya pada pratinjau lokal.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await eventApi(`/events/${id}/announcements/${announcementId}/publish`, {
        method: "POST",
        body: JSON.stringify({ sendEmailNotification: false }),
      });
      setNotice("Pengumuman dipublikasikan.");
      await load();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Pengumuman gagal dipublikasikan.");
    } finally {
      setBusy(false);
    }
  };

  const exportReport = async () => {
    if (previewMode) {
      setNotice("Ekspor memerlukan event tersimpan dan layanan API aktif.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await eventApi<{ filename?: string }>("/reports/export", {
        method: "POST",
        body: JSON.stringify({ reportType, format: "CSV", eventId: id }),
      });
      setNotice(result.filename ? `Ekspor dibuat: ${result.filename}` : "Ekspor laporan berhasil dibuat.");
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
              ["Peserta", attendance?.totalParticipants],
              ["Hadir penuh", attendance?.recapSummary.fullAttendance],
              ["Hadir sebagian", attendance?.recapSummary.partialAttendance],
              ["Terlambat", attendance?.recapSummary.lateAttendance],
              ["Izin", attendance?.recapSummary.excused],
              ["Belum hadir", attendance?.recapSummary.absent],
            ].map(([label, value]) => (
              <div key={String(label)} className="border-b border-r border-slate-200 p-4">
                <p className="text-2xl font-black tabular-nums text-slate-950">{loading ? "—" : value ?? "—"}</p>
                <p className="mt-1 truncate text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
              </div>
            ))}
          </section>
          <div className="overflow-hidden border border-slate-200 bg-white">
            <div className="hidden grid-cols-[9rem_minmax(12rem,1fr)_minmax(10rem,1fr)_8rem_9rem] gap-3 bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500 lg:grid">
              <span>Kode</span><span>Asatidz</span><span>Lembaga</span><span>Sesi hadir</span><span>Status</span>
            </div>
            {loading ? <div className="h-64 animate-pulse bg-slate-100" /> : attendance?.participantDetails.length ? (
              <ul className="divide-y divide-slate-100">
                {attendance.participantDetails.map((participant) => (
                  <li key={participant.participantId} className="grid gap-2 px-4 py-4 text-xs lg:grid-cols-[9rem_minmax(12rem,1fr)_minmax(10rem,1fr)_8rem_9rem] lg:items-center lg:gap-3">
                    <span className="font-mono font-bold text-emerald-800">{participant.participantCode}</span>
                    <span className="font-black text-slate-900">{participant.ustadzName}</span>
                    <span className="text-slate-500">{participant.institutionName || "Individu"}</span>
                    <span className="font-bold tabular-nums text-slate-700">{participant.totalSessionsAttended}</span>
                    <StatusBadge label={participant.statusCategory.replaceAll("_", " ")} variant={participant.statusCategory === "HADIR" ? "success" : "warning"} />
                  </li>
                ))}
              </ul>
            ) : <div className="p-10 text-center text-xs text-slate-500">Belum ada data kehadiran untuk event ini.</div>}
          </div>
        </div>
      )}

      {mode === "communications" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-base font-black text-slate-900">Pengumuman</h2><p className="mt-1 text-xs text-slate-500">Draft harus ditinjau sebelum dipublikasikan kepada peserta.</p></div>
            <button type="button" onClick={() => setShowAnnouncementForm((value) => !value)} className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white hover:bg-emerald-800"><Plus className="h-4 w-4" /> Buat pengumuman</button>
          </div>
          {showAnnouncementForm && (
            <form onSubmit={createAnnouncement} className="grid gap-3 border-t-2 border-emerald-700 bg-white p-4">
              <input name="title" required placeholder="Judul pengumuman" className="min-h-[44px] rounded-lg border border-slate-300 px-3 text-xs" />
              <textarea name="body" required rows={5} placeholder="Isi pengumuman" className="min-h-28 rounded-lg border border-slate-300 p-3 text-xs" />
              <div className="flex flex-wrap justify-between gap-3">
                <select name="audienceType" className="min-h-[44px] rounded-lg border border-slate-300 px-3 text-xs"><option value="ALL_PARTICIPANTS">Semua peserta</option><option value="APPROVED_PARTICIPANTS">Peserta disetujui</option><option value="ATTENDED_PARTICIPANTS">Peserta hadir</option></select>
                <button disabled={busy} className="min-h-[44px] whitespace-nowrap rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white disabled:opacity-50">Simpan draft</button>
              </div>
            </form>
          )}
          {loading ? <div className="h-64 animate-pulse bg-slate-100" /> : announcements.length ? (
            <div className="divide-y divide-slate-100 border border-slate-200 bg-white">
              {announcements.map((announcement) => (
                <article key={announcement.id} className="grid gap-3 p-5 lg:grid-cols-[minmax(0,1fr)_12rem] lg:items-start">
                  <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-black text-slate-900">{announcement.title}</h3><StatusBadge label={announcement.status} variant={announcement.status === "PUBLISHED" ? "success" : "neutral"} /></div><p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">{announcement.body}</p><p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">{announcement.audienceType.replaceAll("_", " ")}</p></div>
                  {announcement.status === "DRAFT" && <button type="button" onClick={() => void publishAnnouncement(announcement.id)} disabled={busy} className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-xs font-bold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"><Bell className="h-4 w-4" /> Publikasikan</button>}
                </article>
              ))}
            </div>
          ) : <div className="border border-dashed border-slate-300 bg-white p-10 text-center text-xs text-slate-500">Belum ada pengumuman.</div>}
        </div>
      )}

      {mode === "reports" && (
        <div className="space-y-5">
          <div className="grid gap-3 border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label><span className="mb-1.5 block text-xs font-bold text-slate-700">Jenis laporan</span><select value={reportType} onChange={(event) => setReportType(event.target.value)} className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold">{reportTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
            <button type="button" onClick={() => void exportReport()} disabled={busy} className="mt-auto inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"><Download className="h-4 w-4" /> Ekspor CSV</button>
          </div>
          <div className="overflow-x-auto border border-slate-200 bg-white">
            {loading ? <div className="h-64 animate-pulse bg-slate-100" /> : report?.data?.length ? (
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500"><tr>{Object.keys(report.data[0]).slice(0, 6).map((key) => <th key={key} className="whitespace-nowrap px-4 py-3">{key.replaceAll("_", " ")}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">{report.data.map((row, index) => <tr key={String(row.id || index)}>{Object.keys(report.data![0]).slice(0, 6).map((key) => <td key={key} className="max-w-64 truncate whitespace-nowrap px-4 py-3 text-slate-700">{String(row[key] ?? "—")}</td>)}</tr>)}</tbody>
              </table>
            ) : <div className="p-10 text-center text-xs text-slate-500">Belum ada data untuk laporan ini.</div>}
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
