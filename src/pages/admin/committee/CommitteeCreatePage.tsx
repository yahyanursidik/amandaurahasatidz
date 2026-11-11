import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { CommitteeWorkspaceNav } from "@/components/admin/committee/CommitteeWorkspaceNav";
import { PageHeader } from "@/components/common/PageHeader";
import { committeeApi, COMMITTEE_ACCOUNT_ROLES } from "@/lib/committeeApi";
import { toEventIso } from "@/lib/eventDateTime";

type EventItem = { id: string; code: string; name: string; timezone: string };

const fieldClass =
  "min-h-[48px] w-full min-w-0 border border-slate-300 bg-white px-3 text-sm outline-2 outline-transparent hover:border-slate-400 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-55";

export const CommitteeCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedRole = params.get("role") || "COMMITTEE_ORGANIZER";
  const initialRole = COMMITTEE_ACCOUNT_ROLES.some((role) => role.value === requestedRole) ? requestedRole : "COMMITTEE_ORGANIZER";
  const [events, setEvents] = useState<EventItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    status: "ACTIVE",
    eventId: params.get("eventId") || "",
    committeeRole: initialRole,
    startsAt: "",
    endsAt: "",
  });

  useEffect(() => {
    void committeeApi<EventItem[]>("/events/options").then(setEvents).catch(() => setEvents([]));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const timezone = form.committeeRole === "COMMITTEE_ORGANIZER" ? "Asia/Jakarta"
        : events.find((item) => item.id === form.eventId)?.timezone || "Asia/Jakarta";
      const created = await committeeApi<{ id: string }>("/committee-members", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          eventId: form.committeeRole === "COMMITTEE_ORGANIZER" ? null : form.eventId,
          startsAt: toEventIso(form.startsAt, timezone),
          endsAt: toEventIso(form.endsAt, timezone),
        }),
      });
      navigate(`/admin/committee/${created.id}`, { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Akun panitia gagal dibuat.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <PageHeader
        title="Tambah Akun Panitia"
        description="Pilih akses semua event untuk admin panitia pusat, atau batasi petugas pada satu event."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Panitia", href: "/admin/committee" },
          { label: "Tambah akun" },
        ]}
      />
      <CommitteeWorkspaceNav />
      <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
        <strong>{COMMITTEE_ACCOUNT_ROLES.find((role) => role.value === form.committeeRole)?.label}</strong> · {COMMITTEE_ACCOUNT_ROLES.find((role) => role.value === form.committeeRole)?.purpose}
        <> Masuk melalui <Link to={form.committeeRole === "EVENT_ADMIN" ? "/login/admin" : "/login/committee"} className="font-bold underline">{form.committeeRole === "EVENT_ADMIN" ? "Portal Admin" : "Portal Panitia"}</Link>{form.committeeRole === "COMMITTEE_ORGANIZER" ? "; tersedia juga Ruang Kelola Event untuk semua event." : "."}</>
      </div>
      {error && (
        <div role="alert" className="mb-5 border-t-4 border-rose-600 bg-rose-50 p-4 text-sm text-rose-900">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="grid max-w-5xl gap-6 xl:grid-cols-2">
        <section className="border-t-4 border-slate-900 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Identitas dan login</h2>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Nama lengkap *</span>
              <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={fieldClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Email login *</span>
              <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={fieldClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Password sementara *</span>
              <input required minLength={8} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className={fieldClass} />
              <span className="mt-1 block min-h-[1lh] text-xs text-slate-500">Minimal 8 karakter. Kirim melalui kanal privat.</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Status akun</span>
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className={fieldClass}>
                <option value="ACTIVE">Aktif</option>
                <option value="INACTIVE">Nonaktif</option>
              </select>
            </label>
          </div>
        </section>

        <section className="border-t-4 border-emerald-700 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Cakupan akses</h2>
          <p className="mt-1 text-sm text-slate-500">Peran admin lintas-event tidak memerlukan penugasan. Peran lain harus memilih event.</p>
          <div className="mt-5 space-y-4">
            {form.committeeRole !== "COMMITTEE_ORGANIZER" ? <label className="block">
              <span className="mb-1 block text-sm font-bold">Event *</span>
              <select required value={form.eventId} onChange={(event) => setForm({ ...form, eventId: event.target.value })} className={fieldClass}>
                <option value="">Pilih event</option>
                {events.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
              </select>
            </label> : <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><strong>Akses lintas-event.</strong> Akun ini dapat membuat serta mengelola semua event saat ini dan yang dibuat nanti. Berikan hanya kepada penanggung jawab tepercaya.</p>}
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Peran *</span>
              <select value={form.committeeRole} onChange={(event) => setForm({ ...form, committeeRole: event.target.value })} className={fieldClass}>
                {COMMITTEE_ACCOUNT_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
              <span className="mt-2 block text-sm leading-6 text-slate-600">{COMMITTEE_ACCOUNT_ROLES.find((role) => role.value === form.committeeRole)?.purpose}</span>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-sm font-bold">{form.committeeRole === "COMMITTEE_ORGANIZER" ? "Mulai akses (WIB)" : "Mulai tugas"}</span>
                <input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} className={fieldClass} />
              </label>
              <label>
                <span className="mb-1 block text-sm font-bold">{form.committeeRole === "COMMITTEE_ORGANIZER" ? "Akhir akses (WIB)" : "Akhir tugas"}</span>
                <input type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} className={fieldClass} />
              </label>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap justify-end gap-2 xl:col-span-2">
          <button type="button" onClick={() => navigate("/admin/committee")} className="min-h-[44px] whitespace-nowrap border border-slate-300 bg-white px-4 text-sm font-bold hover:bg-slate-50 active:bg-slate-100">
            Batal
          </button>
          <button disabled={submitting} className="min-h-[44px] whitespace-nowrap bg-emerald-700 px-5 text-sm font-black text-white hover:bg-emerald-800 active:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-55">
            {submitting ? "Menyimpan…" : "Buat akun dan akses"}
          </button>
        </div>
      </form>
    </AdminLayout>
  );
};
