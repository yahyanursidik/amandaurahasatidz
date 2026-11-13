import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CommitteeLayout } from "@/components/layouts/CommitteeLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { committeeApi, CommitteeAssignment, formatCommitteeDate, roleLabel } from "@/lib/committeeApi";
import { AlertTriangle, ArrowRight, CalendarClock, Contact, QrCode, ScanLine, Users } from "lucide-react";

type CommitteeMetrics = {
  totalParticipantsCount: number;
  pendingReviewCount: number;
  waitlistedCount: number;
  awaitingConfirmationCount: number;
  checkinIssuesCount: number;
  duplicateScansCount: number;
  noShowParticipantsCount: number;
  recentCheckins: Array<{ id: string; result: string; createdAt: string }>;
};

export const CommitteeDashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<CommitteeMetrics | null>(null);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState("");
  const [assignments, setAssignments] = useState<CommitteeAssignment[]>([]);
  const [eventId, setEventId] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setMetrics(null); setError(""); setOffline(false);
      try {
        const context = await committeeApi<{ assignments: CommitteeAssignment[] }>("/committee/context", { signal: controller.signal });
        if (controller.signal.aborted) return;
        const now = Date.now();
        const active = context.assignments.filter((assignment) =>
          (!assignment.startsAt || new Date(assignment.startsAt).getTime() <= now)
          && (!assignment.endsAt || new Date(assignment.endsAt).getTime() > now));
        setAssignments(active);
        const selectedEventId = active.some((assignment) => assignment.eventId === eventId)
          ? eventId : active[0]?.eventId || "";
        if (selectedEventId !== eventId) { setEventId(selectedEventId); return; }
        if (!selectedEventId || !active.some((assignment) => assignment.eventId === selectedEventId && assignment.effectivePermissions?.includes("attendance.read"))) return;
        const next = await committeeApi<CommitteeMetrics>(`/dashboard/committee?eventId=${selectedEventId}`, { signal: controller.signal });
        if (!controller.signal.aborted) setMetrics(next);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setOffline(true);
        setError(cause instanceof Error ? cause.message : "Dashboard panitia belum dapat dimuat.");
      }
    };
    void load();
    return () => controller.abort();
  }, [eventId]);

  const activeAssignment = assignments.find((assignment) => assignment.eventId === eventId);
  const eventPermissions = new Set(assignments.filter((assignment) => assignment.eventId === eventId)
    .flatMap((assignment) => assignment.effectivePermissions || []));
  const canReadParticipants = eventPermissions.has("participants.read");
  const canApprove = eventPermissions.has("participants.approve");
  const canScan = eventPermissions.has("attendance.record");
  const canReadAttendance = eventPermissions.has("attendance.read");

  return (
    <CommitteeLayout>
      <PageHeader
        title="Dashboard Panitia"
        description="Prioritas pendaftaran, keputusan peserta, dan operasional event dalam satu tempat."
        actions={<StatusBadge label={offline ? "Koneksi bermasalah" : activeAssignment ? "Tugas aktif" : "Belum ditugaskan"} variant={offline ? "warning" : activeAssignment ? "success" : "neutral"} />}
      />

      {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">{error}</div>}

      <section className="mb-5 grid gap-4 border-t-4 border-teal-700 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_18rem] md:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-teal-800">Lingkup kerja aktif</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">{activeAssignment?.eventName || "Pilih event penugasan"}</h2>
          <p className="mt-1 text-sm text-slate-600">{activeAssignment ? `${roleLabel(activeAssignment.committeeRole)} · batas konfirmasi ${formatCommitteeDate(activeAssignment.attendanceConfirmationDeadline)}` : "Data hanya ditampilkan untuk event yang ditugaskan kepada akun Anda."}</p>
        </div>
        <select value={eventId} onChange={(event) => setEventId(event.target.value)} className="min-h-[46px] border border-slate-300 bg-white px-3 text-sm font-bold"><option value="">Pilih event</option>{assignments.filter((assignment, index, list) => list.findIndex((item) => item.eventId === assignment.eventId) === index).map((assignment) => <option key={assignment.eventId} value={assignment.eventId}>{assignment.eventCode} · {assignment.eventName}</option>)}</select>
      </section>

      {!activeAssignment && !offline && <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Belum ada penugasan aktif. Minta admin menetapkan event dan masa tugas sebelum mengelola peserta.</p>}

      {activeAssignment?.attendanceConfirmationDeadline && <div className="mb-5 flex items-center gap-3 border-y border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><CalendarClock className="h-5 w-5 shrink-0 text-amber-700" /><span>Konfirmasi kehadiran peserta ditutup <strong>{formatCommitteeDate(activeAssignment.attendanceConfirmationDeadline)}</strong>. Kebijakan terlambat: {activeAssignment.lateConfirmationPolicy || "BLOCK"}.</span></div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Peserta", value: metrics?.totalParticipantsCount, icon: Users },
          { label: "Perlu keputusan", value: metrics?.pendingReviewCount, icon: Contact },
          { label: "Daftar tunggu", value: metrics?.waitlistedCount, icon: CalendarClock },
          { label: "Menunggu konfirmasi", value: metrics?.awaitingConfirmationCount, icon: Contact },
          { label: "Masalah check-in", value: metrics?.checkinIssuesCount, icon: AlertTriangle },
        ].map((metric) => (
          <div key={metric.label} className="border-t-2 border-teal-700 bg-slate-50 p-4">
            <metric.icon className="h-4 w-4 text-teal-800" />
            <p className="mt-3 text-2xl font-black tabular-nums text-slate-950">{metric.value ?? "—"}</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-500">{metric.label}</p>
          </div>
        ))}
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {canApprove && <Link
          to={`/committee/participants?eventId=${eventId}&status=PENDING_REVIEW`}
          className="group rounded-xl bg-teal-900 p-6 text-white transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <div className="flex items-start justify-between"><span className="grid h-11 w-11 place-items-center rounded-lg bg-white/15"><Users className="h-6 w-6" /></span><ArrowRight className="h-5 w-5 text-teal-200" /></div>
          <h2 className="mt-6 text-lg font-black">Tinjau pendaftaran</h2>
          <p className="mt-2 text-sm leading-6 text-teal-100">{metrics?.pendingReviewCount ?? "—"} peserta menunggu keputusan. Setujui atau pilih solusi lainnya.</p>
        </Link>}
        {canReadParticipants && <Link to={`/committee/participants?eventId=${eventId}&status=AWAITING_CONFIRMATION`}
          className="group rounded-xl border border-amber-200 bg-amber-50 p-6 transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700">
          <div className="flex items-start justify-between"><span className="grid h-11 w-11 place-items-center rounded-lg bg-white text-amber-800"><CalendarClock className="h-6 w-6" /></span><ArrowRight className="h-5 w-5 text-amber-700" /></div>
          <h2 className="mt-6 text-lg font-black text-slate-950">Tindak lanjut konfirmasi</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">{metrics?.awaitingConfirmationCount ?? "—"} peserta disetujui belum menyatakan hadir. Buka daftar untuk menghubungi mereka.</p>
        </Link>}
        {canScan && <Link
          to={`/committee/check-in?eventId=${encodeURIComponent(eventId)}`}
          className="group rounded-xl bg-slate-950 p-6 text-white transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <div className="flex items-start justify-between">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-teal-400/15 text-teal-300">
              <ScanLine className="h-6 w-6" />
            </span>
            <ArrowRight className="h-5 w-5 text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-teal-300" />
          </div>
          <h2 className="mt-6 text-lg font-black">Scanner check-in</h2>
          <p className="mt-2 text-sm leading-5 text-slate-300">Pindai QR pribadi, cari nama, atau masukkan kode peserta.</p>
        </Link>}

        {canScan && <Link
          to={`/committee/location-qr?eventId=${encodeURIComponent(eventId)}`}
          className="group rounded-xl border border-teal-200 bg-teal-50 p-6 transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <div className="flex items-start justify-between">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-white text-teal-800 shadow-sm">
              <QrCode className="h-6 w-6" />
            </span>
            <ArrowRight className="h-5 w-5 text-teal-300 transition-transform group-hover:translate-x-1 group-hover:text-teal-800" />
          </div>
          <h2 className="mt-6 text-lg font-black text-slate-950">Tampilkan QR lokasi</h2>
          <p className="mt-2 text-sm leading-5 text-slate-600">Tampilkan QR agar asatidz dapat check-in mandiri dari portal.</p>
        </Link>}

        {canReadParticipants && <Link
          to={`/committee/participants?eventId=${eventId}`}
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
        </Link>}
      </section>

      {canReadAttendance && <section className="mt-6 rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <h2 className="text-sm font-black text-slate-900">Aktivitas terbaru</h2>
            <p className="mt-1 text-[11px] text-slate-500">Hasil check-in yang baru diproses.</p>
          </div>
          <Link to={`/committee/attendance?eventId=${encodeURIComponent(eventId)}`} className="min-h-[44px] whitespace-nowrap px-2 py-3 text-sm font-bold text-teal-800">
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
      </section>}
    </CommitteeLayout>
  );
};
