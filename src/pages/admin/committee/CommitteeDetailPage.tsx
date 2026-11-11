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
import { fromEventIso, toEventIso } from "@/lib/eventDateTime";

type EventItem = { id: string; code: string; name: string; timezone: string };
const fieldClass =
  "min-h-[46px] w-full min-w-0 border border-slate-300 bg-white px-3 text-sm outline-2 outline-transparent hover:border-slate-400 focus-visible:outline-emerald-700";

export const CommitteeDetailPage: React.FC = () => {
  const { id = "" } = useParams();
  const [member, setMember] = useState<CommitteeMember | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [notice, setNotice] = useState("");
  const [editingAssignmentId, setEditingAssignmentId] = useState("");
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [savingGlobalAccess, setSavingGlobalAccess] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState({ committeeRole: "COMMITTEE_ADMIN", startsAt: "", endsAt: "" });
  const [form, setForm] = useState({
    eventId: "",
    committeeRole: "COMMITTEE_ADMIN",
    startsAt: "",
    endsAt: "",
  });

  const load = async () => {
    try {
      const [nextMember, nextEvents] = await Promise.all([
        committeeApi<CommitteeMember>(`/committee-members/${id}`),
        committeeApi<EventItem[]>("/events/options"),
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
          startsAt: toEventIso(form.startsAt, events.find((item) => item.id === form.eventId)?.timezone || "Asia/Jakarta"),
          endsAt: toEventIso(form.endsAt, events.find((item) => item.id === form.eventId)?.timezone || "Asia/Jakarta"),
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

  const toggleGlobalAccess = async () => {
    if (!member || savingGlobalAccess) return;
    const enabled = !member.globalAccess;
    if (enabled && !window.confirm("Berikan akses membuat dan mengelola SEMUA event kepada akun ini?")) return;
    if (!enabled && !window.confirm("Cabut akses semua event? Penugasan per event yang terpisah tetap berlaku.")) return;
    setSavingGlobalAccess(true);
    try {
      await committeeApi(`/committee-members/${id}/global-access`, { method: "PUT", body: JSON.stringify({ enabled }) });
      setNotice(enabled ? "Akses semua event berhasil diberikan." : "Akses semua event berhasil dicabut.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Akses semua event gagal diperbarui.");
    } finally {
      setSavingGlobalAccess(false);
    }
  };

  const endAssignment = async (eventId: string, assignmentId: string) => {
    if (!window.confirm("Akhiri tugas ini? Akses ke event terkait akan dicabut.")) return;
    try {
      await committeeApi(`/events/${eventId}/committee/${assignmentId}`, { method: "DELETE" });
      setNotice("Masa tugas dan akses event telah diakhiri.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Masa tugas gagal diakhiri.");
    }
  };

  const beginAssignmentEdit = (assignment: CommitteeMember["assignments"][number]) => {
    const timezone = events.find((event) => event.id === assignment.eventId)?.timezone || "Asia/Jakarta";
    setAssignmentForm({ committeeRole: assignment.committeeRole,
      startsAt: fromEventIso(assignment.startsAt, timezone), endsAt: fromEventIso(assignment.endsAt, timezone) });
    setEditingAssignmentId(assignment.id);
    setNotice("");
  };

  const saveAssignment = async (event: React.FormEvent, assignment: CommitteeMember["assignments"][number]) => {
    event.preventDefault();
    if (savingAssignment) return;
    setSavingAssignment(true);
    const timezone = events.find((item) => item.id === assignment.eventId)?.timezone || "Asia/Jakarta";
    try {
      await committeeApi(`/events/${assignment.eventId}/committee/${assignment.id}`, { method: "PATCH",
        body: JSON.stringify({ committeeRole: assignmentForm.committeeRole,
          startsAt: toEventIso(assignmentForm.startsAt, timezone), endsAt: toEventIso(assignmentForm.endsAt, timezone) }) });
      setEditingAssignmentId("");
      setNotice("Peran dan masa tugas berhasil diperbarui. Hak akses lama telah disesuaikan.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Perubahan tugas gagal disimpan.");
    } finally {
      setSavingAssignment(false);
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
                <p className="mt-1 text-sm text-slate-600">Login dengan email dan password. Admin lintas-event dapat memakai Portal Panitia dan Ruang Kelola Event.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2"><StatusBadge label={member.globalAccess ? "Akses semua event" : "Akses sesuai tugas"} variant={member.globalAccess ? "warning" : "info"} /><StatusBadge label={member.status === "ACTIVE" ? "Akun aktif" : "Akun nonaktif"} variant={member.status === "ACTIVE" ? "success" : "danger"} /></div>
            </div>

            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-black">Admin Panitia Semua Event</p>
              <p className="mt-1">{member.globalAccess ? "Akun dapat membuat dan mengelola semua event tanpa penugasan tambahan." : "Akun saat ini hanya dapat mengakses event sesuai penugasan di bawah."}</p>
              <button type="button" disabled={savingGlobalAccess} onClick={() => void toggleGlobalAccess()} className="mt-3 min-h-[44px] rounded-lg border border-amber-400 bg-white px-4 text-sm font-bold disabled:opacity-50">{savingGlobalAccess ? "Menyimpan…" : member.globalAccess ? "Cabut akses semua event" : "Berikan akses semua event"}</button>
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
                    <button type="button" onClick={() => beginAssignmentEdit(assignment)} className="min-h-[40px] whitespace-nowrap border border-emerald-200 px-3 text-sm font-black text-emerald-800 hover:bg-emerald-50">Edit peran & masa tugas</button>
                    <button onClick={() => endAssignment(assignment.eventId, assignment.id)} className="min-h-[40px] whitespace-nowrap border border-rose-200 px-3 text-sm font-black text-rose-700 hover:bg-rose-50 active:bg-rose-100">
                      Akhiri tugas
                    </button>
                  </div>
                  {editingAssignmentId === assignment.id && <form onSubmit={(event) => void saveAssignment(event, assignment)} className="mt-4 grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:grid-cols-2">
                    <label className="sm:col-span-2"><span className="mb-1 block text-sm font-bold">Peran pada event ini</span><select value={assignmentForm.committeeRole} onChange={(event) => setAssignmentForm({ ...assignmentForm, committeeRole: event.target.value })} className={fieldClass}>{COMMITTEE_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
                    <label><span className="mb-1 block text-sm font-bold">Mulai tugas</span><input type="datetime-local" value={assignmentForm.startsAt} onChange={(event) => setAssignmentForm({ ...assignmentForm, startsAt: event.target.value })} className={fieldClass} /></label>
                    <label><span className="mb-1 block text-sm font-bold">Akhir tugas</span><input type="datetime-local" value={assignmentForm.endsAt} onChange={(event) => setAssignmentForm({ ...assignmentForm, endsAt: event.target.value })} className={fieldClass} /></label>
                    <div className="flex flex-wrap gap-2 sm:col-span-2"><button type="submit" disabled={savingAssignment} className="min-h-[44px] bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50">{savingAssignment ? "Menyimpan…" : "Simpan perubahan"}</button><button type="button" disabled={savingAssignment} onClick={() => setEditingAssignmentId("")} className="min-h-[44px] border border-slate-300 bg-white px-4 text-sm font-bold">Batal</button></div>
                  </form>}
                </article>
              ))}
              {member.assignments.length === 0 && (
                <div className="border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                  {member.globalAccess ? "Akses semua event sudah aktif; tidak perlu menambahkan tugas satu per satu." : "Akun belum memiliki tugas event."}
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
                  <span className="mt-2 block text-sm leading-6 text-slate-600">{COMMITTEE_ROLES.find((role) => role.value === form.committeeRole)?.purpose}</span>
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
