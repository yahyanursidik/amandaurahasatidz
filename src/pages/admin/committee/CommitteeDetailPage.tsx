import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarPlus, LogIn, ShieldOff } from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { CommitteeWorkspaceNav } from "@/components/admin/committee/CommitteeWorkspaceNav";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  committeeApi,
  CommitteeMember,
  COMMITTEE_ROLES,
  formatCommitteeDate,
  roleLabel,
} from "@/lib/committeeApi";

type EventItem = { id: string; code: string; name: string };
const fieldClass =
  "min-h-[46px] w-full min-w-0 border border-slate-300 bg-white px-3 text-sm outline-2 outline-transparent hover:border-slate-400 focus-visible:outline-emerald-700";

export const CommitteeDetailPage: React.FC = () => {
  const { id = "" } = useParams();
  const [member, setMember] = useState<CommitteeMember | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    eventId: "",
    committeeRole: "CHECKIN_OFFICER",
    startsAt: "",
    endsAt: "",
  });

  const load = async () => {
    try {
      const [nextMember, nextEvents] = await Promise.all([
        committeeApi<CommitteeMember>(`/committee-members/${id}`),
        committeeApi<EventItem[]>("/events"),
      ]);
      setMember(nextMember);
      setEvents(nextEvents);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Data gagal dimuat.");
    }
  };

  useEffect(() => { void load(); }, [id]);

  const assign = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await committeeApi(`/events/${form.eventId}/committee`, {
        method: "POST",
        body: JSON.stringify({
          userId: id,
          committeeRole: form.committeeRole,
          startsAt: form.startsAt || null,
          endsAt: form.endsAt || null,
        }),
      });
      setNotice("Penugasan dan akses RBAC berhasil disimpan.");
      setForm({ ...form, eventId: "", startsAt: "", endsAt: "" });
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Penugasan gagal.");
    }
  };

  const toggleStatus = async () => {
    if (!member) return;
    try {
      await committeeApi(`/committee-members/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: member.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
      });
      setNotice("Status akun diperbarui.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Status gagal diperbarui.");
    }
  };

  const endAssignment = async (eventId: string, assignmentId: string) => {
    try {
      await committeeApi(`/events/${eventId}/committee/${assignmentId}`, { method: "DELETE" });
      setNotice("Masa tugas dan akses event telah diakhiri.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Masa tugas gagal diakhiri.");
    }
  };

  return (
    <AdminLayout>
      <PageHeader
        title={member?.name || "Rincian Panitia"}
        description="Kelola status akun, cakupan event, peran, dan masa akses."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Panitia", href: "/admin/committee" },
          { label: member?.name || "Rincian" },
        ]}
        actions={member && (
          <button onClick={toggleStatus} className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap border border-slate-300 bg-white px-4 text-sm font-black text-slate-800 hover:bg-slate-50 active:bg-slate-100">
            <ShieldOff className="h-4 w-4" />
            {member.status === "ACTIVE" ? "Nonaktifkan akun" : "Aktifkan akun"}
          </button>
        )}
      />
      <CommitteeWorkspaceNav />
      {notice && <div role="status" className="mb-5 border-t-4 border-emerald-700 bg-emerald-50 p-4 text-sm text-emerald-950">{notice}</div>}

      {member ? (
        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-y border-slate-200 bg-white p-4">
              <div>
                <p className="text-sm font-black text-slate-950">{member.email}</p>
                <p className="mt-1 text-xs text-slate-500">Login portal panitia dengan email dan password.</p>
              </div>
              <StatusBadge label={member.status === "ACTIVE" ? "Akun aktif" : "Akun nonaktif"} variant={member.status === "ACTIVE" ? "success" : "danger"} />
            </div>

            <div className="space-y-3">
              {member.assignments.map((assignment) => (
                <article key={assignment.id} className="border-t-4 border-emerald-700 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-wide text-emerald-700">{assignment.eventCode}</p>
                      <h2 className="mt-1 text-lg font-black text-slate-950">{assignment.eventName}</h2>
                      <p className="mt-2 text-sm font-bold text-slate-700">{roleLabel(assignment.committeeRole)}</p>
                    </div>
                    <StatusBadge label={assignment.eventStatus.replaceAll("_", " ")} variant="info" />
                  </div>
                  <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
                    <div><dt className="text-xs font-bold text-slate-500">Mulai</dt><dd className="mt-1 font-semibold">{formatCommitteeDate(assignment.startsAt)}</dd></div>
                    <div><dt className="text-xs font-bold text-slate-500">Berakhir</dt><dd className="mt-1 font-semibold">{formatCommitteeDate(assignment.endsAt)}</dd></div>
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link to={`/admin/events/${assignment.eventId}/team`} className="inline-flex min-h-[40px] items-center whitespace-nowrap px-3 text-sm font-black text-emerald-800 hover:bg-emerald-50 active:bg-emerald-100">
                      Buka tim event
                    </Link>
                    <button onClick={() => endAssignment(assignment.eventId, assignment.id)} className="min-h-[40px] whitespace-nowrap border border-rose-200 px-3 text-sm font-black text-rose-700 hover:bg-rose-50 active:bg-rose-100">
                      Akhiri tugas
                    </button>
                  </div>
                </article>
              ))}
              {member.assignments.length === 0 && (
                <div className="border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                  Akun belum memiliki tugas event.
                </div>
              )}
            </div>
          </section>

          <aside>
            <form onSubmit={assign} className="sticky top-24 border-t-4 border-slate-950 bg-white p-5 shadow-sm">
              <CalendarPlus className="h-5 w-5 text-emerald-700" />
              <h2 className="mt-3 text-lg font-black text-slate-950">Tambah penugasan</h2>
              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-bold">Event *</span>
                  <select required value={form.eventId} onChange={(event) => setForm({ ...form, eventId: event.target.value })} className={fieldClass}>
                    <option value="">Pilih event</option>
                    {events.map((event) => <option key={event.id} value={event.id}>{event.code} · {event.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-bold">Peran *</span>
                  <select value={form.committeeRole} onChange={(event) => setForm({ ...form, committeeRole: event.target.value })} className={fieldClass}>
                    {COMMITTEE_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-bold">Mulai tugas</span>
                  <input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} className={fieldClass} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-bold">Akhir tugas</span>
                  <input type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} className={fieldClass} />
                </label>
                <button className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 whitespace-nowrap bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800 active:bg-emerald-900">
                  <LogIn className="h-4 w-4" />
                  Simpan tugas dan akses
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : (
        <div className="h-72 animate-pulse bg-slate-100" />
      )}
    </AdminLayout>
  );
};
