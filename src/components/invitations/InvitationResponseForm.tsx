import React, { useEffect, useState } from "react";
import { Building2, CheckCircle2, Plus, Trash2, UserRound, Users } from "lucide-react";
import { RegionFields, type RegionValue } from "@/components/public/RegionFields";
import { invitationAllowsGroup, invitationParticipantLimit } from "@/lib/institutionInvitation";

export type InvitationDelegate = {
  fullName: string; email: string; whatsapp: string; phone: string; address: string; region: RegionValue; isLead: boolean;
};
export type InvitationResponsePayload = {
  responseStatus: "ACCEPTED" | "DECLINED";
  institutionName?: string | null;
  notes: string | null;
  isFinal: true;
  delegates: Array<{ fullName: string; email: string; whatsapp: string; phone: string | null; address: string | null; isLead: boolean } & RegionValue>;
};
export type InvitationFormData = {
  invitation: { invitationNumber: string; quota?: number | null; allowGroup?: boolean; responseDeadline?: string | null; status: string };
  institution?: { name: string; code: string } | null;
  recipient?: { fullName: string } | null;
};

const newDelegate = (fullName = ""): InvitationDelegate => ({ fullName, email: "", whatsapp: "", phone: "", address: "",
  region: { city: "", province: "", cityCode: "", provinceCode: "" }, isLead: false });

export const InvitationResponseForm: React.FC<{
  data: InvitationFormData;
  invitationType: "institution" | "individual";
  saving: boolean;
  error: string;
  policyNotice?: string;
  unavailable?: boolean;
  onSubmit: (payload: InvitationResponsePayload) => void;
}> = ({ data, invitationType, saving, error, policyNotice, unavailable = false, onSubmit }) => {
  const policy = { ...data.invitation, invitationType: invitationType.toUpperCase() };
  const allowsGroup = invitationAllowsGroup(policy);
  const quota = invitationParticipantLimit(policy);
  const [delegates, setDelegates] = useState<InvitationDelegate[]>([newDelegate(invitationType === "individual" ? data.recipient?.fullName : "")]);
  const [bringGroup, setBringGroup] = useState(false);
  const [institutionName, setInstitutionName] = useState("");
  const [responseStatus, setResponseStatus] = useState<"ACCEPTED" | "DECLINED">("ACCEPTED");
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [validationError, setValidationError] = useState("");
  const expired = Boolean(data.invitation.responseDeadline && new Date(data.invitation.responseDeadline) < new Date());
  const groupActive = allowsGroup && bringGroup;
  const visibleDelegates = groupActive ? delegates : delegates.slice(0, 1);
  const inputClass = "mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 focus:border-emerald-600 focus:outline-emerald-700";

  useEffect(() => {
    if (!allowsGroup) { setBringGroup(false); setDelegates((current) => current.slice(0, 1)); }
    else setDelegates((current) => current.slice(0, quota));
    setConsent(false);
  }, [allowsGroup, quota, data.invitation.responseDeadline]);

  const update = (index: number, changes: Partial<InvitationDelegate>) => {
    setDelegates((items) => items.map((item, position) => position === index ? { ...item, ...changes } : item));
    setConsent(false);
  };
  const toggleGroup = (checked: boolean) => {
    setBringGroup(checked);
    if (!checked) setDelegates((items) => items.slice(0, 1));
    setConsent(false); setValidationError("");
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || expired || unavailable) return;
    setValidationError("");
    const people = responseStatus === "ACCEPTED" ? visibleDelegates : [];
    if (people.length > quota) { setValidationError(`Maksimal ${quota} peserta termasuk peserta utama.`); return; }
    const emails = people.map((person) => person.email.trim().toLowerCase());
    if (new Set(emails).size !== emails.length) { setValidationError("Setiap peserta harus memakai email pribadi yang berbeda."); return; }
    if (responseStatus === "ACCEPTED" && !consent) { setValidationError("Setujui data peserta sebelum mengirim."); return; }
    onSubmit({ responseStatus, isFinal: true, notes: notes.trim() || null,
      ...(invitationType === "institution" && !data.institution ? { institutionName: institutionName.trim() || null } : {}),
      delegates: people.map((person, index) => ({ fullName: person.fullName.trim(), email: person.email.trim().toLowerCase(),
        whatsapp: person.whatsapp.trim(), phone: person.phone.trim() || null, address: person.address.trim() || null, ...person.region, isLead: index === 0 })),
    });
  };

  return <form onSubmit={submit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-label="Formulir konfirmasi undangan">
    <div><h2 className="text-xl font-black">Konfirmasi undangan</h2><p className="mt-1 text-sm text-slate-600">Pilih kehadiran, lalu lengkapi data peserta.</p></div>
    {policyNotice && <p role="status" className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">{policyNotice}</p>}
    {data.institution && <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4" aria-label="Lembaga penerima">
      <Building2 className="h-6 w-6 shrink-0 text-emerald-700" /><div className="min-w-0"><p className="break-words font-black text-emerald-950">{data.institution.name}</p><p className="text-xs text-emerald-800">{data.institution.code} · Identitas lembaga sudah terhubung</p></div>
    </div>}
    {invitationType === "individual" && data.recipient && <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4" aria-label="Asatidz penerima">
      <UserRound className="h-6 w-6 shrink-0 text-emerald-700" /><div className="min-w-0"><p className="text-sm text-emerald-900">Ahlan wa sahlan,</p><p className="break-words font-black text-emerald-950">{data.recipient.fullName}</p><p className="mt-1 text-sm text-emerald-800">Undangan pribadi ini untuk Anda dan tidak dapat dialihkan.</p></div>
    </div>}
    {expired && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Batas respons telah berakhir. Hubungi panitia.</p>}
    <fieldset disabled={saving || expired || unavailable} className="min-w-0 space-y-5 disabled:opacity-70">
      <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="mb-2 text-sm font-bold">Kehadiran</legend>
        {(["ACCEPTED", "DECLINED"] as const).map((status) => <label key={status} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm font-bold ${responseStatus === status ? "border-emerald-600 bg-emerald-50 text-emerald-950" : "border-slate-200 text-slate-700"}`}>
          <input name="responseStatus" type="radio" value={status} checked={responseStatus === status} onChange={() => { setResponseStatus(status); setConsent(false); setValidationError(""); }} className="h-4 w-4 accent-emerald-700" />
          {status === "ACCEPTED" ? "Bersedia hadir" : "Berhalangan hadir"}
        </label>)}
      </fieldset>
      {responseStatus === "ACCEPTED" && <>
        {!data.institution && invitationType !== "individual" && <label className="block text-sm font-bold">Nama lembaga/komunitas <span className="font-normal text-slate-500">(opsional)</span><input value={institutionName} onChange={(event) => setInstitutionName(event.target.value)} maxLength={180} className={inputClass} /></label>}
        {allowsGroup && <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
          <input type="checkbox" checked={bringGroup} onChange={(event) => toggleGroup(event.target.checked)} aria-controls="invitation-delegates" className="h-5 w-5 shrink-0 accent-sky-700" />
          <Users className="h-5 w-5 shrink-0" /><span><strong className="block">Saya membawa rombongan</strong><span className="text-xs">Maksimal {quota} orang termasuk peserta utama</span></span>
        </label>}
        <section id="invitation-delegates" className="space-y-4" aria-label="Data peserta undangan">
          <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-black"><UserRound className="h-4 w-4 text-emerald-700" /> Data peserta {groupActive && <span className="rounded-full bg-sky-100 px-2 py-1 text-xs text-sky-900">{delegates.length}/{quota}</span>}</h3>
            {groupActive && <button type="button" disabled={delegates.length >= quota} onClick={() => {
              setDelegates((items) => [...items, newDelegate()]); setConsent(false);
            }} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-sky-300 px-3 text-sm font-bold text-sky-900 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" /> Tambah peserta</button>}
          </div>
          {visibleDelegates.map((person, index) => <fieldset key={index} className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4" data-delegate={index}>
            <legend className="px-2 text-sm font-black">{index === 0 ? groupActive ? "Peserta utama / kepala rombongan" : "Peserta utama" : `Peserta tambahan ${index}`}</legend>
            {index > 0 && <button type="button" onClick={() => { setDelegates((items) => items.filter((_, position) => position !== index)); setConsent(false); }} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-rose-700"><Trash2 className="h-4 w-4" /> Hapus peserta {index}</button>}
            <label className="block text-sm font-bold">Nama lengkap *<input name={`delegate-${index}-name`} value={person.fullName} onChange={(event) => update(index, { fullName: event.target.value })} readOnly={invitationType === "individual" && Boolean(data.recipient)} required minLength={2} maxLength={180} autoComplete={`section-delegate${index} name`} className={`${inputClass} read-only:bg-emerald-50`} /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-bold">Email pribadi *<input name={`delegate-${index}-email`} type="email" value={person.email} onChange={(event) => update(index, { email: event.target.value })} required autoComplete={`section-delegate${index} email`} className={inputClass} /></label>
              <label className="block text-sm font-bold">WhatsApp *<input name={`delegate-${index}-whatsapp`} type="tel" value={person.whatsapp} onChange={(event) => update(index, { whatsapp: event.target.value })} required minLength={9} autoComplete={`section-delegate${index} tel`} className={inputClass} /></label>
            </div>
            <RegionFields prefix={`invitation-${index}`} value={person.region} onChange={(region) => update(index, { region })} />
            <label className="block text-sm font-bold">Alamat domisili <span className="font-normal text-slate-500">(opsional)</span><textarea value={person.address} onChange={(event) => update(index, { address: event.target.value })} maxLength={500} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 p-3" /></label>
          </fieldset>)}
        </section>
      </>}
      <label className="block text-sm font-bold">Catatan untuk panitia <span className="font-normal text-slate-500">(opsional)</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 p-3" /></label>
      {responseStatus === "ACCEPTED" && <label className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-slate-700"><input name="consent" type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required className="mt-1 h-4 w-4 shrink-0 accent-emerald-700" /><span>{groupActive ? "Data peserta sudah benar dan telah mendapat persetujuan masing-masing. Kartu QR dan akses portal dibagikan secara pribadi." : "Data saya sudah benar dan saya menyetujui pendaftaran ini."}</span></label>}
    </fieldset>
    {(validationError || error) && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{validationError || error}</p>}
    <button type="submit" disabled={saving || expired || unavailable} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"><CheckCircle2 className="h-5 w-5" />{saving ? "Menyimpan…" : "Kirim konfirmasi"}</button>
    {responseStatus === "ACCEPTED" && <p className="text-sm text-slate-600">Bukti pendaftaran langsung tersedia. Peserta tetap menunggu persetujuan admin sebelum QR dapat digunakan untuk absensi.</p>}
  </form>;
};
