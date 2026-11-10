import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Link2, Loader2, PencilLine, Plus, Search, Users } from "lucide-react";
import type { InstitutionInvitationValues, InvitationInstitutionOption } from "@/lib/institutionInvitation";
import { institutionRegionLabel } from "@/lib/institutionRegion";
import { eventTimezoneLabel } from "@/lib/eventDateTime";

export const InstitutionInvitationForm: React.FC<{
  institutions: InvitationInstitutionOption[];
  value: InstitutionInvitationValues;
  onChange: (value: InstitutionInvitationValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
  editing: boolean;
  recipientLocked: boolean;
  registeredCount: number;
  timezone: string;
  busy: boolean;
  disabled: boolean;
  canOpenMasterData?: boolean;
  error?: string;
}> = ({ institutions, value, onChange, onSubmit, onCancel, editing, recipientLocked, registeredCount, timezone, busy, disabled, canOpenMasterData = true, error }) => {
  const [search, setSearch] = useState("");
  const selected = institutions.find((institution) => institution.id === value.institutionId);
  const options = institutions.filter((institution) => institution.id === value.institutionId ||
    `${institution.name} ${institution.code}`.toLowerCase().includes(search.trim().toLowerCase()));
  const inputClass = "mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:outline-emerald-700 disabled:bg-slate-100";
  return <section id="institution-invitation-editor" className={`min-w-0 rounded-2xl border bg-white p-5 shadow-sm ${editing ? "border-sky-300 ring-2 ring-sky-100" : "border-slate-200"}`}>
    <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
      {editing ? <PencilLine className="h-5 w-5 text-sky-700" /> : <Plus className="h-5 w-5 text-emerald-700" />}
      <h2 className="text-base font-black text-slate-950">{editing ? "Edit undangan lembaga" : "Buat undangan lembaga"}</h2>
    </div>
    <form onSubmit={(event) => { event.preventDefault(); if (!busy && !disabled) onSubmit(); }} aria-label={editing ? "Edit undangan lembaga" : "Buat undangan lembaga"} className="mt-4 space-y-4">
      <fieldset disabled={busy || disabled} className="min-w-0 space-y-4">
        <div>
          {!recipientLocked && <label className="relative mb-2 block"><span className="sr-only">Cari data lembaga</span><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau kode lembaga" className={`${inputClass} pl-9`} /></label>}
          <label className="block text-sm font-bold text-slate-700">Lembaga penerima<select required value={value.institutionId} disabled={recipientLocked} onChange={(event) => onChange({ ...value, institutionId: event.target.value })} className={inputClass}>
            <option value="">Pilih dari data lembaga</option>
            {options.map((institution) => <option key={institution.id} value={institution.id}>{institution.code} · {institution.name}</option>)}
          </select></label>
          {recipientLocked && <p className="mt-2 text-xs text-slate-500">Lembaga terkunci karena sudah ada respons atau peserta.</p>}
        </div>
        {selected && <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950" aria-label="Data lembaga terpilih">
          <div className="flex items-start gap-2"><Building2 className="mt-0.5 h-4 w-4 shrink-0" /><strong className="min-w-0 break-words">{selected.name}</strong></div>
          {selected.contactName && <p className="mt-2 break-words text-xs">PIC: {selected.contactName}</p>}
          <p className="mt-1 break-all text-xs">{selected.email || "Email belum tersedia"}</p>
          <p className="mt-1 text-xs">{selected.whatsapp || selected.phone || "WhatsApp belum tersedia"}</p>
          {selected.cityCode && <p className="mt-1 text-xs">{institutionRegionLabel(selected.cityCode, selected.provinceCode).city}</p>}
          {canOpenMasterData && <Link to={`/admin/institutions/${selected.id}`} target="_blank" className="mt-2 inline-flex min-h-11 items-center text-xs font-bold underline">Profil lembaga ↗</Link>}
        </div>}
        {!selected && !institutions.length && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Belum ada lembaga aktif. {canOpenMasterData ? "Tambahkan melalui data lembaga." : "Hubungi pengelola data lembaga."}</p>}
        <label className="block text-sm font-bold text-slate-700">Nomor undangan<input required minLength={2} maxLength={120} value={value.invitationNumber} onChange={(event) => onChange({ ...value, invitationNumber: event.target.value })} placeholder="INV/2027/001" className={inputClass} /></label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
          <input type="checkbox" checked={value.allowGroup} disabled={registeredCount > 1} onChange={(event) => onChange({ ...value, allowGroup: event.target.checked, quota: event.target.checked ? Math.max(2, value.quota) : 1 })} className="mt-1 h-5 w-5 shrink-0 accent-sky-700" />
          <span><strong className="flex items-center gap-2"><Users className="h-4 w-4" /> Boleh membawa rombongan</strong><span className="mt-1 block text-xs">{value.allowGroup ? "Kuota termasuk peserta utama." : "Hanya satu perwakilan; form peserta tambahan disembunyikan."}</span></span>
        </label>
        {value.allowGroup && <label className="block text-sm font-bold text-slate-700">Kuota peserta<input type="number" min={Math.max(2, registeredCount)} max={1000} step={1} required value={value.quota} onChange={(event) => onChange({ ...value, quota: Number(event.target.value) })} className={inputClass} /></label>}
        <label className="block text-sm font-bold text-slate-700">Batas respons · {eventTimezoneLabel(timezone)}<input type="datetime-local" value={value.responseDeadline} onChange={(event) => onChange({ ...value, responseDeadline: event.target.value })} className={inputClass} /><span className="mt-1 block text-xs font-normal text-slate-500">Kosongkan untuk mengikuti batas respons event.</span></label>
        {registeredCount > 0 && <p className="text-xs text-slate-600">{registeredCount} peserta sudah terdaftar. Perubahan tidak menghapus peserta atau presensi.</p>}
      </fieldset>
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-950">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {editing && <button type="button" disabled={busy} onClick={onCancel} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-bold">Batal</button>}
        <button type="submit" disabled={busy || disabled || !institutions.length} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <PencilLine className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}{busy ? "Menyimpan…" : editing ? "Simpan perubahan" : "Buat tautan undangan"}
        </button>
      </div>
    </form>
    {canOpenMasterData && <Link to="/admin/institutions" target="_blank" className="mt-3 inline-flex min-h-11 items-center text-xs font-bold text-emerald-800 underline">Buka data lembaga ↗</Link>}
  </section>;
};
