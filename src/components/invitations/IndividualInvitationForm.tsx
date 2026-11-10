/* Hallmark · pre-emit critique: P5 H4 E4 S5 R5 V4
 * Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app
 */
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Link2, Loader2, PencilLine, UserRound } from "lucide-react";
import { eventTimezoneLabel } from "@/lib/eventDateTime";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

export type IndividualInvitationRecipient = { id: string; fullName: string; email?: string | null;
  whatsapp?: string | null; phone?: string | null };
export type IndividualInvitationValues = { ustadzId: string; invitationNumber: string; responseDeadline: string };

export const IndividualInvitationForm: React.FC<{
  value: IndividualInvitationValues;
  onChange: (value: IndividualInvitationValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
  loadOptions: (search: string, page: number, signal: AbortSignal) => Promise<IndividualInvitationRecipient[]>;
  selectedRecipient?: IndividualInvitationRecipient | null;
  editing: boolean;
  replacementNumber?: string;
  recipientLocked: boolean;
  timezone: string;
  busy: boolean;
  disabled: boolean;
  canOpenProfile: boolean;
  canCreateProfile: boolean;
  error?: string;
}> = ({ value, onChange, onSubmit, onCancel, loadOptions, selectedRecipient, editing,
  replacementNumber = "", recipientLocked, timezone, busy, disabled, canOpenProfile, canCreateProfile, error }) => {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim());
  const [page, setPage] = useState(1);
  const [options, setOptions] = useState<IndividualInvitationRecipient[]>([]);
  const [chosen, setChosen] = useState<IndividualInvitationRecipient | null>(selectedRecipient || null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [optionsError, setOptionsError] = useState("");
  const recipient = options.find((item) => item.id === value.ustadzId)
    || (chosen?.id === value.ustadzId ? chosen : null)
    || (selectedRecipient?.id === value.ustadzId ? selectedRecipient : null);

  useEffect(() => {
    if (!value.ustadzId) { setSearch(""); setChosen(null); }
  }, [value.ustadzId]);

  useEffect(() => {
    if (disabled || recipientLocked) return;
    const controller = new AbortController();
    setLoadingOptions(true); setOptionsError("");
    void loadOptions(debouncedSearch, page, controller.signal).then((items) => {
      if (controller.signal.aborted) return;
      setOptions((current) => page === 1 ? items : [...new Map([...current, ...items].map((item) => [item.id, item])).values()]);
      setHasMore(items.length === 20);
    }).catch((cause) => {
      if (!controller.signal.aborted) setOptionsError(cause instanceof Error ? cause.message : "Daftar asatidz gagal dimuat.");
    }).finally(() => { if (!controller.signal.aborted) setLoadingOptions(false); });
    return () => controller.abort();
  }, [debouncedSearch, page, loadOptions, disabled, recipientLocked]);

  const inputClass = "mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-2 outline-transparent hover:bg-slate-50 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-100";
  return <section id="individual-invitation-editor" className={`min-w-0 rounded-2xl border bg-white p-5 shadow-sm ${editing ? "border-sky-300 ring-2 ring-sky-100" : "border-slate-200"}`}>
    <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
      {editing ? <PencilLine className="h-5 w-5 text-sky-700" /> : <UserRound className="h-5 w-5 text-emerald-700" />}
      <h2 className="text-base font-black text-slate-950">{editing ? "Edit undangan pribadi" : replacementNumber ? "Buat undangan pengganti" : "Undang asatidz"}</h2>
    </div>
    <p className="mt-3 text-sm leading-6 text-slate-600">{replacementNumber
      ? `Undangan ${replacementNumber} tetap dicabut. Tautan baru hanya untuk satu asatidz; peserta lama tidak dipindahkan.`
      : "Satu tautan untuk satu asatidz. Setelah dibuat, bagikan langsung kepada penerima."}</p>
    <form onSubmit={(event) => { event.preventDefault(); if (!busy && !disabled) onSubmit(); }} aria-label="Formulir undangan pribadi" className="mt-4 space-y-4">
      <fieldset disabled={busy || disabled} className="min-w-0 space-y-4">
        {!recipientLocked && <label className="block text-sm font-bold text-slate-700">Cari profil asatidz
          <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Nama, email, atau nomor telepon" className={inputClass} />
        </label>}
        <label className="block text-sm font-bold text-slate-700">Asatidz penerima
          <select required value={value.ustadzId} disabled={recipientLocked} onChange={(event) => {
            const next = options.find((item) => item.id === event.target.value) || recipient;
            setChosen(next || null); onChange({ ...value, ustadzId: event.target.value });
          }} className={inputClass}>
            <option value="">Pilih profil asatidz</option>
            {recipient && !options.some((item) => item.id === recipient.id) && <option value={recipient.id}>{recipient.fullName}</option>}
            {options.map((item) => <option key={item.id} value={item.id}>{item.fullName}{item.email ? ` · ${item.email}` : ""}</option>)}
          </select>
        </label>
        {loadingOptions && <p role="status" className="text-sm text-slate-600">Memuat pilihan asatidz…</p>}
        {optionsError && <p role="alert" className="text-sm text-rose-800">{optionsError}</p>}
        {!loadingOptions && !optionsError && !options.length && !recipient && <p className="text-sm text-slate-600">Belum ada profil yang cocok. Coba nama lain.</p>}
        {canCreateProfile && !recipientLocked && <Link to="/admin/ustadz/create" target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center text-sm font-bold text-emerald-800 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">Tambah profil asatidz ↗</Link>}
        {hasMore && !recipientLocked && <button type="button" disabled={loadingOptions} onClick={() => setPage((current) => current + 1)} className="min-h-11 text-sm font-bold text-emerald-800 underline disabled:opacity-50">Tampilkan lagi</button>}
        {recipient && <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950" aria-label="Penerima terpilih">
          <strong className="block break-words">{recipient.fullName}</strong>
          <p className="mt-1 break-all">{recipient.email || "Email belum tersedia"}</p>
          <p>{recipient.whatsapp || recipient.phone || "WhatsApp belum tersedia"}</p>
          {canOpenProfile && <Link to={`/admin/ustadz/${recipient.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-bold underline">Lihat profil ↗</Link>}
        </div>}
        {recipientLocked && <p className="text-sm text-slate-600">Penerima terkunci karena undangan sudah direspons atau peserta terdaftar.</p>}
        <label className="block text-sm font-bold text-slate-700">{replacementNumber ? "Nomor undangan baru" : "Nomor undangan"}
          <input id="individual-invitation-number" required minLength={2} maxLength={120} value={value.invitationNumber}
            onChange={(event) => onChange({ ...value, invitationNumber: event.target.value })} placeholder="INV/2027/PRIBADI/001" className={inputClass} />
        </label>
        <label className="block text-sm font-bold text-slate-700">Batas respons · {eventTimezoneLabel(timezone)}
          <input type="datetime-local" value={value.responseDeadline} onChange={(event) => onChange({ ...value, responseDeadline: event.target.value })} className={inputClass} />
          <span className="mt-1 block text-sm font-normal text-slate-600">Kosongkan untuk mengikuti batas event.</span>
        </label>
      </fieldset>
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-950">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {(editing || replacementNumber) && <button type="button" disabled={busy} onClick={onCancel} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-bold focus-visible:outline-emerald-700">Batal</button>}
        <button type="submit" disabled={busy || disabled || !value.ustadzId} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-emerald-700 px-3 text-sm font-black text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <PencilLine className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
          {busy ? "Menyimpan…" : editing ? "Simpan perubahan" : replacementNumber ? "Buat tautan pengganti" : "Buat tautan pribadi"}
        </button>
      </div>
    </form>
  </section>;
};
