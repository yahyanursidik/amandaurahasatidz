import React, { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { CommitteeLayout } from "@/components/layouts/CommitteeLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { eventApi } from "@/lib/eventApi";

type Report = {
  generatedAt: string;
  event: { code: string; name: string; startDate: string; endDate: string; venueName?: string | null; attendanceMode: string };
  participant: { participantCode: string; registrationSource: string; confirmationStatus: string; approvalStatus: string; ustadzName: string; institutionName?: string | null };
  attendance: {
    totalUnitsAttended: number;
    fulfilledUnits: number;
    requiredUnits: number;
    completionPercentage: number;
    statusCategory: string;
    unitStatuses: Array<{ unitId: string; type: "DAY" | "SESSION"; title: string; date: string; status: string }>;
  };
};

const statusVariant = (status: string) =>
  ["PRESENT", "LATE", "HADIR_PENUH"].includes(status)
    ? "success" as const
    : ["EXCUSED", "PERMITTED", "HADIR_SEBAGIAN", "IZIN_LENGKAP"].includes(status)
      ? "warning" as const
      : ["ABSENT", "TIDAK_HADIR"].includes(status)
        ? "danger" as const
        : "neutral" as const;

const previewReport: Report = {
  generatedAt: new Date().toISOString(),
  event: { code: "ADA-2026-BDG", name: "Daurah Asatidz Nasional 2026", startDate: "2026-08-15", endDate: "2026-08-17", venueName: "Bandung", attendanceMode: "DAILY_AND_SESSION" },
  participant: { participantCode: "ADA-BDG-001", registrationSource: "INSTITUTION_DELEGATION", confirmationStatus: "CONFIRMED", approvalStatus: "APPROVED", ustadzName: "Ustadz Abdullah, Lc.", institutionName: "Ma'had Ilmu Sunnah Bandung" },
  attendance: { totalUnitsAttended: 3, fulfilledUnits: 3, requiredUnits: 4, completionPercentage: 75, statusCategory: "HADIR_SEBAGIAN", unitStatuses: [
    { unitId: "DAY:1", type: "DAY", title: "Kehadiran harian · Hari 1", date: "2026-08-15", status: "PRESENT" },
    { unitId: "SESSION:1", type: "SESSION", title: "Pembukaan", date: "2026-08-15", status: "PRESENT" },
    { unitId: "DAY:2", type: "DAY", title: "Kehadiran harian · Hari 2", date: "2026-08-17", status: "PRESENT" },
    { unitId: "SESSION:2", type: "SESSION", title: "Materi penutup", date: "2026-08-17", status: "NOT_RECORDED" },
  ] },
};

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const AttendanceReportPage: React.FC = () => {
  const { id = "", participantId = "" } = useParams();
  const committeeMode = useLocation().pathname.startsWith("/committee/");
  const backHref = committeeMode ? "/committee/attendance" : `/admin/events/${id}/attendance`;
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isUuid(id) || !isUuid(participantId)) {
      setReport(previewReport);
      return;
    }
    void eventApi<Report>(`/events/${id}/attendance/${participantId}/report`)
      .then(setReport)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Rapor tidak dapat dimuat."));
  }, [id, participantId]);

  const content = (
    <>
      <div className="attendance-report-actions">
        <PageHeader title="Rapor kehadiran peserta" description="Ringkasan resmi kehadiran harian dan sesi untuk satu peserta." breadcrumbs={committeeMode ? [{ label: "Panitia", href: "/committee" }, { label: "Kehadiran", href: "/committee/attendance" }, { label: "Rapor" }] : [{ label: "Admin", href: "/admin" }, { label: "Event", href: "/admin/events" }, { label: "Kehadiran", href: backHref }, { label: "Rapor" }]} actions={<div className="flex gap-2"><Link to={backHref} className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700"><ArrowLeft className="h-4 w-4" />Kembali</Link><button type="button" onClick={() => window.print()} disabled={!report} className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50"><Printer className="h-4 w-4" />Cetak / PDF</button></div>} />
      </div>
      {error ? <div role="alert" className="border-y border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-900">{error}</div> : !report ? <div className="h-96 animate-pulse bg-slate-100" /> : (
        <article className="attendance-report mx-auto max-w-5xl border border-slate-200 bg-white">
          <header className="border-b-4 border-emerald-700 p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Aman Daurah Asatidz · {report.event.code}</p>
            <h1 className="mt-3 text-2xl font-black text-slate-950">{report.event.name}</h1>
            <p className="mt-2 text-sm text-slate-600">{new Date(`${report.event.startDate}T00:00:00`).toLocaleDateString("id-ID", { dateStyle: "long" })}–{new Date(`${report.event.endDate}T00:00:00`).toLocaleDateString("id-ID", { dateStyle: "long" })} · {report.event.venueName || "Lokasi belum dicatat"}</p>
          </header>
          <section className="grid border-b border-slate-200 md:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="p-6 sm:p-8"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Peserta</p><h2 className="mt-2 text-xl font-black text-slate-950">{report.participant.ustadzName}</h2><p className="mt-2 text-sm text-slate-600">{report.participant.participantCode} · {report.participant.institutionName || "Peserta individual"}</p><p className="mt-1 text-xs text-slate-500">Jalur: {report.participant.registrationSource.replaceAll("_", " ")}</p></div>
            <div className="border-t border-slate-200 bg-slate-50 p-6 md:border-l md:border-t-0"><p className="text-4xl font-black tabular-nums text-emerald-800">{report.attendance.completionPercentage}%</p><p className="mt-1 text-sm font-bold text-slate-600">{report.attendance.fulfilledUnits}/{report.attendance.requiredUnits} unit terpenuhi</p><div className="mt-3"><StatusBadge label={report.attendance.statusCategory.replaceAll("_", " ")} variant={statusVariant(report.attendance.statusCategory)} /></div></div>
          </section>
          <section className="p-6 sm:p-8"><h2 className="text-base font-black text-slate-950">Rincian hari dan sesi</h2><div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Jenis</th><th className="px-4 py-3">Unit kehadiran</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{report.attendance.unitStatuses.map((unit) => <tr key={unit.unitId}><td className="whitespace-nowrap px-4 py-3">{new Date(`${unit.date}T00:00:00`).toLocaleDateString("id-ID")}</td><td className="px-4 py-3 font-bold">{unit.type === "DAY" ? "Harian" : "Sesi"}</td><td className="px-4 py-3">{unit.title}</td><td className="px-4 py-3"><StatusBadge label={unit.status.replaceAll("_", " ")} variant={statusVariant(unit.status)} /></td></tr>)}</tbody></table></div></section>
          <footer className="border-t border-slate-200 bg-slate-50 px-6 py-4 text-xs text-slate-500 sm:px-8">Dibuat {new Date(report.generatedAt).toLocaleString("id-ID")} · Data mengikuti catatan kehadiran dan koreksi panitia.</footer>
        </article>
      )}
    </>
  );
  return committeeMode ? <CommitteeLayout>{content}</CommitteeLayout> : <AdminLayout>{content}</AdminLayout>;
};
