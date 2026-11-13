/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V5
 * Hallmark · macrostructure: Index-First · tone: utilitarian · anchor hue: emerald
 */
import React, { useEffect, useMemo, useState } from "react";
import { useGetIdentity } from "@refinedev/core";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  PencilLine,
  ExternalLink,
  MapPin,
  Plus,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge, StatusVariant } from "@/components/common/StatusBadge";
import { EventWorkspaceNav } from "@/components/admin/events/EventWorkspaceNav";
import { eventApi } from "@/lib/eventApi";
import { COMMITTEE_ROLES, roleLabel } from "@/lib/committeeApi";
import { DEFAULT_EVENT_POSTER, posterObjectPosition } from "@/lib/eventPoster";
import { eventTimezoneLabel, formatEventDate, formatEventDateTime, formatEventTime, fromEventIso, toEventIso } from "@/lib/eventDateTime";
import type { AuthIdentity } from "@/lib/refine/authProvider";

type EventDay = {
  id: string;
  dayNumber: number;
  date: string;
  title: string | null;
  checkinOpenAt: string | null;
  checkinCloseAt: string | null;
};

type EventSession = {
  id: string;
  eventDayId: string;
  title: string;
  sessionType: string;
  moderatorName: string | null;
  startAt: string;
  endAt: string;
  room: string | null;
  attendanceRequired: boolean;
  checkinRequired: boolean;
  checkinOpenAt: string | null;
  checkinCloseAt: string | null;
};

type CommitteeMember = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  committeeRole: string;
  userStatus?: string;
  startsAt?: string | null;
  endsAt?: string | null;
};

type CommitteeCandidate = { id: string; name: string | null; email: string };

type EventDetail = {
  id: string;
  code: string;
  slug: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  posterUrl: string | null;
  posterAlt: string | null;
  posterFocalPoint: string | null;
  timezone: string;
  startDate: string;
  endDate: string;
  venueName: string | null;
  venueAddress: string | null;
  mapsUrl: string | null;
  status: string;
  audienceMode: string;
  attendanceMode: string;
  capacity: number | null;
  regularQuota: number | null;
  invitationQuota: number | null;
  defaultInstitutionQuota: number | null;
  invitationResponseDeadline: string | null;
  attendanceConfirmationDeadline: string | null;
  attendanceConfirmationRequired: boolean;
  lateConfirmationPolicy: string;
  attendanceSetup?: { hasAttendanceRecords: boolean; scheduleClosed: boolean; readyToStart: boolean; openOrFutureUnitCount: number; qrUnitCount: number; manualUnitCount: number };
  days: EventDay[];
  sessions: EventSession[];
  committee: CommitteeMember[];
};

const previewEvent: EventDetail = {
  id: "event-preview-1",
  code: "CONTOH-DAURAH",
  slug: "contoh-daurah-asatidz",
  name: "Contoh Daurah Asatidz",
  subtitle: "Pratinjau ruang kerja event",
  description: "Data ini hanya ditampilkan saat API lokal belum berjalan.",
  posterUrl: DEFAULT_EVENT_POSTER,
  posterAlt: "Interior perpustakaan sebagai poster event contoh",
  posterFocalPoint: "CENTER",
  timezone: "Asia/Jakarta",
  startDate: "2026-08-15",
  endDate: "2026-08-16",
  venueName: "Lokasi contoh",
  venueAddress: "Alamat mengikuti data event.",
  mapsUrl: null,
  status: "DRAFT",
  audienceMode: "INSTITUTION_INVITATION",
  attendanceMode: "DAILY_AND_SESSION",
  capacity: null,
  regularQuota: null,
  invitationQuota: null,
  defaultInstitutionQuota: 2,
  invitationResponseDeadline: "2026-08-05T10:00:00Z",
  attendanceConfirmationDeadline: "2026-08-10T10:00:00Z",
  attendanceConfirmationRequired: true,
  lateConfirmationPolicy: "REVIEW",
  days: [{ id: "day-preview", dayNumber: 1, date: "2026-08-15", title: "Hari pertama", checkinOpenAt: null, checkinCloseAt: null }],
  sessions: [{
    id: "session-preview",
    eventDayId: "day-preview",
    title: "Contoh sesi pembukaan",
    sessionType: "OPENING",
    moderatorName: null,
    startAt: "2026-08-15T08:00:00+07:00",
    endAt: "2026-08-15T09:30:00+07:00",
    room: "Ruang utama",
    attendanceRequired: true,
    checkinRequired: true,
    checkinOpenAt: null,
    checkinCloseAt: null,
  }],
  committee: [],
};

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const statusVariant = (status: string): StatusVariant => {
  if (status === "ONGOING" || status === "COMPLETED") return "success";
  if (status === "PUBLISHED" || status === "REGISTRATION_OPEN") return "info";
  if (status === "REGISTRATION_CLOSED") return "warning";
  if (status === "CANCELLED") return "danger";
  return "neutral";
};
const eventStatusLabel: Record<string, string> = {
  DRAFT: "Draft", PUBLISHED: "Terbit", REGISTRATION_OPEN: "Pendaftaran dibuka",
  REGISTRATION_CLOSED: "Pendaftaran ditutup", ONGOING: "Berlangsung",
  COMPLETED: "Selesai", CANCELLED: "Dibatalkan", ARCHIVED: "Arsip",
};
const audienceLabel: Record<string, string> = { INSTITUTION_INVITATION: "Undangan lembaga", INDIVIDUAL_INVITATION: "Undangan individu", PUBLIC_OPEN: "Pendaftaran reguler", MIXED: "Reguler & undangan" };
const attendanceModeLabel: Record<string, string> = { DAILY_ONLY: "Harian", SESSION_ONLY: "Per sesi", DAILY_AND_SESSION: "Harian & sesi" };

const transitionOptions: Record<string, Array<{ action: string; label: string; danger?: boolean }>> = {
  DRAFT: [{ action: "PUBLISH", label: "Publikasikan" }, { action: "CANCEL", label: "Batalkan", danger: true }],
  PUBLISHED: [{ action: "OPEN_REGISTRATION", label: "Buka pendaftaran" }, { action: "START_EVENT", label: "Mulai event" }, { action: "CANCEL", label: "Batalkan", danger: true }],
  REGISTRATION_OPEN: [{ action: "CLOSE_REGISTRATION", label: "Tutup pendaftaran" }, { action: "CANCEL", label: "Batalkan", danger: true }],
   REGISTRATION_CLOSED: [{ action: "OPEN_REGISTRATION", label: "Buka kembali pendaftaran" }, { action: "START_EVENT", label: "Mulai event" }, { action: "CANCEL", label: "Batalkan", danger: true }],
  ONGOING: [{ action: "COMPLETE_EVENT", label: "Selesaikan event" }],
  COMPLETED: [{ action: "ARCHIVE", label: "Arsipkan" }],
  CANCELLED: [{ action: "ARCHIVE", label: "Arsipkan" }],
};

const formatDate = formatEventDate;

export const EventShowPage: React.FC = () => {
  const { id = "" } = useParams<{ id: string }>();
  const location = useLocation();
  const section = location.pathname.endsWith("/schedule") ? "schedule" : location.pathname.endsWith("/team") ? "team" : "overview";
  const [data, setData] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [showDayForm, setShowDayForm] = useState(false);
  const [editingDay, setEditingDay] = useState<EventDay | null>(null);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [editingSession, setEditingSession] = useState<EventSession | null>(null);
  const [sessionPresence, setSessionPresence] = useState("QR");
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [committeeDirectory, setCommitteeDirectory] = useState<CommitteeCandidate[]>([]);
  const { data: identity } = useGetIdentity<AuthIdentity>();
  const now = Date.now();
  const canCreateCommitteeAccount = identity?.assignments.some((assignment) =>
    ["SUPER_ADMIN", "SYSTEM_ADMIN"].includes(assignment.roleCode)
    && (!assignment.startsAt || new Date(assignment.startsAt).getTime() <= now)
    && (!assignment.endsAt || new Date(assignment.endsAt).getTime() > now)) ?? false;

  const loadEvent = async () => {
    setLoading(true);
    setError("");
    if (import.meta.env.DEV && !isUuid(id)) {
      setData(previewEvent);
      setPreviewMode(true);
      setLoading(false);
      return;
    }
    try {
      setData(await eventApi<EventDetail>(`/events/${id}?view=attendance-setup`));
      setPreviewMode(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Data event gagal dimuat.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setNotice("");
    void loadEvent();
  }, [id]);

  useEffect(() => {
    if (section !== "team" || previewMode) return;
    void eventApi<CommitteeCandidate[]>(`/events/${id}/committee-candidates`)
      .then(setCommitteeDirectory)
      .catch(() => setCommitteeDirectory([]));
  }, [section, previewMode, id]);

  const daysWithSessions = useMemo(
    () => (data?.days || []).map((day) => ({ ...day, sessions: (data?.sessions || []).filter((session) => session.eventDayId === day.id) })),
    [data]
  );

  const runTransition = async (action: string) => {
    if (previewMode) {
      setNotice("Transisi status dinonaktifkan pada data pratinjau.");
      return;
    }
    setBusy(action);
    setError("");
    try {
      const updated = await eventApi<EventDetail>(`/events/${id}/transition`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      setData((current) => current ? { ...current, status: updated.status } : current);
      await loadEvent();
      setNotice("Status event berhasil diperbarui.");
    } catch (transitionError) {
      setError(transitionError instanceof Error ? transitionError.message : "Status event gagal diperbarui.");
    } finally {
      setBusy("");
    }
  };

  const submitDay = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const dayIsRunning = Boolean(editingDay && (data?.status === "ONGOING" || data?.attendanceSetup?.hasAttendanceRecords));
    const dayHasSessions = Boolean(editingDay && data?.sessions.some((session) => session.eventDayId === editingDay.id));
    setBusy("day");
    try {
      await eventApi(`/events/${id}/days${editingDay ? `/${editingDay.id}` : ""}`, {
        method: editingDay ? "PATCH" : "POST",
        body: JSON.stringify({
          ...(!dayIsRunning && { dayNumber: Number(form.get("dayNumber")) }),
          ...(!dayIsRunning && !dayHasSessions && { date: form.get("date") }),
          title: form.get("title") || null,
          ...(form.has("checkinOpenAt") && { checkinOpenAt: toEventIso(String(form.get("checkinOpenAt") || ""), data?.timezone || "Asia/Jakarta") }),
          ...(form.has("checkinCloseAt") && { checkinCloseAt: toEventIso(String(form.get("checkinCloseAt") || ""), data?.timezone || "Asia/Jakarta") }),
        }),
      });
      setShowDayForm(false);
      setNotice(editingDay ? "Hari kegiatan berhasil diperbarui." : "Hari kegiatan berhasil ditambahkan.");
      setEditingDay(null);
      await loadEvent();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Hari gagal ditambahkan.");
    } finally {
      setBusy("");
    }
  };

  const submitSession = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy("session");
    try {
      await eventApi(`/events/${id}/sessions${editingSession ? `/${editingSession.id}` : ""}`, {
        method: editingSession ? "PATCH" : "POST",
        body: JSON.stringify({
          ...(!editingSession && { eventDayId: form.get("eventDayId") }),
          title: form.get("title"),
          sessionType: form.get("sessionType"),
          ...(form.has("startAt") && { startAt: toEventIso(String(form.get("startAt") || ""), data?.timezone || "Asia/Jakarta") }),
          ...(form.has("endAt") && { endAt: toEventIso(String(form.get("endAt") || ""), data?.timezone || "Asia/Jakarta") }),
          room: form.get("room") || null,
          ...((!editingSession || form.has("sessionPresence")) && { attendanceRequired: sessionPresence !== "OPTIONAL", checkinRequired: sessionPresence === "QR" }),
          checkinOpenAt: toEventIso(String(form.get("checkinOpenAt") || ""), data?.timezone || "Asia/Jakarta"),
          checkinCloseAt: toEventIso(String(form.get("checkinCloseAt") || ""), data?.timezone || "Asia/Jakarta"),
        }),
      });
      setShowSessionForm(false);
      setEditingSession(null);
      await loadEvent();
      setNotice(editingSession ? "Sesi berhasil diperbarui." : "Sesi berhasil ditambahkan.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Sesi gagal ditambahkan.");
    } finally {
      setBusy("");
    }
  };
  const toLocalInput = (value?: string | null) => fromEventIso(value, data?.timezone || "Asia/Jakarta");

  const submitTeam = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy("team");
    try {
      await eventApi(`/events/${id}/committee`, {
        method: "POST",
        body: JSON.stringify({
          userId: form.get("userId"),
          committeeRole: form.get("committeeRole"),
          startsAt: toEventIso(String(form.get("startsAt") || ""), data?.timezone || "Asia/Jakarta"),
          endsAt: toEventIso(String(form.get("endsAt") || ""), data?.timezone || "Asia/Jakarta"),
        }),
      });
      setShowTeamForm(false);
      setNotice("Panitia berhasil ditugaskan.");
      await loadEvent();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Panitia gagal ditugaskan.");
    } finally {
      setBusy("");
    }
  };

  const endTeamAssignment = async (assignmentId: string) => {
    if (!window.confirm("Akhiri masa tugas dan akses event panitia ini?")) return;
    setBusy(assignmentId);
    try {
      await eventApi(`/events/${id}/committee/${assignmentId}`, { method: "DELETE" });
      setNotice("Masa tugas dan akses event berhasil diakhiri.");
      await loadEvent();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Penugasan gagal diakhiri.");
    } finally {
      setBusy("");
    }
  };

  if (loading) {
    return <AdminLayout><div className="h-96 animate-pulse bg-slate-100" aria-label="Memuat ruang kerja event" /></AdminLayout>;
  }

  if (!data) {
    return (
      <AdminLayout>
        <div className="flex min-h-96 flex-col items-center justify-center bg-white p-8 text-center">
          <XCircle className="h-9 w-9 text-rose-500" />
          <h1 className="mt-3 text-lg font-black text-slate-900">Event tidak dapat dimuat</h1>
          <p className="mt-2 max-w-md text-xs leading-5 text-slate-500">{error}</p>
          <button type="button" onClick={() => void loadEvent()} className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white">
            <RefreshCw className="h-4 w-4" /> Coba lagi
          </button>
        </div>
      </AdminLayout>
    );
  }
  const scheduleClosed = previewMode || Boolean(data.attendanceSetup?.scheduleClosed) || ["COMPLETED", "CANCELLED", "ARCHIVED"].includes(data.status);
  const hasAttendance = Boolean(data.attendanceSetup?.hasAttendanceRecords);
  const dayIdentityLocked = Boolean(editingDay && (data.status === "ONGOING" || hasAttendance));
  const sessionLocked = Boolean(hasAttendance && editingSession?.attendanceRequired && data.attendanceMode !== "DAILY_ONLY");
  const dayWindowLocked = Boolean(hasAttendance && editingDay && data.attendanceMode !== "SESSION_ONLY" &&
    Date.parse(editingDay.checkinCloseAt || toEventIso(`${editingDay.date}T23:59:59`, data.timezone)!) < Date.now());
  const sessionWindowLocked = Boolean(sessionLocked && editingSession &&
    (editingSession.checkinCloseAt ? Date.parse(editingSession.checkinCloseAt) : Date.parse(editingSession.endAt) + 3_600_000) < Date.now());
  const readyToStart = data.attendanceSetup?.readyToStart ?? (data.days.length > 0 &&
    (data.attendanceMode === "DAILY_ONLY" || data.sessions.some((session) => session.attendanceRequired)));
  const readyToComplete = (data.attendanceSetup?.openOrFutureUnitCount ?? 0) === 0;

  return (
    <AdminLayout>
      <PageHeader
        title={data.name}
        description={`${data.code} · ${formatDate(data.startDate)}–${formatDate(data.endDate)} · ${eventTimezoneLabel(data.timezone)}`}
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Event", href: "/admin/events" }, { label: data.code }]}
        actions={<div className="flex flex-wrap gap-2">
          <Link to={`/admin/events/${id}/kiosk`} className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg bg-emerald-800 px-4 text-xs font-bold text-white hover:bg-emerald-900"><ScanLine className="h-4 w-4" /> Kiosk QR</Link>
          <Link to={`/events/${data.slug}`} target="_blank" className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50">
            Halaman publik <ExternalLink className="h-3.5 w-3.5" />
          </Link></div>}
      />

      <EventWorkspaceNav eventId={id} />

      {(previewMode || error || notice) && (
        <div className={`mb-5 border-t-2 p-3 text-xs ${error ? "border-rose-500 bg-rose-50 text-rose-900" : previewMode ? "border-amber-500 bg-amber-50 text-amber-950" : "border-emerald-600 bg-emerald-50 text-emerald-950"}`}>
          {error || notice || "Mode pratinjau aktif. Perubahan data dinonaktifkan."}
        </div>
      )}

      {section === "overview" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="border border-slate-200 bg-white">
            <figure className="event-workspace-poster">
              <img
                src={data.posterUrl || DEFAULT_EVENT_POSTER}
                alt={data.posterAlt || `Poster ${data.name}`}
                style={{ objectPosition: posterObjectPosition(data.posterFocalPoint) }}
              />
              <figcaption>Poster yang tampil pada halaman publik dan undangan</figcaption>
            </figure>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 p-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={eventStatusLabel[data.status] || data.status} variant={statusVariant(data.status)} />
                  <span className="font-mono text-[10px] font-bold text-slate-500">{data.code}</span>
                </div>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{data.description || "Deskripsi event belum diisi."}</p>
              </div>
            </div>
            <dl className="grid sm:grid-cols-2">
              {[
                { label: "Tanggal", value: `${formatDate(data.startDate)}–${formatDate(data.endDate)}`, icon: CalendarDays },
                { label: "Lokasi", value: data.venueName || "Belum ditentukan", icon: MapPin },
                { label: "Jalur peserta", value: audienceLabel[data.audienceMode] || data.audienceMode, icon: Users },
                { label: "Kapasitas total", value: data.capacity == null ? "Tidak dibatasi" : `${data.capacity} peserta`, icon: Users },
                { label: "Kuota reguler", value: data.regularQuota == null ? "Mengikuti kapasitas total" : `${data.regularQuota} peserta`, icon: Users },
                { label: "Kuota undangan", value: data.invitationQuota == null ? "Mengikuti kapasitas total" : `${data.invitationQuota} peserta`, icon: Users },
                { label: "Mode presensi", value: attendanceModeLabel[data.attendanceMode] || data.attendanceMode, icon: ShieldCheck },
                { label: "Batas respons undangan", value: data.invitationResponseDeadline ? `${formatEventDateTime(data.invitationResponseDeadline, data.timezone)} ${eventTimezoneLabel(data.timezone)}` : "Tidak dibatasi", icon: Clock3 },
                { label: "Batas konfirmasi hadir", value: data.attendanceConfirmationDeadline ? `${formatEventDateTime(data.attendanceConfirmationDeadline, data.timezone)} ${eventTimezoneLabel(data.timezone)}` : "Tidak dibatasi", icon: CheckCircle2 },
              ].map((item) => (
                <div key={item.label} className="flex gap-3 border-b border-r border-slate-100 p-5">
                  <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                  <div><dt className="text-xs font-bold text-slate-500">{item.label}</dt><dd className="mt-1 text-sm font-bold text-slate-800">{item.value}</dd></div>
                </div>
              ))}
            </dl>
          </section>
          <aside className="space-y-4">
            <section className="border border-slate-200 bg-white p-4">
              <h2 className="text-base font-black text-slate-900">Alur kerja event</h2>
              <nav aria-label="Langkah pengelolaan event" className="mt-3 divide-y divide-slate-100">
                {[
                  { label: "Rincian & poster", href: `/admin/events/${id}/edit`, ready: Boolean(data.name && data.venueName && data.posterUrl) },
                  { label: "Jadwal & sesi", href: `/admin/events/${id}/schedule`, ready: readyToStart },
                  { label: "Panitia", href: `/admin/events/${id}/team`, ready: data.committee.length > 0 },
                  ...(["INSTITUTION_INVITATION", "INDIVIDUAL_INVITATION", "MIXED"].includes(data.audienceMode) ? [{ label: "Undangan", href: `/admin/events/${id}/registrations?view=invitations` }] : []),
                  { label: "Peserta", href: `/admin/events/${id}/registrations?view=participants` },
                  { label: "Kehadiran & rapor", href: `/admin/events/${id}/attendance` },
                ].map((item) => <Link key={item.label} to={item.href} className="flex min-h-12 items-center gap-2 py-2 text-sm font-bold text-slate-800 hover:text-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">
                  <span className="min-w-0 flex-1">{item.label}</span>
                  {item.ready && <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-label="Siap" />}
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                </Link>)}
              </nav>
            </section>
            <section className="border-t-2 border-emerald-700 bg-emerald-50 p-4">
               <h2 className="text-sm font-black text-emerald-950">Publikasi & pendaftaran event</h2>
               <p className="mt-2 text-sm leading-6 text-emerald-900">Terbitkan event, lalu buka pendaftaran sesuai jalur peserta.</p>
              <div className="mt-3 space-y-2">
                {(transitionOptions[data.status] || []).map((option) => (
                  <button
                    key={option.action}
                    type="button"
                    onClick={() => void runTransition(option.action)}
                    disabled={Boolean(busy) || previewMode || option.action === "START_EVENT" && !readyToStart || option.action === "COMPLETE_EVENT" && !readyToComplete}
                    className={`inline-flex min-h-[44px] w-full items-center justify-between rounded-lg px-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 ${option.danger ? "bg-rose-100 text-rose-900 hover:bg-rose-200" : "bg-emerald-800 text-white hover:bg-emerald-900"}`}
                  >
                    {option.label}
                    {busy === option.action ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
              {!readyToStart && (transitionOptions[data.status] || []).some((item) => item.action === "START_EVENT") &&
                <Link to={`/admin/events/${id}/schedule`} className="mt-2 inline-flex min-h-11 items-center text-sm font-bold underline">Lengkapi jadwal presensi</Link>}
              {!readyToComplete && data.status === "ONGOING" && <p className="mt-2 text-sm text-slate-600">Masih ada unit presensi yang belum ditutup. Segarkan setelah jadwal berakhir.</p>}
            </section>
          </aside>
        </div>
      )}

      {section === "schedule" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-base font-black text-slate-900">Jadwal dan sesi</h2><p className="mt-1 text-xs text-slate-500">Susun hari, waktu sesi, ruangan, dan kebutuhan check-in.</p></div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { setEditingDay(null); setShowDayForm((value) => !value); }} disabled={scheduleClosed || hasAttendance} className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold disabled:opacity-50"><Plus className="h-4 w-4" /> Tambah hari</button>
              <button type="button" onClick={() => { setEditingSession(null); setSessionPresence(hasAttendance || data.attendanceMode === "DAILY_ONLY" ? "OPTIONAL" : "QR"); setShowSessionForm(true); }} disabled={scheduleClosed || data.days.length === 0} className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Tambah sesi</button>
            </div>
          </div>
          <p className="text-sm text-slate-600">{scheduleClosed && !previewMode ? "Jadwal terkunci. Perbaiki catatan kehadiran melalui rapor sesuai izin." : hasAttendance
            ? "Presensi sudah tercatat. Struktur hari dan sesi wajib dikunci; sesi baru hanya dapat ditambahkan sebagai opsional untuk mode per sesi."
            : "Atur hari yang benar-benar berlangsung. Sesi wajib dapat menerima QR atau dicatat manual melalui rapor."}</p>

          {showDayForm && !scheduleClosed && (
            <form id="event-day-form" key={editingDay?.id || "new-day"} onSubmit={submitDay} className="grid gap-3 border-t-2 border-emerald-700 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
              <h3 className="text-base font-black text-slate-900 sm:col-span-2 lg:col-span-3">{editingDay ? "Ubah hari kegiatan" : "Tambah hari kegiatan"} · {eventTimezoneLabel(data.timezone)}</h3>
              <label className="text-sm font-bold text-slate-700">Nomor hari<input name="dayNumber" type="number" min="1" defaultValue={editingDay?.dayNumber} disabled={dayIdentityLocked} required className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100" /></label>
              <label className="text-sm font-bold text-slate-700">Tanggal kegiatan<input name="date" type="date" min={data.startDate} max={data.endDate} defaultValue={editingDay?.date} disabled={dayIdentityLocked || Boolean(editingDay && data.sessions.some((session) => session.eventDayId === editingDay.id))} required className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100" /></label>
              <label className="text-sm font-bold text-slate-700">Judul hari<input name="title" defaultValue={editingDay?.title || ""} placeholder="Contoh: Hari pembukaan" className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-sm" /></label>
              {data.attendanceMode !== "SESSION_ONLY" && <>
                <label className="text-sm font-bold text-slate-700">Check-in harian dibuka<input name="checkinOpenAt" type="datetime-local" defaultValue={toLocalInput(editingDay?.checkinOpenAt)} disabled={dayWindowLocked} className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100" /></label>
                <label className="text-sm font-bold text-slate-700">Check-in harian ditutup<input name="checkinCloseAt" type="datetime-local" defaultValue={toLocalInput(editingDay?.checkinCloseAt)} disabled={dayWindowLocked} className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100" /></label>
                <p className="self-center text-sm text-slate-600">{dayWindowLocked ? "Jendela check-in yang sudah ditutup terkunci." : "Kosongkan jam check-in untuk memakai satu hari penuh."}</p>
              </>}
              <div className="flex gap-2 lg:col-start-3"><button disabled={busy === "day"} className="min-h-[44px] flex-1 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50">{busy === "day" ? "Menyimpan…" : "Simpan hari"}</button><button type="button" onClick={() => { setEditingDay(null); setShowDayForm(false); }} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-bold">Batal</button></div>
            </form>
          )}

          {showSessionForm && !scheduleClosed && (
             <form id="event-session-form" key={editingSession?.id || "new-session"} onSubmit={submitSession} className="grid gap-3 border-t-2 border-emerald-700 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
               <h3 className="text-base font-black text-slate-900 sm:col-span-2 lg:col-span-3">{editingSession ? `Ubah sesi: ${editingSession.title}` : "Tambah sesi"} · {eventTimezoneLabel(data.timezone)}</h3>
               <label className="text-sm font-bold text-slate-700">Hari kegiatan<select name="eventDayId" defaultValue={editingSession?.eventDayId} disabled={Boolean(editingSession)} required className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100">{data.days.map((day) => <option key={day.id} value={day.id}>Hari {day.dayNumber} · {day.title || day.date}</option>)}</select></label>
               <label className="text-sm font-bold text-slate-700">Judul sesi<input name="title" defaultValue={editingSession?.title} required placeholder="Contoh: Pembukaan" className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-sm" /></label>
               <label className="text-sm font-bold text-slate-700">Jenis sesi<select name="sessionType" defaultValue={editingSession?.sessionType} className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-sm"><option value="MATERIAL">Materi</option><option value="BREAK">Istirahat</option><option value="OPENING">Pembukaan</option><option value="CLOSING">Penutupan</option></select></label>
               <label className="text-sm font-bold text-slate-700">Mulai<input name="startAt" type="datetime-local" defaultValue={toLocalInput(editingSession?.startAt)} disabled={sessionLocked} required className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100" /></label>
               <label className="text-sm font-bold text-slate-700">Selesai<input name="endAt" type="datetime-local" defaultValue={toLocalInput(editingSession?.endAt)} disabled={sessionLocked} required className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100" /></label>
               <label className="text-sm font-bold text-slate-700">Ruang<input name="room" defaultValue={editingSession?.room || ""} placeholder="Ruang utama" className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-sm" /></label>
               {data.attendanceMode !== "DAILY_ONLY" ? <>
                 <label className="text-sm font-bold text-slate-700">Presensi sesi
                   <select name="sessionPresence" value={sessionPresence} onChange={(event) => setSessionPresence(event.target.value)} disabled={sessionLocked || hasAttendance} className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100">
                     <option value="QR">Wajib · scan QR</option><option value="MANUAL">Wajib · catat manual</option><option value="OPTIONAL">Opsional · tanpa presensi</option>
                   </select>
                 </label>
                 {sessionPresence !== "OPTIONAL" && <>
                   <label className="text-sm font-bold text-slate-700">Presensi dibuka<input name="checkinOpenAt" type="datetime-local" defaultValue={toLocalInput(editingSession?.checkinOpenAt)} disabled={sessionWindowLocked} className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100" /></label>
                   <label className="text-sm font-bold text-slate-700">Presensi ditutup<input name="checkinCloseAt" type="datetime-local" defaultValue={toLocalInput(editingSession?.checkinCloseAt)} disabled={sessionWindowLocked} className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100" /></label>
                   <p className="text-sm text-slate-600 sm:col-span-2">{sessionWindowLocked ? "Jendela presensi yang sudah ditutup terkunci." : sessionPresence === "MANUAL" ? "Catat peserta melalui Rapor Kehadiran. Sesi ini tidak muncul di pemindai." : "Jika jam dikosongkan, presensi dibuka 1 jam sebelum dan ditutup 1 jam setelah sesi."}</p>
                 </>}
               </> : <p className="self-center text-sm text-slate-600">Mode harian: sesi ini hanya tampil di jadwal.</p>}
               <div className="flex gap-2 lg:col-start-3"><button disabled={busy === "session"} className="min-h-[44px] flex-1 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50">{busy === "session" ? "Menyimpan…" : editingSession ? "Simpan perubahan" : "Simpan sesi"}</button><button type="button" onClick={() => { setEditingSession(null); setShowSessionForm(false); }} className="min-h-[44px] rounded-lg border border-slate-300 px-3 text-sm font-bold">Batal</button></div>
            </form>
          )}

          {daysWithSessions.length === 0 ? (
            <div className="border border-dashed border-slate-300 bg-white p-10 text-center text-xs text-slate-500">Belum ada hari kegiatan.</div>
          ) : daysWithSessions.map((day) => (
            <article key={day.id} className="border border-slate-200 bg-white">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
                <div><p className="text-xs font-bold text-emerald-700">Hari {day.dayNumber}</p><h3 className="mt-1 text-base font-black text-slate-900">{day.title || formatDate(day.date)}</h3></div>
                <time className="text-xs font-bold text-slate-500">{formatDate(day.date)}</time>
                <button type="button" disabled={scheduleClosed} onClick={() => { setEditingDay(day); setShowDayForm(true); window.requestAnimationFrame(() => document.getElementById("event-day-form")?.scrollIntoView({ block: "center" })); }} className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"><PencilLine className="h-4 w-4" /> Edit hari</button>
              </header>
              {day.sessions.length === 0 ? <p className="p-5 text-xs text-slate-500">Belum ada sesi.</p> : (
                <ol className="divide-y divide-slate-100">
                  {day.sessions.map((session) => (
                     <li key={session.id} className="grid gap-2 p-4 sm:grid-cols-[8rem_minmax(0,1fr)_10rem_auto] sm:items-center">
                      <span className="font-mono text-xs font-black text-emerald-800"><Clock3 className="mr-1 inline h-3.5 w-3.5" />{formatEventTime(session.startAt, data.timezone)}–{formatEventTime(session.endAt, data.timezone)} {eventTimezoneLabel(data.timezone)}</span>
                      <div><h4 className="text-sm font-black text-slate-900">{session.title}</h4><p className="mt-1 text-sm text-slate-600">{session.sessionType === "MATERIAL" ? "Materi" : session.sessionType === "BREAK" ? "Istirahat" : session.sessionType === "OPENING" ? "Pembukaan" : "Penutupan"} · {data.attendanceMode === "DAILY_ONLY" ? "jadwal saja" : session.attendanceRequired ? session.checkinRequired ? "wajib · QR" : "wajib · manual" : "opsional"}</p></div>
                      <span className="text-sm font-bold text-slate-600">{session.room || "Ruang belum diisi"}</span>
                      <button type="button" disabled={scheduleClosed} onClick={() => { setEditingSession(session); setSessionPresence(session.attendanceRequired ? session.checkinRequired ? "QR" : "MANUAL" : "OPTIONAL"); setShowSessionForm(true); window.requestAnimationFrame(() => document.getElementById("event-session-form")?.scrollIntoView({ block: "center" })); }} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-300 px-3 text-sm font-bold disabled:opacity-50"><PencilLine className="h-4 w-4" /> Edit</button>
                    </li>
                  ))}
                </ol>
              )}
            </article>
          ))}
        </div>
      )}

      {section === "team" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-base font-black text-slate-900">Panitia event</h2><p className="mt-1 text-sm text-slate-600">Petugas biasa dibatasi event ini. Admin Panitia Semua Event dapat mengelola seluruh event tanpa penugasan di tabel ini.</p></div>
            <div className="flex flex-wrap gap-2">{!previewMode && canCreateCommitteeAccount && <Link to="/admin/committee/create?role=COMMITTEE_ORGANIZER" className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-emerald-700 bg-white px-4 text-sm font-bold text-emerald-800"><Plus className="h-4 w-4" /> Buat admin semua event</Link>}<button type="button" onClick={() => setShowTeamForm((value) => !value)} disabled={previewMode} className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Tugaskan akun yang ada</button></div>
          </div>
          {showTeamForm && (
            <form onSubmit={submitTeam} className="grid gap-3 border-t-2 border-emerald-700 bg-white p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem_10rem_auto]">
              <select name="userId" required className="min-h-[44px] border border-slate-300 px-3 text-sm"><option value="">Pilih akun panitia</option>{committeeDirectory.map((member) => <option key={member.id} value={member.id}>{member.name || member.email} · {member.email}</option>)}</select>
              <select name="committeeRole" defaultValue="COMMITTEE_ADMIN" className="min-h-[44px] border border-slate-300 px-3 text-sm">
                {COMMITTEE_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
              <input name="startsAt" type="datetime-local" aria-label="Mulai tugas" className="min-h-[44px] border border-slate-300 px-2 text-xs" />
              <input name="endsAt" type="datetime-local" aria-label="Akhir tugas" className="min-h-[44px] border border-slate-300 px-2 text-xs" />
              <button disabled={busy === "team"} className="min-h-[44px] whitespace-nowrap bg-emerald-700 px-4 text-sm font-bold text-white">Simpan tugas</button>
            </form>
          )}
          {data.committee.length === 0 ? (
            <div className="border border-dashed border-slate-300 bg-white p-10 text-center text-xs text-slate-500">Belum ada panitia yang ditugaskan.</div>
          ) : (
            <div className="overflow-hidden border border-slate-200 bg-white">
              <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_12rem_7rem] bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 sm:grid"><span>Nama</span><span>Email</span><span>Peran</span><span>Aksi</span></div>
              <ul className="divide-y divide-slate-100">
                {data.committee.map((member) => (
                  <li key={member.id} className="grid gap-2 px-4 py-4 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_12rem_7rem] sm:items-center">
                    <span className="font-black text-slate-900">{member.userName || "Pengguna"}</span>
                    <span className="truncate text-slate-500">{member.userEmail}</span>
                    <div><StatusBadge label={roleLabel(member.committeeRole)} variant={member.endsAt && new Date(member.endsAt) < new Date() ? "danger" : "info"} />{member.endsAt && <p className="mt-1 text-xs text-slate-500">s.d. {new Date(member.endsAt).toLocaleDateString("id-ID")}</p>}</div>
                    <button disabled={busy === member.id} onClick={() => void endTeamAssignment(member.id)} className="min-h-[40px] border border-rose-200 px-2 text-xs font-black text-rose-700 hover:bg-rose-50">Akhiri</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
};
