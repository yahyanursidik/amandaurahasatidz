import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { CommitteeWorkspaceNav } from "@/components/admin/committee/CommitteeWorkspaceNav";
import { PageHeader } from "@/components/common/PageHeader";
import { committeeApi, COMMITTEE_ROLES } from "@/lib/committeeApi";

type EventItem = { id: string; code: string; name: string };

const fieldClass =
  "min-h-[48px] w-full min-w-0 border border-slate-300 bg-white px-3 text-sm outline-2 outline-transparent hover:border-slate-400 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-55";

export const CommitteeCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    status: "ACTIVE",
    eventId: "",
    committeeRole: "CHECKIN_OFFICER",
    startsAt: "",
    endsAt: "",
  });

  useEffect(() => {
    void committeeApi<EventItem[]>("/events").then(setEvents).catch(() => setEvents([]));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const created = await committeeApi<{ id: string }>("/committee-members", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          startsAt: form.startsAt || null,
          endsAt: form.endsAt || null,
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
        description="Buat kredensial login dan langsung tetapkan tugas event pertama."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Panitia", href: "/admin/committee" },
          { label: "Tambah akun" },
        ]}
      />
      <CommitteeWorkspaceNav />
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
          <h2 className="text-lg font-black text-slate-950">Penugasan pertama</h2>
          <p className="mt-1 text-sm text-slate-500">Wajib agar akun langsung memiliki lingkup event yang aman.</p>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Event *</span>
              <select required value={form.eventId} onChange={(event) => setForm({ ...form, eventId: event.target.value })} className={fieldClass}>
                <option value="">Pilih event</option>
                {events.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Peran *</span>
              <select value={form.committeeRole} onChange={(event) => setForm({ ...form, committeeRole: event.target.value })} className={fieldClass}>
                {COMMITTEE_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-sm font-bold">Mulai tugas</span>
                <input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} className={fieldClass} />
              </label>
              <label>
                <span className="mb-1 block text-sm font-bold">Akhir tugas</span>
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
