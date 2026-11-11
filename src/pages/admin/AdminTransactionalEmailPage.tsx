import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useGetIdentity } from "@refinedev/core";
import { BookOpenText, Mail, RotateCcw, Save } from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { eventApi } from "@/lib/eventApi";
import type { AuthIdentity } from "@/lib/refine/authProvider";

type TransactionalCopy = {
  openingArabic: string;
  individualSalutation: string;
  institutionSalutation: string;
};
type CopyResponse = { settings: TransactionalCopy; version: number | null; updatedAt: string | null };

const previewName = { person: "Ahmad", institution: "Ma'had An-Nur" };

export const AdminTransactionalEmailPage: React.FC = () => {
  const { data: identity, isLoading: identityLoading } = useGetIdentity<AuthIdentity>();
  const canManage = identity?.assignments.some((assignment) => assignment.roleCode === "SUPER_ADMIN") ?? false;
  const [saved, setSaved] = useState<CopyResponse | null>(null);
  const [form, setForm] = useState<TransactionalCopy | null>(null);
  const [preview, setPreview] = useState<"person" | "institution">("person");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await eventApi<CopyResponse>("/email/transactional-copy");
      setSaved(result); setForm(result.settings);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pengaturan email gagal dimuat.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (identityLoading || !canManage) { if (!identityLoading) setLoading(false); return; }
    void load();
  }, [canManage, identityLoading, load]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form || !saved || saving) return;
    if (!form.individualSalutation.includes("{{name}}") || !form.institutionSalutation.includes("{{name}}")) {
      setError("Kedua sapaan harus memuat {{name}} agar nama penerima tampil."); return;
    }
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await eventApi<CopyResponse>("/email/transactional-copy", { method: "PUT",
        body: JSON.stringify({ settings: form, expectedVersion: saved.version }) });
      setSaved(result); setForm(result.settings);
      setNotice("Pembuka email tersimpan. Email yang belum dikirim akan menggunakan pengaturan terbaru.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pengaturan email gagal disimpan.");
    } finally { setSaving(false); }
  };

  const name = previewName[preview];
  const salutation = form
    ? (preview === "person" ? form.individualSalutation : form.institutionSalutation).replaceAll("{{name}}", name)
    : "";
  const dirty = Boolean(saved && form && JSON.stringify(saved.settings) !== JSON.stringify(form));

  return <AdminLayout>
    <PageHeader title="Pembuka email transaksional"
      description="Atur pembuka Arab dan sapaan untuk undangan, pendaftaran, konfirmasi, serta pengingat otomatis."
      breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "BC & kampanye", href: "/admin/broadcast" }, { label: "Pembuka email" }]}
      actions={<Link to="/admin/email-jobs" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800"><Mail className="h-4 w-4" /> Antrean email</Link>} />
    {error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}</div>}
    {notice && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">{notice}</div>}
    {!identityLoading && !canManage ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5">Pengaturan email hanya dapat diubah oleh Super Admin.</div>
      : loading ? <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">Memuat pengaturan email…</div>
        : !form ? <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-700">Pengaturan belum dapat dimuat. <button type="button" onClick={() => void load()} className="ml-2 min-h-11 rounded-lg border border-emerald-700 px-4 font-bold text-emerald-800">Coba lagi</button></div>
        : <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <form onSubmit={(event) => void save(event)} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3"><BookOpenText className="mt-1 h-6 w-6 text-emerald-700" /><div><h2 className="text-lg font-black text-slate-950">Naskah pembuka</h2><p className="text-sm text-slate-600">Berlaku untuk email berikutnya yang belum dikirim. Isi utama setiap jenis pesan tetap mengikuti alurnya.</p></div></div>
            <label className="block text-sm font-bold text-slate-800">Pembuka bahasa Arab
              <textarea dir="rtl" lang="ar" required minLength={20} maxLength={1200} rows={5} value={form.openingArabic}
                onChange={(event) => setForm({ ...form, openingArabic: event.target.value })}
                className="mt-2 w-full rounded-xl border border-slate-300 p-4 text-right text-lg font-normal leading-9 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
            </label>
            <label className="block text-sm font-bold text-slate-800">Sapaan asatidz perorangan
              <textarea required minLength={10} maxLength={350} rows={3} value={form.individualSalutation}
                onChange={(event) => setForm({ ...form, individualSalutation: event.target.value })}
                className="mt-2 w-full rounded-xl border border-slate-300 p-4 font-normal leading-7 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
            </label>
            <label className="block text-sm font-bold text-slate-800">Sapaan undangan lembaga
              <textarea required minLength={10} maxLength={350} rows={3} value={form.institutionSalutation}
                onChange={(event) => setForm({ ...form, institutionSalutation: event.target.value })}
                className="mt-2 w-full rounded-xl border border-slate-300 p-4 font-normal leading-7 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
            </label>
            <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-950">Gunakan <code className="font-bold">{"{{name}}"}</code> pada kedua sapaan; sistem menggantinya dengan nama asatidz atau lembaga. Kode OTP tetap singkat tanpa pembuka ini.</p>
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={!dirty || saving} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-800 px-5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "Menyimpan…" : "Simpan pengaturan"}</button>
              <button type="button" disabled={!dirty || saving} onClick={() => { setForm(saved?.settings || null); setError(""); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 font-bold text-slate-800 disabled:opacity-50"><RotateCcw className="h-4 w-4" /> Batalkan perubahan</button>
            </div>
          </form>
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 sm:p-6" aria-label="Pratinjau pembuka email">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black text-slate-950">Pratinjau</h2><p className="text-sm text-slate-600">Contoh pembuka; isi pesan menyesuaikan jenis transaksi.</p></div><select aria-label="Jenis penerima pratinjau" value={preview} onChange={(event) => setPreview(event.target.value as typeof preview)} className="min-h-11 rounded-lg border border-emerald-300 bg-white px-3 font-semibold text-emerald-950"><option value="person">Asatidz</option><option value="institution">Lembaga</option></select></div>
            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="bg-emerald-900 px-5 py-4 text-white"><p className="text-xs font-bold uppercase tracking-widest text-emerald-200">Daurah Duat dan Pegiat Dakwah</p><p className="mt-1 text-lg font-bold">Pemberitahuan acara</p></div><div className="space-y-6 p-5 text-slate-800 sm:p-6"><p dir="rtl" lang="ar" className="whitespace-pre-wrap text-right text-lg leading-9 text-emerald-950">{form.openingArabic}</p><p className="whitespace-pre-wrap text-base font-semibold leading-7">{salutation}</p><p className="text-sm leading-7 text-slate-600">Alhamdulillah, informasi kegiatan telah diperbarui. Rincian, tautan pribadi, dan tindakan yang diperlukan akan tampil di sini sesuai jenis email.</p></div></div>
          </section>
        </div>}
  </AdminLayout>;
};
