/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V5
 * Hallmark · macrostructure: Index-First · tone: utilitarian · anchor hue: emerald
 */
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  MapPin,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge, StatusVariant } from "@/components/common/StatusBadge";
import { EventWorkspaceNav } from "@/components/admin/events/EventWorkspaceNav";
import { eventApi } from "@/lib/eventApi";
import { CommitteeMember as DirectoryMember, COMMITTEE_ROLES, roleLabel } from "@/lib/committeeApi";
import { DEFAULT_EVENT_POSTER, posterObjectPosition } from "@/lib/eventPoster";

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
  defaultInstitutionQuota: number | null;
  invitationResponseDeadline: string | null;
  attendanceConfirmationDeadline: string | null;
  attendanceConfirmationRequired: boolean;
  lateConfirmationPolicy: string;
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

const transitionOptions: Record<string, Array<{ action: string; label: string; danger?: boolean }>> = {
  DRAFT: [{ action: "PUBLISH", label: "Publikasikan" }, { action: "CANCEL", label: "Batalkan", danger: true }],
  PUBLISHED: [{ action: "OPEN_REGISTRATION", label: "Buka pendaftaran" }, { action: "START_EVENT", label: "Mulai event" }, { action: "CANCEL", label: "Batalkan", danger: true }],
  REGISTRATION_OPEN: [{ action: "CLOSE_REGISTRATION", label: "Tutup pendaftaran" }, { action: "CANCEL", label: "Batalkan", danger: true }],
  REGISTRATION_CLOSED: [{ action: "START_EVENT", label: "Mulai event" }, { action: "CANCEL", label: "Batalkan", danger: true }],
  ONGOING: [{ action: "COMPLETE_EVENT", label: "Selesaikan event" }],
  COMPLETED: [{ action: "ARCHIVE", label: "Arsipkan" }],
  CANCELLED: [{ action: "ARCHIVE", label: "Arsipkan" }],
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(value));

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
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [committeeDirectory, setCommitteeDirectory] = useState<DirectoryMember[]>([]);

  const loadEvent = async () => {
    setLoading(true);
    setError("");
    setNotice("");
    if (!isUuid(id)) {
      setData(previewEvent);
      setPreviewMode(true);
      setLoading(false);
      return;
    }
    try {
      setData(await eventApi<EventDetail>(`/events/${id}`));
      setPreviewMode(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Data event gagal dimuat.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvent();
  }, [id]);

  useEffect(() => {
    if (section !== "team" || previewMode) return;
    void eventApi<{ items: DirectoryMember[] }>("/committee-members")
      .then((result) => setCommitteeDirectory(result.items))
      .catch(() => setCommitteeDirectory([]));
  }, [section, previewMode]);

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
    setBusy("day");
    try {
      await eventApi(`/events/${id}/days`, {
        method: "POST",
        body: JSON.stringify({
          dayNumber: Number(form.get("dayNumber")),
          date: form.get("date"),
          title: form.get("title") || null,
        }),
      });
      setShowDayForm(false);
      setNotice("Hari kegiatan berhasil ditambahkan.");
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
      await eventApi(`/events/${id}/sessions`, {
        method: "POST",
        body: JSON.stringify({
          eventDayId: form.get("eventDayId"),
          title: form.get("title"),
          sessionType: form.get("sessionType"),
          startAt: form.get("startAt"),
          endAt: form.get("endAt"),
          room: form.get("room") || null,
          attendanceRequired: true,
          checkinRequired: true,
        }),
      });
      setShowSessionForm(false);
      setNotice("Sesi berhasil ditambahkan.");
      await loadEvent();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Sesi gagal ditambahkan.");
    } finally {
      setBusy("");
    }
  };

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
          startsAt: form.get("startsAt") || null,
          endsAt: form.get("endsAt") || null,
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

  return (
    <AdminLayout>
      <PageHeader
        title={data.name}
        description={`${data.code} · ${formatDate(data.startDate)}–${formatDate(data.endDate)}`}
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Event", href: "/admin/events" }, { label: data.code }]}
        actions={
          <Link to={`/events/${data.slug}`} target="_blank" className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50">
            Halaman publik <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        }
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
                  <StatusBadge label={data.status.replaceAll("_", " ")} variant={statusVariant(data.status)} />
                  <span className="font-mono text-[10px] font-bold text-slate-500">{data.code}</span>
                </div>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{data.description || "Deskripsi event belum diisi."}</p>
              </div>
            </div>
            <dl className="grid sm:grid-cols-2">
              {[
                { label: "Tanggal", value: `${formatDate(data.startDate)}–${formatDate(data.endDate)}`, icon: CalendarDays },
                { label: "Lokasi", value: data.venueName || "Belum ditentukan", icon: MapPin },
                { label: "Jalur peserta", value: data.audienceMode.replaceAll("_", " "), icon: Users },
                { label: "Mode presensi", value: data.attendanceMode.replaceAll("_", " "), icon: ShieldCheck },
                { label: "Batas respons undangan", value: data.invitationResponseDeadline ? new Date(data.invitationResponseDeadline).toLocaleString("id-ID") : "Tidak dibatasi", icon: Clock3 },
                { label: "Batas konfirmasi hadir", value: data.attendanceConfirmationDeadline ? new Date(data.attendanceConfirmationDeadline).toLocaleString("id-ID") : "Tidak dibatasi", icon: CheckCircle2 },
              ].map((item) => (
                <div key={item.label} className="flex gap-3 border-b border-r border-slate-100 p-5">
                  <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                  <div><dt className="text-[10px] font-black uppercase tracking-wide text-slate-400">{item.label}</dt><dd className="mt-1 text-xs font-bold text-slate-800">{item.value}</dd></div>
                </div>
              ))}
            </dl>
          </section>
          <aside className="space-y-4">
            <section className="border border-slate-200 bg-white p-4">
              <h2 className="text-xs font-black text-slate-900">Kesiapan event</h2>
              <ul className="mt-3 space-y-2 text-[11px] text-slate-600">
                {[
                  { label: "Rincian dasar", ready: Boolean(data.name && data.startDate && data.endDate) },
                  { label: "Lokasi", ready: Boolean(data.venueName) },
                  { label: "Hari kegiatan", ready: data.days.length > 0 },
                  { label: "Sesi kegiatan", ready: data.sessions.length > 0 },
                  { label: "Panitia", ready: data.committee.length > 0 },
                  { label: "Poster event", ready: Boolean(data.posterUrl) },
                ].map((item) => (
                  <li key={item.label} className="flex items-center justify-between gap-2 border-b border-slate-100 py-2">
                    <span>{item.label}</span>
                    <StatusBadge label={item.ready ? "Siap" : "Belum"} variant={item.ready ? "success" : "warning"} />
                  </li>
                ))}
              </ul>
            </section>
            <section className="border-t-2 border-emerald-700 bg-emerald-50 p-4">
              <h2 className="text-xs font-black text-emerald-950">Ubah status</h2>
              <div className="mt-3 space-y-2">
                {(transitionOptions[data.status] || []).map((option) => (
                  <button
                    key={option.action}
                    type="button"
                    onClick={() => void runTransition(option.action)}
                    disabled={Boolean(busy) || previewMode}
                    className={`inline-flex min-h-[44px] w-full items-center justify-between rounded-lg px-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 ${option.danger ? "bg-rose-100 text-rose-900 hover:bg-rose-200" : "bg-emerald-800 text-white hover:bg-emerald-900"}`}
                  >
                    {option.label}
                    {busy === option.action ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            </section>
          </aside>
        </div>
      )}

      {section === "schedule" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-base font-black text-slate-900">Jadwal dan sesi</h2><p className="mt-1 text-xs text-slate-500">Susun hari, waktu sesi, ruangan, dan kebutuhan check-in.</p></div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowDayForm((value) => !value)} disabled={previewMode} className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold disabled:opacity-50"><Plus className="h-4 w-4" /> Tambah hari</button>
              <button type="button" onClick={() => setShowSessionForm((value) => !value)} disabled={previewMode || data.days.length === 0} className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Tambah sesi</button>
            </div>
          </div>

          {showDayForm && (
            <form onSubmit={submitDay} className="grid gap-3 border-t-2 border-emerald-700 bg-white p-4 sm:grid-cols-3">
              <input name="dayNumber" type="number" min="1" required placeholder="Nomor hari" className="min-h-[44px] rounded-lg border border-slate-300 px-3 text-xs" />
              <input name="date" type="date" required className="min-h-[44px] rounded-lg border border-slate-300 px-3 text-xs" />
              <input name="title" placeholder="Judul hari" className="min-h-[44px] rounded-lg border border-slate-300 px-3 text-xs" />
              <button disabled={busy === "day"} className="min-h-[44px] rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white sm:col-start-3">Simpan hari</button>
            </form>
          )}

          {showSessionForm && (
            <form onSubmit={submitSession} className="grid gap-3 border-t-2 border-emerald-700 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
              <select name="eventDayId" required className="min-h-[44px] rounded-lg border border-slate-300 px-3 text-xs">
                {data.days.map((day) => <option key={day.id} value={day.id}>Hari {day.dayNumber} · {day.title || day.date}</option>)}
              </select>
              <input name="title" required placeholder="Judul sesi" className="min-h-[44px] rounded-lg border border-slate-300 px-3 text-xs" />
              <select name="sessionType" className="min-h-[44px] rounded-lg border border-slate-300 px-3 text-xs">
                {["MATERIAL", "BREAK", "OPENING", "CLOSING"].map((type) => <option key={type}>{type}</option>)}
              </select>
              <input name="startAt" type="datetime-local" required className="min-h-[44px] rounded-lg border border-slate-300 px-3 text-xs" />
              <input name="endAt" type="datetime-local" required className="min-h-[44px] rounded-lg border border-slate-300 px-3 text-xs" />
              <input name="room" placeholder="Ruangan" className="min-h-[44px] rounded-lg border border-slate-300 px-3 text-xs" />
              <button disabled={busy === "session"} className="min-h-[44px] rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white lg:col-start-3">Simpan sesi</button>
            </form>
          )}

          {daysWithSessions.length === 0 ? (
            <div className="border border-dashed border-slate-300 bg-white p-10 text-center text-xs text-slate-500">Belum ada hari kegiatan.</div>
          ) : daysWithSessions.map((day) => (
            <article key={day.id} className="border border-slate-200 bg-white">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
                <div><p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Hari {day.dayNumber}</p><h3 className="mt-1 text-sm font-black text-slate-900">{day.title || formatDate(day.date)}</h3></div>
                <time className="text-xs font-bold text-slate-500">{formatDate(day.date)}</time>
              </header>
              {day.sessions.length === 0 ? <p className="p-5 text-xs text-slate-500">Belum ada sesi.</p> : (
                <ol className="divide-y divide-slate-100">
                  {day.sessions.map((session) => (
                    <li key={session.id} className="grid gap-2 p-4 sm:grid-cols-[8rem_minmax(0,1fr)_10rem] sm:items-center">
                      <span className="font-mono text-xs font-black text-emerald-800"><Clock3 className="mr-1 inline h-3.5 w-3.5" />{formatTime(session.startAt)}–{formatTime(session.endAt)}</span>
                      <div><h4 className="text-xs font-black text-slate-900">{session.title}</h4><p className="mt-1 text-[10px] text-slate-500">{session.sessionType.replaceAll("_", " ")}</p></div>
                      <span className="text-[11px] font-bold text-slate-600">{session.room || "Ruang belum diisi"}</span>
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
            <div><h2 className="text-base font-black text-slate-900">Panitia event</h2><p className="mt-1 text-xs text-slate-500">Hak akses panitia mengikuti peran dan lingkup event ini.</p></div>
            <button type="button" onClick={() => setShowTeamForm((value) => !value)} disabled={previewMode} className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Tugaskan panitia</button>
          </div>
          {showTeamForm && (
            <form onSubmit={submitTeam} className="grid gap-3 border-t-2 border-emerald-700 bg-white p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem_10rem_auto]">
              <select name="userId" required className="min-h-[44px] border border-slate-300 px-3 text-sm"><option value="">Pilih akun panitia</option>{committeeDirectory.map((member) => <option key={member.id} value={member.id}>{member.name || member.email} · {member.email}</option>)}</select>
              <select name="committeeRole" className="min-h-[44px] border border-slate-300 px-3 text-sm">
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
