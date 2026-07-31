import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, KeyRound, Search, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { CommitteeWorkspaceNav } from "@/components/admin/committee/CommitteeWorkspaceNav";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { committeeApi, CommitteeMember, COMMITTEE_ROLES, formatCommitteeDate, roleLabel } from "@/lib/committeeApi";

type EventItem = {
  id: string; code: string; name: string; status: string; startDate: string; endDate: string;
  invitationResponseDeadline?: string | null; attendanceConfirmationDeadline?: string | null;
  attendanceConfirmationRequired?: boolean; lateConfirmationPolicy?: string;
};
type DirectoryData = { items: CommitteeMember[]; summary: { totalMembers: number; activeMembers: number; activeAssignments: number; endingSoon: number } };

const previewMembers: CommitteeMember[] = [
  { id: "preview-lead", name: "Ahmad Fauzan", email: "koordinator@aman-daurah.id", status: "ACTIVE", assignments: [{ id: "preview-a", eventId: "preview", eventName: "Daurah Asatidz 1448 H", eventCode: "DAURAH-1448", eventStatus: "REGISTRATION_OPEN", committeeRole: "COMMITTEE_LEAD", startsAt: "2026-07-20T01:00:00Z", endsAt: "2026-08-18T10:00:00Z" }] },
  { id: "preview-checkin", name: "Abdullah Karim", email: "checkin@aman-daurah.id", status: "ACTIVE", assignments: [{ id: "preview-b", eventId: "preview", eventName: "Daurah Asatidz 1448 H", eventCode: "DAURAH-1448", eventStatus: "REGISTRATION_OPEN", committeeRole: "CHECKIN_OFFICER" }] },
];

export const CommitteeDirectoryPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const view = params.get("view") || "overview";
  const [data, setData] = useState<DirectoryData>({ items: [], summary: { totalMembers: 0, activeMembers: 0, activeAssignments: 0, endingSoon: 0 } });
  const [events, setEvents] = useState<EventItem[]>([]);
  const [search, setSearch] = useState(params.get("search") || "");
  const [eventId, setEventId] = useState(params.get("eventId") || "");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        if (search) query.set("search", search);
        if (eventId) query.set("eventId", eventId);
        const [directory, eventRows] = await Promise.all([
          committeeApi<DirectoryData>(`/committee-members?${query}`),
          committeeApi<EventItem[]>("/events"),
        ]);
        if (active) { setData(directory); setEvents(eventRows); setNotice(""); }
      } catch (error) {
        if (active) {
          setData({ items: previewMembers, summary: { totalMembers: 2, activeMembers: 2, activeAssignments: 2, endingSoon: 0 } });
          setEvents([]);
          setNotice(error instanceof Error ? `${error.message} Menampilkan contoh terstruktur.` : "Data contoh ditampilkan.");
        }
      } finally { if (active) setLoading(false); }
    };
    const timer = window.setTimeout(() => void load(), 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search, eventId]);

  const allAssignments = useMemo(() => data.items.flatMap((member) => member.assignments.map((assignment) => ({ ...assignment, member }))), [data.items]);
  const hasExpired = (value?: string | null) => Boolean(value && new Date(value) < new Date());

  const selectView = (nextView: string) => {
    const next = new URLSearchParams(params);
    if (nextView === "overview") next.delete("view"); else next.set("view", nextView);
    setParams(next);
  };

  return (
    <AdminLayout>
      <PageHeader title="Pengelolaan Panitia" description="Kelola akun, ruang lingkup event, masa tugas, akses, serta kesiapan konfirmasi peserta." breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Panitia" }]} actions={<Link to="/admin/committee/create" className="inline-flex min-h-[44px] items-center gap-2 bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"><UserPlus className="h-4 w-4" />Tambah akun</Link>} />
      <CommitteeWorkspaceNav />
      {notice && <div role="status" className="mb-5 border-t-4 border-amber-500 bg-amber-50 p-4 text-sm text-amber-950">{notice}</div>}

      <section className="committee-triage-reveal mb-6 grid border-y border-slate-300 bg-slate-950 text-white sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Akun panitia", value: data.summary.totalMembers, note: `${data.summary.activeMembers} aktif`, icon: UsersRound },
          { label: "Tugas aktif", value: data.summary.activeAssignments, note: "terhubung ke RBAC", icon: ShieldCheck },
          { label: "Berakhir ≤7 hari", value: data.summary.endingSoon, note: data.summary.endingSoon ? "perlu ditinjau" : "aman", icon: CalendarClock },
          { label: "Event tanpa tim", value: events.filter((event) => !allAssignments.some((assignment) => assignment.eventId === event.id)).length, note: "butuh penanggung jawab", icon: AlertTriangle },
        ].map(({ label, value, note, icon: Icon }, index) => <div key={label} style={{ animationDelay: `${index * 50}ms` }} className="border-b border-white/15 p-5 last:border-b-0 sm:border-r xl:border-b-0"><div className="flex items-center justify-between"><span className="text-xs font-black uppercase tracking-[0.14em] text-emerald-200">{label}</span><Icon className="h-4 w-4 text-emerald-300" /></div><p className="mt-4 text-3xl font-black">{loading ? "—" : value}</p><p className="mt-1 text-sm text-slate-300">{note}</p></div>)}
      </section>

      <div className="mb-6 flex flex-wrap gap-2">
        {["overview", "members", "assignments", "access", "deadlines"].map((item) => <button key={item} onClick={() => selectView(item)} className={`min-h-[40px] border px-3 text-sm font-bold ${view === item ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-slate-300 bg-white text-slate-600"}`}>{({ overview: "Prioritas", members: "Akun", assignments: "Penugasan", access: "Akses", deadlines: "Tenggat" } as any)[item]}</button>)}
      </div>

      {(view === "overview" || view === "members") && <section>
        <div className="mb-4 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_18rem]">
          <label className="relative min-w-0"><span className="sr-only">Cari panitia</span><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau email panitia" className="min-h-[46px] w-full min-w-0 max-w-full border border-slate-300 pl-10 pr-3 text-sm outline-none focus:border-emerald-700" /></label>
          <select value={eventId} onChange={(event) => setEventId(event.target.value)} className="min-h-[46px] w-full min-w-0 max-w-full border border-slate-300 bg-white px-3 text-sm"><option value="">Semua event</option>{events.map((event) => <option key={event.id} value={event.id}>{event.code} · {event.name}</option>)}</select>
        </div>
        <div className="min-w-0 max-w-full overflow-x-auto border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm"><thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr><th className="px-4 py-3">Panitia</th><th className="px-4 py-3">Penugasan aktif</th><th className="px-4 py-3">Masa tugas</th><th className="px-4 py-3">Akun</th><th className="px-4 py-3"><span className="sr-only">Aksi</span></th></tr></thead><tbody className="divide-y divide-slate-100">
            {data.items.map((member) => {
              const assignment = member.assignments[0];
              return <tr key={member.id} className="committee-row-feedback hover:bg-emerald-50/40"><td className="px-4 py-4"><p className="font-black text-slate-950">{member.name || "Nama belum diisi"}</p><p className="mt-1 text-sm text-slate-500">{member.email}</p></td><td className="px-4 py-4">{assignment ? <><p className="font-bold text-slate-800">{roleLabel(assignment.committeeRole)}</p><p className="mt-1 text-xs text-slate-500">{assignment.eventCode} · {assignment.eventName}</p>{member.assignments.length > 1 && <span className="mt-1 inline-block text-xs font-bold text-emerald-700">+{member.assignments.length - 1} tugas lain</span>}</> : <StatusBadge label="Belum ditugaskan" variant="warning" />}</td><td className="px-4 py-4 text-xs text-slate-600">{assignment ? <>{formatCommitteeDate(assignment.startsAt)}<br />s.d. {formatCommitteeDate(assignment.endsAt)}</> : "—"}</td><td className="px-4 py-4"><StatusBadge label={member.status === "ACTIVE" ? "Aktif" : "Nonaktif"} variant={member.status === "ACTIVE" ? "success" : "danger"} /></td><td className="px-4 py-4"><Link to={`/admin/committee/${member.id}`} className="inline-flex min-h-[40px] items-center gap-1 px-2 font-black text-emerald-800 hover:bg-emerald-50">Kelola <ArrowRight className="h-4 w-4" /></Link></td></tr>;
            })}
            {!loading && data.items.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-sm text-slate-500">Belum ada akun panitia sesuai filter.</td></tr>}
          </tbody></table>
        </div>
      </section>}

      {view === "assignments" && <section className="grid gap-5 xl:grid-cols-2">{events.map((event) => {
        const team = allAssignments.filter((assignment) => assignment.eventId === event.id);
        return <article key={event.id} className="border-t-4 border-emerald-700 bg-white p-5 shadow-sm"><div className="flex justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-emerald-700">{event.code}</p><h2 className="mt-1 text-lg font-black text-slate-950">{event.name}</h2></div><StatusBadge label={event.status.replaceAll("_", " ")} variant="info" /></div><div className="mt-5 divide-y divide-slate-100 border-y border-slate-200">{team.map(({ member, ...assignment }) => <div key={assignment.id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-bold text-slate-900">{member.name}</p><p className="text-xs text-slate-500">{roleLabel(assignment.committeeRole)}</p></div>{assignment.endsAt && hasExpired(assignment.endsAt) ? <StatusBadge label="Berakhir" variant="danger" /> : <StatusBadge label="Aktif" variant="success" />}</div>)}{team.length === 0 && <p className="py-5 text-sm text-amber-800">Belum ada panitia. Tetapkan minimal koordinator dan petugas check-in.</p>}</div><Link to={`/admin/events/${event.id}/team`} className="mt-4 inline-flex min-h-[42px] items-center gap-2 font-black text-emerald-800">Atur tim event <ArrowRight className="h-4 w-4" /></Link></article>;
      })}</section>}

      {view === "access" && <section className="overflow-x-auto border border-slate-200 bg-white"><table className="min-w-full text-left text-sm"><thead className="bg-slate-950 text-xs uppercase text-white"><tr><th className="px-4 py-3">Peran</th><th className="px-4 py-3">Fokus kewenangan</th><th className="px-4 py-3">Kontrol sensitif</th></tr></thead><tbody className="divide-y divide-slate-100">{COMMITTEE_ROLES.map((role) => <tr key={role.value}><td className="px-4 py-4 font-black text-slate-950">{role.label}</td><td className="px-4 py-4 text-slate-600">{role.purpose}</td><td className="px-4 py-4">{role.value === "EVENT_ADMIN" ? <StatusBadge label="Konfigurasi event" variant="warning" /> : role.value === "COMMITTEE_LEAD" ? <StatusBadge label="Publikasi info" variant="info" /> : <StatusBadge label="Operasional terbatas" variant="success" />}</td></tr>)}</tbody></table><p className="border-t border-slate-200 bg-slate-50 p-4 text-xs text-slate-600"><KeyRound className="mr-2 inline h-4 w-4" />Akses efektif selalu dibatasi event dan masa tugas. Menonaktifkan tugas juga mengakhiri akses RBAC terkait.</p></section>}

      {view === "deadlines" && <section className="space-y-3">{events.map((event) => <article key={event.id} className="grid gap-4 border-t-4 border-emerald-700 bg-white p-5 shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.7fr)_minmax(12rem,0.7fr)]"><div><p className="text-xs font-black uppercase tracking-wide text-emerald-700">{event.code}</p><h2 className="mt-1 font-black text-slate-950">{event.name}</h2><p className="mt-2 text-xs text-slate-500">{event.attendanceConfirmationRequired === false ? "Konfirmasi sebelum check-in tidak diwajibkan" : "Konfirmasi wajib sebelum check-in"} · kebijakan {event.lateConfirmationPolicy || "BLOCK"}</p></div><div><p className="text-xs font-bold text-slate-500">Respons undangan</p><p className={`mt-1 text-sm font-black ${hasExpired(event.invitationResponseDeadline) ? "text-rose-700" : "text-slate-900"}`}>{formatCommitteeDate(event.invitationResponseDeadline)}</p></div><div><p className="text-xs font-bold text-slate-500">Konfirmasi kehadiran</p><p className={`mt-1 text-sm font-black ${hasExpired(event.attendanceConfirmationDeadline) ? "text-rose-700" : "text-slate-900"}`}>{formatCommitteeDate(event.attendanceConfirmationDeadline)}</p></div></article>)}{events.length === 0 && <div className="border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500"><CheckCircle2 className="mx-auto mb-2 h-6 w-6" />Tenggat akan tampil setelah event tersimpan.</div>}</section>}
    </AdminLayout>
  );
};
