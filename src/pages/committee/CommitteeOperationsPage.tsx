/* Hallmark · macrostructure: Map / Diagram · tone: utilitarian · anchor hue: teal
 * genre: modern-minimal · theme: existing emerald-slate · nav: N3 · footer: Ft2
 * audience: panitia event · use: memantau kehadiran dan menerbitkan informasi
 * Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  Loader2,
  Megaphone,
  Plus,
  RefreshCcw,
  ScanLine,
  Send,
  Users,
} from "lucide-react";
import { CommitteeLayout } from "@/components/layouts/CommitteeLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  committeeApi,
  CommitteeAssignment,
  formatCommitteeDate,
  roleLabel,
} from "@/lib/committeeApi";

type AttendanceRecap = {
  eventId: string;
  attendanceMode?: string;
  requiredUnits?: Array<{ id: string; type: "DAY" | "SESSION"; title: string; date: string }>;
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
    institutionName?: string | null;
    totalSessionsAttended: number;
    totalUnitsAttended?: number;
    requiredUnits?: number;
    completionPercentage?: number;
    statusCategory: string;
    unitStatuses?: Array<{ unitId: string; status: string }>;
  }>;
};

type Announcement = {
  id: string;
  eventId: string;
  title: string;
  body: string;
  audienceType: string;
  status: string;
  publishedAt?: string | null;
  createdAt?: string | null;
};

type AudienceType =
  | "ALL_PARTICIPANTS"
  | "APPROVED_ONLY"
  | "UNCONFIRMED_ONLY"
  | "ATTENDED_SPECIFIC_DAY"
  | "COMMITTEE_ONLY";

const audienceOptions: Array<{ value: AudienceType; label: string; description: string }> = [
  {
    value: "ALL_PARTICIPANTS",
    label: "Semua peserta",
    description: "Seluruh peserta yang terdaftar pada event.",
  },
  {
    value: "APPROVED_ONLY",
    label: "Peserta disetujui",
    description: "Hanya peserta dengan status persetujuan aktif.",
  },
  {
    value: "UNCONFIRMED_ONLY",
    label: "Belum konfirmasi",
    description: "Peserta yang masih perlu menanggapi undangan.",
  },
  {
    value: "ATTENDED_SPECIFIC_DAY",
    label: "Sudah hadir",
    description: "Peserta yang telah memiliki riwayat presensi.",
  },
  {
    value: "COMMITTEE_ONLY",
    label: "Panitia",
    description: "Informasi internal operasional panitia.",
  },
];

const previewAssignments: CommitteeAssignment[] = [
  {
    id: "preview-assignment",
    eventId: "preview-event",
    eventName: "Daurah Asatidz Nasional 2026",
    eventCode: "ADA-2026-BDG",
    eventStatus: "PUBLISHED",
    committeeRole: "COMMITTEE_LEAD",
    venueName: "Bandung",
    attendanceConfirmationDeadline: "2026-08-10T23:59:00+07:00",
    invitationResponseDeadline: "2026-08-05T23:59:00+07:00",
    lateConfirmationPolicy: "BLOCK",
    effectivePermissions: [
      "attendance.read",
      "attendance.record",
      "announcements.read",
      "announcements.manage",
      "announcements.publish",
    ],
  },
];

const previewRecap: AttendanceRecap = {
  eventId: "preview-event",
  attendanceMode: "DAILY_AND_SESSION",
  requiredUnits: [
    { id: "DAY:preview-1", type: "DAY", title: "Kehadiran harian", date: "2026-08-15" },
    { id: "SESSION:preview-1", type: "SESSION", title: "Pembukaan", date: "2026-08-15" },
    { id: "SESSION:preview-2", type: "SESSION", title: "Materi utama", date: "2026-08-15" },
  ],
  totalParticipants: 3,
  recapSummary: {
    fullAttendance: 1,
    partialAttendance: 1,
    lateAttendance: 0,
    excused: 0,
    absent: 1,
  },
  participantDetails: [
    {
      participantId: "preview-1",
      participantCode: "ADA-BDG-001",
      ustadzName: "Ustadz Abdullah, Lc.",
      institutionName: "Ma'had Ilmu Sunnah Bandung",
      totalSessionsAttended: 2,
      totalUnitsAttended: 3,
      requiredUnits: 3,
      completionPercentage: 100,
      statusCategory: "HADIR_PENUH",
      unitStatuses: [{ unitId: "DAY:preview-1", status: "PRESENT" }, { unitId: "SESSION:preview-1", status: "PRESENT" }, { unitId: "SESSION:preview-2", status: "PRESENT" }],
    },
    {
      participantId: "preview-2",
      participantCode: "ADA-BDG-002",
      ustadzName: "Ustadz Ahmad",
      institutionName: "Markaz Sunnah",
      totalSessionsAttended: 1,
      totalUnitsAttended: 2,
      requiredUnits: 3,
      completionPercentage: 67,
      statusCategory: "HADIR_SEBAGIAN",
      unitStatuses: [{ unitId: "DAY:preview-1", status: "PRESENT" }, { unitId: "SESSION:preview-1", status: "PRESENT" }, { unitId: "SESSION:preview-2", status: "NOT_RECORDED" }],
    },
    {
      participantId: "preview-3",
      participantCode: "ADA-BDG-003",
      ustadzName: "Ustadz Hasan",
      institutionName: "Peserta individual",
      totalSessionsAttended: 0,
      totalUnitsAttended: 0,
      requiredUnits: 3,
      completionPercentage: 0,
      statusCategory: "TIDAK_HADIR",
      unitStatuses: [{ unitId: "DAY:preview-1", status: "ABSENT" }, { unitId: "SESSION:preview-1", status: "ABSENT" }, { unitId: "SESSION:preview-2", status: "ABSENT" }],
    },
  ],
};

const previewAnnouncements: Announcement[] = [
  {
    id: "preview-announcement",
    eventId: "preview-event",
    title: "Persiapan meja registrasi",
    body: "Pastikan scanner, daftar peserta, dan kode fallback siap sebelum pintu registrasi dibuka.",
    audienceType: "COMMITTEE_ONLY",
    status: "DRAFT",
    createdAt: "2026-07-31T08:00:00+07:00",
  },
];

const audienceLabel = (value: string) =>
  audienceOptions.find((item) => item.value === value)?.label || value.replaceAll("_", " ");

export const CommitteeOperationsPage: React.FC<{
  mode: "attendance" | "announcements";
}> = ({ mode }) => {
  const attendanceMode = mode === "attendance";
  const [assignments, setAssignments] = useState<CommitteeAssignment[]>([]);
  const [eventId, setEventId] = useState("");
  const [recap, setRecap] = useState<AttendanceRecap | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [search, setSearch] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState<"ALL" | "HADIR" | "TIDAK_HADIR">("ALL");
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audienceType, setAudienceType] = useState<AudienceType>("ALL_PARTICIPANTS");
  const [sendEmail, setSendEmail] = useState(false);
  const [feedback, setFeedback] = useState("");

  const activeAssignment = assignments.find((item) => item.eventId === eventId) || assignments[0];
  const canManageAnnouncements =
    preview ||
    Boolean(
      activeAssignment?.effectivePermissions?.includes("announcements.manage") ||
        activeAssignment?.effectivePermissions?.includes("announcements.publish"),
    );

  const loadContext = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const context = await committeeApi<{ assignments: CommitteeAssignment[] }>(
        "/committee/context",
      );
      if (context.assignments.length === 0) {
        setPreview(true);
        setAssignments(previewAssignments);
        setEventId("preview-event");
        setError(
          "Akun ini belum memiliki penugasan event aktif. Data contoh ditampilkan untuk evaluasi antarmuka.",
        );
      } else {
        setAssignments(context.assignments);
        setEventId((current) => current || context.assignments[0]?.eventId || "");
      }
    } catch (loadError) {
      setPreview(true);
      setAssignments(previewAssignments);
      setEventId("preview-event");
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Konteks penugasan belum tersedia. Mode pratinjau aktif.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const loadOperationalData = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError("");
    try {
      if (preview) {
        if (attendanceMode) setRecap(previewRecap);
        else setAnnouncements(previewAnnouncements);
      } else if (attendanceMode) {
        setRecap(await committeeApi<AttendanceRecap>(`/events/${eventId}/attendance/recap`));
      } else {
        setAnnouncements(
          await committeeApi<Announcement[]>(`/events/${eventId}/announcements`),
        );
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Data operasional gagal dimuat.",
      );
    } finally {
      setLoading(false);
    }
  }, [attendanceMode, eventId, preview]);

  useEffect(() => {
    void loadOperationalData();
  }, [loadOperationalData]);

  const filteredParticipants = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (recap?.participantDetails || []).filter((participant) => {
      const matchesSearch =
        !needle ||
        participant.ustadzName.toLowerCase().includes(needle) ||
        participant.participantCode.toLowerCase().includes(needle) ||
        (participant.institutionName || "").toLowerCase().includes(needle);
      const isAttended = !["TIDAK_HADIR", "BELUM_DIATUR", "BELUM_DIMULAI"].includes(participant.statusCategory);
      const matchesStatus = attendanceFilter === "ALL" ||
        (attendanceFilter === "HADIR" ? isAttended : !isAttended);
      return matchesSearch && matchesStatus;
    });
  }, [attendanceFilter, recap?.participantDetails, search]);

  const createAnnouncement = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!eventId || title.trim().length < 3 || body.trim().length < 5) {
      setFeedback("Judul minimal 3 karakter dan isi minimal 5 karakter.");
      return;
    }
    setActionLoading("create");
    setFeedback("");
    try {
      const created: Announcement = preview
        ? {
            id: `preview-${Date.now()}`,
            eventId,
            title: title.trim(),
            body: body.trim(),
            audienceType,
            status: "DRAFT",
            createdAt: new Date().toISOString(),
          }
        : await committeeApi<Announcement>(`/events/${eventId}/announcements`, {
            method: "POST",
            body: JSON.stringify({
              title: title.trim(),
              body: body.trim(),
              audienceType,
              sendEmailNotification: false,
            }),
          });
      setAnnouncements((current) => [created, ...current]);
      setTitle("");
      setBody("");
      setAudienceType("ALL_PARTICIPANTS");
      setSendEmail(false);
      setComposerOpen(false);
      setFeedback("Draf pengumuman berhasil dibuat.");
    } catch (createError) {
      setFeedback(
        createError instanceof Error ? createError.message : "Pengumuman gagal dibuat.",
      );
    } finally {
      setActionLoading("");
    }
  };

  const publishAnnouncement = async (announcement: Announcement) => {
    setActionLoading(announcement.id);
    setFeedback("");
    try {
      if (!preview) {
        await committeeApi(
          `/events/${eventId}/announcements/${announcement.id}/publish`,
          {
            method: "POST",
            body: JSON.stringify({ sendEmailNotification: sendEmail }),
          },
        );
      }
      setAnnouncements((current) =>
        current.map((item) =>
          item.id === announcement.id
            ? { ...item, status: "PUBLISHED", publishedAt: new Date().toISOString() }
            : item,
        ),
      );
      setFeedback(
        sendEmail
          ? "Pengumuman diterbitkan dan notifikasi email dijadwalkan."
          : "Pengumuman diterbitkan ke portal peserta.",
      );
    } catch (publishError) {
      setFeedback(
        publishError instanceof Error
          ? publishError.message
          : "Pengumuman gagal diterbitkan.",
      );
    } finally {
      setActionLoading("");
    }
  };

  if (loading && assignments.length === 0) {
    return (
      <CommitteeLayout>
        <div className="grid min-h-[55dvh] place-items-center" role="status">
          <div className="text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-teal-800 motion-reduce:animate-none" />
            <p className="mt-3 text-sm font-bold text-slate-700">
              Menyiapkan ruang kerja panitia…
            </p>
          </div>
        </div>
      </CommitteeLayout>
    );
  }

  return (
    <CommitteeLayout>
      <PageHeader
        title={attendanceMode ? "Kendali kehadiran" : "Pusat pengumuman"}
        description={
          attendanceMode
            ? "Pantau peserta hadir per individu, cari anomali, dan lanjutkan ke scanner."
            : "Susun draf, tentukan sasaran, lalu terbitkan informasi ke Portal Asatidz."
        }
        breadcrumbs={[
          { label: "Panitia", href: "/committee" },
          { label: attendanceMode ? "Kehadiran" : "Pengumuman" },
        ]}
        actions={
          attendanceMode ? (
            <Link
              to="/committee/check-in"
              className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg bg-teal-800 px-4 text-sm font-black text-white hover:bg-teal-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <ScanLine className="h-4 w-4" />
              Buka scanner
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setComposerOpen((current) => !current)}
              disabled={!canManageAnnouncements}
              className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg bg-teal-800 px-4 text-sm font-black text-white hover:bg-teal-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Buat draf
            </button>
          )
        }
      />

      {preview && (
        <div className="mb-5 flex items-start gap-3 border-y border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="font-black">Mode pratinjau operasional aktif</p>
            <p className="mt-1 text-xs leading-5">
              {error} Seluruh interaksi tetap dapat dicoba tanpa mengubah data produksi.
            </p>
          </div>
        </div>
      )}

      <section className="mb-6 grid gap-4 border-t-4 border-teal-800 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_20rem] md:items-center">
        <div className="min-w-0">
          <p className="font-mono text-xs font-black text-teal-800">
            {activeAssignment?.eventCode || "BELUM ADA EVENT"}
          </p>
          <h2 className="mt-1 min-w-0 text-lg font-black text-slate-950 [overflow-wrap:anywhere]">
            {activeAssignment?.eventName || "Pilih event penugasan"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {activeAssignment
              ? `${roleLabel(activeAssignment.committeeRole)} · konfirmasi ditutup ${formatCommitteeDate(activeAssignment.attendanceConfirmationDeadline)}`
              : "Data hanya dapat dibuka sesuai lingkup penugasan akun."}
          </p>
        </div>
        <div>
          <label htmlFor="committee-operation-event" className="text-xs font-bold text-slate-600">
            Lingkup event
          </label>
          <select
            id="committee-operation-event"
            value={eventId}
            onChange={(event) => setEventId(event.target.value)}
            className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold outline outline-2 outline-transparent focus-visible:outline-teal-700"
          >
            {assignments.map((assignment) => (
              <option key={assignment.id} value={assignment.eventId}>
                {assignment.eventCode} · {assignment.eventName}
              </option>
            ))}
          </select>
        </div>
      </section>

      {error && !preview && (
        <div role="alert" className="mb-5 border-t-4 border-rose-600 bg-rose-50 p-4 text-sm text-rose-900">
          <p className="font-black">Data belum dapat dimuat</p>
          <p className="mt-1 text-xs">{error}</p>
          <button
            type="button"
            onClick={() => void loadOperationalData()}
            className="mt-3 inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap text-xs font-black underline underline-offset-4"
          >
            <RefreshCcw className="h-4 w-4" />
            Coba lagi
          </button>
        </div>
      )}

      {feedback && (
        <div
          aria-live="polite"
          className="mb-5 flex items-center gap-3 border-y border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-900"
        >
          <Check className="h-4 w-4 shrink-0" />
          {feedback}
        </div>
      )}

      {attendanceMode ? (
        <div className="space-y-5">
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              {
                label: "Peserta",
                value: recap?.totalParticipants ?? "—",
                icon: Users,
              },
              {
                label: "Hadir penuh",
                value: recap?.recapSummary.fullAttendance ?? "—",
                icon: CheckCircle2,
              },
              {
                label: "Hadir sebagian",
                value: recap?.recapSummary.partialAttendance ?? "—",
                icon: ClipboardCheck,
              },
              {
                label: "Terlambat/izin",
                value:
                  recap
                    ? recap.recapSummary.lateAttendance + recap.recapSummary.excused
                    : "—",
                icon: AlertTriangle,
              },
              {
                label: "Belum hadir",
                value: recap?.recapSummary.absent ?? "—",
                icon: Eye,
              },
            ].map((item) => (
              <div key={item.label} className="border-t-2 border-teal-700 bg-slate-50 p-4">
                <item.icon className="h-4 w-4 text-teal-800" />
                <p className="mt-3 text-2xl font-black tabular-nums text-slate-950">
                  {item.value}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-600">{item.label}</p>
              </div>
            ))}
          </section>

          <section className="border border-slate-200 bg-white">
            <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-[minmax(0,1fr)_12rem_auto]">
              <div>
                <label htmlFor="attendance-search" className="text-xs font-bold text-slate-600">
                  Cari peserta
                </label>
                <input
                  id="attendance-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nama, lembaga, atau kode peserta"
                  className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-sm outline outline-2 outline-transparent hover:bg-slate-50 focus-visible:outline-teal-700"
                />
              </div>
              <div>
                <label htmlFor="attendance-filter" className="text-xs font-bold text-slate-600">
                  Status
                </label>
                <select
                  id="attendance-filter"
                  value={attendanceFilter}
                  onChange={(event) =>
                    setAttendanceFilter(
                      event.target.value as "ALL" | "HADIR" | "TIDAK_HADIR",
                    )
                  }
                  className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold outline outline-2 outline-transparent focus-visible:outline-teal-700"
                >
                  <option value="ALL">Semua status</option>
                  <option value="HADIR">Sudah hadir</option>
                  <option value="TIDAK_HADIR">Belum hadir</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => void loadOperationalData()}
                className="mt-auto inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 px-4 text-sm font-black text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <RefreshCcw className="h-4 w-4" />
                Segarkan
              </button>
            </div>
            <div className="divide-y divide-slate-200">
              {filteredParticipants.map((participant) => (
                <article
                  key={participant.participantId}
                  className="grid items-center gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_8rem_auto_auto]"
                >
                  <div className="min-w-0">
                    <h3 className="font-black text-slate-950">{participant.ustadzName}</h3>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {participant.institutionName || "Peserta individual"} ·{" "}
                      <span className="font-mono">{participant.participantCode}</span>
                    </p>
                  </div>
                  <p className="text-sm font-bold text-slate-700">
                    {participant.totalUnitsAttended ?? participant.totalSessionsAttended}/{participant.requiredUnits ?? "—"} unit
                  </p>
                  <StatusBadge
                    label={participant.statusCategory.replaceAll("_", " ")}
                    variant={participant.statusCategory === "HADIR_PENUH" ? "success" : participant.statusCategory === "TIDAK_HADIR" ? "danger" : participant.statusCategory === "BELUM_DIMULAI" ? "neutral" : "warning"}
                  />
                  <Link to={`/committee/attendance/${eventId}/${participant.participantId}/report`} className="inline-flex min-h-[40px] items-center justify-center whitespace-nowrap rounded-lg border border-teal-300 bg-teal-50 px-3 text-xs font-black text-teal-900 hover:bg-teal-100">Rapor</Link>
                </article>
              ))}
              {!filteredParticipants.length && (
                <div className="p-10 text-center text-sm text-slate-500">
                  Tidak ada peserta yang sesuai pencarian dan filter.
                </div>
              )}
            </div>
          </section>
          {recap?.requiredUnits?.length ? (
            <section className="border border-slate-200 bg-white">
              <div className="border-b border-slate-200 p-4">
                <h2 className="text-sm font-black text-slate-950">Matriks harian dan sesi</h2>
                <p className="mt-1 text-xs text-slate-500">Mode {recap.attendanceMode?.replaceAll("_", " ")} · gunakan untuk memastikan unit mana yang belum tercatat.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-max text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500"><tr><th className="sticky left-0 z-10 min-w-56 border-r border-slate-200 bg-slate-50 px-4 py-3">Peserta</th>{recap.requiredUnits.map((unit) => <th key={unit.id} className="min-w-36 border-r border-slate-200 px-3 py-3"><span className="block text-teal-800">{unit.type === "DAY" ? "Harian" : "Sesi"} · {new Date(`${unit.date}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span><span className="mt-1 block normal-case tracking-normal text-slate-700">{unit.title}</span></th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">{filteredParticipants.map((participant) => <tr key={participant.participantId}><th className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-3"><span className="block font-black text-slate-900">{participant.ustadzName}</span><span className="mt-1 block font-mono text-[10px] text-slate-500">{participant.participantCode}</span></th>{recap.requiredUnits!.map((unit) => { const status = participant.unitStatuses?.find((item) => item.unitId === unit.id)?.status || "NOT_RECORDED"; return <td key={unit.id} className="border-r border-slate-100 px-3 py-3"><StatusBadge label={status.replaceAll("_", " ")} variant={["PRESENT", "LATE"].includes(status) ? "success" : ["EXCUSED", "PERMITTED"].includes(status) ? "warning" : status === "ABSENT" ? "danger" : "neutral"} /></td>; })}</tr>)}</tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="space-y-3">
            {composerOpen && (
              <form
                onSubmit={createAnnouncement}
                className="border-t-4 border-teal-800 bg-white p-5 shadow-sm sm:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black text-slate-950">Draf pengumuman baru</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Draf belum terlihat peserta sampai tombol terbitkan digunakan.
                    </p>
                  </div>
                  <StatusBadge label="Draf" variant="neutral" />
                </div>
                <div className="mt-5 space-y-4">
                  <div>
                    <label htmlFor="announcement-title" className="text-xs font-bold text-slate-600">
                      Judul
                    </label>
                    <input
                      id="announcement-title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Contoh: Perubahan ruang sesi"
                      className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-sm outline outline-2 outline-transparent hover:bg-slate-50 focus-visible:outline-teal-700"
                    />
                  </div>
                  <div>
                    <label htmlFor="announcement-body" className="text-xs font-bold text-slate-600">
                      Isi pengumuman
                    </label>
                    <textarea
                      id="announcement-body"
                      value={body}
                      onChange={(event) => setBody(event.target.value)}
                      rows={5}
                      placeholder="Tulis informasi, waktu berlaku, dan tindakan yang perlu dilakukan peserta."
                      className="mt-2 min-h-32 w-full resize-y rounded-lg border border-slate-300 p-3 text-sm outline outline-2 outline-transparent hover:bg-slate-50 focus-visible:outline-teal-700"
                    />
                  </div>
                  <div>
                    <label htmlFor="announcement-audience" className="text-xs font-bold text-slate-600">
                      Sasaran
                    </label>
                    <select
                      id="announcement-audience"
                      value={audienceType}
                      onChange={(event) => setAudienceType(event.target.value as AudienceType)}
                      className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold outline outline-2 outline-transparent focus-visible:outline-teal-700"
                    >
                      {audienceOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 min-h-[1lh] text-xs text-slate-500">
                      {audienceOptions.find((option) => option.value === audienceType)?.description}
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-5">
                  <button
                    type="button"
                    onClick={() => setComposerOpen(false)}
                    className="inline-flex min-h-[44px] items-center whitespace-nowrap rounded-lg px-4 text-sm font-black text-slate-700 hover:bg-slate-100"
                  >
                    Tutup
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading === "create"}
                    className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg bg-teal-800 px-5 text-sm font-black text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {actionLoading === "create" ? (
                      <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Simpan draf
                  </button>
                </div>
              </form>
            )}

            {announcements.map((announcement) => (
              <article
                key={announcement.id}
                className="border border-slate-200 bg-white p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        label={announcement.status}
                        variant={announcement.status === "PUBLISHED" ? "success" : "neutral"}
                      />
                      <StatusBadge
                        label={audienceLabel(announcement.audienceType)}
                        variant="info"
                      />
                    </div>
                    <h2 className="mt-3 text-lg font-black text-slate-950">
                      {announcement.title}
                    </h2>
                    <p className="mt-2 text-xs text-slate-500">
                      {announcement.publishedAt
                        ? `Terbit ${formatCommitteeDate(announcement.publishedAt)}`
                        : `Dibuat ${formatCommitteeDate(announcement.createdAt)}`}
                    </p>
                  </div>
                  {announcement.status !== "PUBLISHED" && canManageAnnouncements && (
                    <button
                      type="button"
                      onClick={() => void publishAnnouncement(announcement)}
                      disabled={actionLoading === announcement.id}
                      className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg bg-teal-800 px-4 text-sm font-black text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {actionLoading === announcement.id ? (
                        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Terbitkan
                    </button>
                  )}
                </div>
                <p className="mt-5 whitespace-pre-line text-sm leading-7 text-slate-700">
                  {announcement.body}
                </p>
              </article>
            ))}

            {!announcements.length && !composerOpen && (
              <div className="border border-dashed border-slate-300 bg-white p-10 text-center">
                <Bell className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-3 font-bold text-slate-700">Belum ada pengumuman untuk event ini.</p>
                <button
                  type="button"
                  onClick={() => setComposerOpen(true)}
                  className="mt-4 inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap text-sm font-black text-teal-800 underline underline-offset-4"
                >
                  <Plus className="h-4 w-4" />
                  Buat draf pertama
                </button>
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <div className="border-t-4 border-teal-800 bg-slate-950 p-5 text-white">
              <Megaphone className="h-6 w-6 text-teal-300" />
              <h2 className="mt-4 font-black">Alur publikasi</h2>
              <ol className="mt-4 space-y-4 text-sm">
                {[
                  ["1", "Tulis draf", "Judul, isi, dan sasaran peserta."],
                  ["2", "Periksa", "Pastikan waktu dan instruksi tidak ambigu."],
                  ["3", "Terbitkan", "Informasi tampil di Portal Asatidz."],
                ].map(([number, label, detail]) => (
                  <li key={number} className="flex gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal-400/15 font-mono text-xs font-black text-teal-300">
                      {number}
                    </span>
                    <span>
                      <span className="block font-black">{label}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-300">{detail}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <label className="flex cursor-pointer items-start gap-3 border border-slate-200 bg-white p-4">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(event) => setSendEmail(event.target.checked)}
                className="mt-1 h-4 w-4 accent-teal-800"
              />
              <span>
                <span className="block text-sm font-black text-slate-900">
                  Sertakan notifikasi email
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  Berlaku saat draf berikutnya diterbitkan.
                </span>
              </span>
            </label>
          </aside>
        </div>
      )}
    </CommitteeLayout>
  );
};
