import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CommitteeLayout } from "@/components/layouts/CommitteeLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { committeeApi, CommitteeAssignment, formatCommitteeDate, roleLabel } from "@/lib/committeeApi";
import { AlertTriangle, ArrowRight, CalendarClock, CheckSquare, Contact, CopyCheck, QrCode, ScanLine, Users } from "lucide-react";

type CommitteeMetrics = {
  totalParticipantsCount: number;
  checkinIssuesCount: number;
  duplicateScansCount: number;
  noShowParticipantsCount: number;
  recentCheckins: Array<{ id: string; result: string; createdAt: string }>;
};

export const CommitteeDashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<CommitteeMetrics | null>(null);
  const [offline, setOffline] = useState(false);
  const [assignments, setAssignments] = useState<CommitteeAssignment[]>([]);
  const [eventId, setEventId] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const context = await committeeApi<{ assignments: CommitteeAssignment[] }>("/committee/context");
        setAssignments(context.assignments);
        const selectedEventId = eventId || context.assignments[0]?.eventId || "";
        if (selectedEventId && !eventId) setEventId(selectedEventId);
        setMetrics(await committeeApi<CommitteeMetrics>(`/dashboard/committee${selectedEventId ? `?eventId=${selectedEventId}` : ""}`));
      } catch {
        setOffline(true);
      }
    };
    void load();
  }, [eventId]);

  const activeAssignment = assignments.find((assignment) => assignment.eventId === eventId);

  return (
    <CommitteeLayout>
      <PageHeader
        title="Dashboard Panitia"
        description="Pusat kendali check-in, QR lokasi, kehadiran, dan informasi peserta."
        actions={<StatusBadge label={offline ? "Mode lokal" : "Event aktif"} variant={offline ? "warning" : "success"} />}
      />

      <section className="mb-5 grid gap-4 border-t-4 border-teal-700 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_18rem] md:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-teal-800">Lingkup kerja aktif</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">{activeAssignment?.eventName || "Pilih event penugasan"}</h2>
          <p className="mt-1 text-sm text-slate-600">{activeAssignment ? `${roleLabel(activeAssignment.committeeRole)} · batas konfirmasi ${formatCommitteeDate(activeAssignment.attendanceConfirmationDeadline)}` : "Data hanya ditampilkan untuk event yang ditugaskan kepada akun Anda."}</p>
        </div>
        <select value={eventId} onChange={(event) => setEventId(event.target.value)} className="min-h-[46px] border border-slate-300 bg-white px-3 text-sm font-bold"><option value="">Pilih event</option>{assignments.map((assignment) => <option key={assignment.id} value={assignment.eventId}>{assignment.eventCode} · {assignment.eventName}</option>)}</select>
      </section>

      {activeAssignment?.attendanceConfirmationDeadline && <div className="mb-5 flex items-center gap-3 border-y border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><CalendarClock className="h-5 w-5 shrink-0 text-amber-700" /><span>Konfirmasi kehadiran peserta ditutup <strong>{formatCommitteeDate(activeAssignment.attendanceConfirmationDeadline)}</strong>. Kebijakan terlambat: {activeAssignment.lateConfirmationPolicy || "BLOCK"}.</span></div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Peserta", value: metrics?.totalParticipantsCount, icon: Users },
          { label: "Masalah check-in", value: metrics?.checkinIssuesCount, icon: AlertTriangle },
          { label: "Scan ganda", value: metrics?.duplicateScansCount, icon: CopyCheck },
          { label: "Belum hadir", value: metrics?.noShowParticipantsCount, icon: CheckSquare },
        ].map((metric) => (
          <div key={metric.label} className="border-t-2 border-teal-700 bg-slate-50 p-4">
            <metric.icon className="h-4 w-4 text-teal-800" />
            <p className="mt-3 text-2xl font-black tabular-nums text-slate-950">{metric.value ?? "—"}</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-500">{metric.label}</p>
          </div>
        ))}
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <Link
          to="/committee/check-in"
          className="group rounded-xl bg-slate-950 p-6 text-white transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <div className="flex items-start justify-between">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-teal-400/15 text-teal-300">
              <ScanLine className="h-6 w-6" />
            </span>
            <ArrowRight className="h-5 w-5 text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-teal-300" />
          </div>
          <h2 className="mt-6 text-lg font-black">Scanner check-in</h2>
          <p className="mt-2 text-xs leading-5 text-slate-300">Pindai QR peserta atau masukkan kode fallback secara manual.</p>
        </Link>

        <Link
          to="/committee/location-qr"
          className="group rounded-xl border border-teal-200 bg-teal-50 p-6 transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <div className="flex items-start justify-between">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-white text-teal-800 shadow-sm">
              <QrCode className="h-6 w-6" />
            </span>
            <ArrowRight className="h-5 w-5 text-teal-300 transition-transform group-hover:translate-x-1 group-hover:text-teal-800" />
          </div>
          <h2 className="mt-6 text-lg font-black text-slate-950">Tampilkan QR lokasi</h2>
          <p className="mt-2 text-xs leading-5 text-slate-600">Buka layar QR dinamis untuk self check-in peserta di ruangan.</p>
        </Link>

        <Link
          to="/committee/participants"
          className="group rounded-xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <div className="flex items-start justify-between">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-teal-50 text-teal-800">
              <Contact className="h-6 w-6" />
            </span>
            <ArrowRight className="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-teal-800" />
          </div>
          <h2 className="mt-6 text-lg font-black text-slate-950">Hubungi peserta</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Buka WhatsApp atau email dengan template pesan panitia yang dapat disunting.</p>
        </Link>
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <h2 className="text-sm font-black text-slate-900">Aktivitas terbaru</h2>
            <p className="mt-1 text-[11px] text-slate-500">Hasil check-in yang baru diproses.</p>
          </div>
          <Link to="/committee/attendance" className="min-h-[44px] whitespace-nowrap px-2 py-3 text-xs font-bold text-teal-800">
            Lihat rekap
          </Link>
        </div>
        <div className="p-5">
          {metrics?.recentCheckins?.length ? (
            <div className="space-y-2">
              {metrics.recentCheckins.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-xs">
                  <span className="font-mono text-slate-500">{new Date(item.createdAt).toLocaleString("id-ID")}</span>
                  <StatusBadge label={item.result} variant={item.result === "SUCCESS" ? "success" : "warning"} />
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-xs text-slate-500">Belum ada aktivitas check-in untuk ditampilkan.</p>
          )}
        </div>
      </section>
    </CommitteeLayout>
  );
};
