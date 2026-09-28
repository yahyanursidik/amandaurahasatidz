import React, { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { RegionFields, type RegionValue } from "@/components/public/RegionFields";
import { ENV } from "@/config/env";

type Delegate = { fullName: string; email: string; whatsapp: string; phone: string; address: string; region: RegionValue; isLead: boolean };
type InvitationData = {
  invitation: { invitationNumber: string; quota?: number | null; responseDeadline?: string | null; status: string };
  event: { name: string; startDate: string; endDate: string; venueName?: string | null };
  institution?: { name: string; code: string } | null;
};
type Submission = {
  message: string;
  participants?: Array<{ id: string; participantCode: string }>;
  portalAccounts?: Array<{ participantId: string; participantName: string; email: string; temporaryPassword?: string | null; loginUrl: string; setupError?: string }>;
};
const emptyRegion = (): RegionValue => ({ city: "", province: "", cityCode: "", provinceCode: "" });
const newDelegate = (): Delegate => ({ fullName: "", email: "", whatsapp: "", phone: "", address: "", region: emptyRegion(), isLead: true });

export const InvitationRegistrationPage: React.FC = () => {
  const { token = "" } = useParams<{ token: string }>();
  const invitationType = useLocation().pathname.includes("/individual/") ? "individual" : "institution";
  const [data, setData] = useState<InvitationData | null>(null);
  const [delegates, setDelegates] = useState<Delegate[]>([newDelegate()]);
  const [institutionName, setInstitutionName] = useState("");
  const [responseStatus, setResponseStatus] = useState<"ACCEPTED" | "DECLINED">("ACCEPTED");
  const [notes, setNotes] = useState("");
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const quota = invitationType === "individual" ? 1 : Math.max(1, data?.invitation.quota || 1);
  const expired = Boolean(data?.invitation.responseDeadline && new Date(data.invitation.responseDeadline) < new Date());

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setSubmission(null); setDelegates([newDelegate()]);
    void fetch(`${ENV.API_BASE_URL}/invitations/public/${invitationType}/${encodeURIComponent(token)}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message || "Undangan tidak dapat dibuka. Minta tautan baru dari panitia.");
        if (!controller.signal.aborted) { setData(result.data); setInstitutionName(result.data.institution?.name || ""); }
      })
      .catch((reason) => { if (!controller.signal.aborted) { setData(null); setError(reason instanceof Error ? reason.message : "Undangan tidak dapat dibuka."); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, invitationType]);

  const update = (index: number, changes: Partial<Delegate>) => setDelegates((items) =>
    items.map((item, current) => current === index ? { ...item, ...changes } : item));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (responseStatus === "ACCEPTED") {
      if (delegates.length > quota) { setError(`Maksimal ${quota} peserta termasuk kepala rombongan.`); return; }
      const emails = delegates.map((item) => item.email.trim().toLowerCase());
      if (new Set(emails).size !== emails.length) { setError("Setiap peserta harus menggunakan email pribadi yang berbeda."); return; }
    }
    setSaving(true);
    try {
      const payload = { responseStatus, institutionName: institutionName.trim() || null, notes: notes.trim() || null,
        isFinal: true, delegates: responseStatus === "ACCEPTED" ? delegates.map((item, index) => ({
          fullName: item.fullName.trim(), email: item.email.trim(), whatsapp: item.whatsapp.trim(), phone: item.phone.trim() || null,
          address: item.address.trim() || null, ...item.region, isLead: index === 0,
        })) : [] };
      const response = await fetch(`${ENV.API_BASE_URL}/invitations/public/${invitationType}/${encodeURIComponent(token)}/response`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Konfirmasi undangan gagal disimpan.");
      setSubmission(result.data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Konfirmasi gagal diproses."); }
    finally { setSaving(false); }
  };

  return <PublicLayout>
    <div className="mx-auto max-w-3xl space-y-5 py-4 text-slate-900">
      <Link to="/programs" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-emerald-800"><ArrowLeft className="h-4 w-4" /> Daftar program</Link>
      {loading ? <p role="status" className="rounded-xl bg-white p-8 text-sm">Memuat formulir undangan…</p> : !data ?
        <section role="alert" className="rounded-xl border border-rose-200 bg-white p-6"><h1 className="text-xl font-black">Undangan tidak tersedia</h1><p className="mt-2 text-sm">{error}</p></section> : <>
          <header className="rounded-2xl bg-emerald-950 p-6 text-white sm:p-8">
            <p className="text-xs font-black uppercase tracking-widest text-emerald-300">Formulir undangan pribadi · {data.invitation.invitationNumber}</p>
            <h1 className="mt-3 text-2xl font-black">{data.event.name}</h1>
            <p className="mt-3 text-sm text-emerald-100">{data.event.venueName || "Lokasi menyusul"} · {data.event.startDate === data.event.endDate ? data.event.startDate : `${data.event.startDate} – ${data.event.endDate}`}</p>
            {data.institution && <p className="mt-2 text-sm text-emerald-100">Diperuntukkan bagi {data.institution.name}</p>}
          </header>
          {submission ? <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-6" aria-live="polite"><CheckCircle2 className="h-8 w-8 text-emerald-700" /><h2 className="mt-3 text-xl font-black">Jawaban undangan tersimpan</h2><p className="mt-2 text-sm">{submission.message}</p>
            {submission.participants?.map((item) => <p key={item.id} className="mt-2 rounded-lg bg-white p-3 text-sm">Kode peserta: <strong>{item.participantCode}</strong></p>)}
            {submission.portalAccounts?.map((account) => <div key={account.participantId} className="mt-2 rounded-lg bg-white p-3 text-sm"><strong>{account.participantName}</strong><p>{account.email} · {account.setupError || (account.temporaryPassword ? `Password sementara: ${account.temporaryPassword}` : "Gunakan password akun yang sudah ada atau aktivasi melalui portal.")}</p></div>)}
            <Link to="/login/ustadz" className="mt-4 inline-flex min-h-11 items-center font-bold text-emerald-800 underline">Buka Portal Asatidz</Link>
          </section> : <form onSubmit={(event) => void submit(event)} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-7">
            <div><h2 className="text-xl font-black">Konfirmasi undangan</h2><p className="mt-1 text-sm text-slate-600">Isi data diri atau rombongan sekali saja. Tautan undangan ini sudah menjadi akses formulir; tidak diperlukan kode verifikasi tambahan.</p></div>
            {expired && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Batas respons undangan telah berakhir. Hubungi panitia.</p>}
            <fieldset className="flex flex-wrap gap-4"><legend className="mb-2 text-sm font-bold">Status undangan</legend><label className="flex items-center gap-2 text-sm"><input type="radio" checked={responseStatus === "ACCEPTED"} onChange={() => setResponseStatus("ACCEPTED")} /> Saya akan hadir</label><label className="flex items-center gap-2 text-sm"><input type="radio" checked={responseStatus === "DECLINED"} onChange={() => setResponseStatus("DECLINED")} /> Berhalangan hadir</label></fieldset>
            {responseStatus === "ACCEPTED" && <>
              <label className="block text-sm font-bold">Nama lembaga/komunitas <span className="font-normal">(jika ada)</span><input value={institutionName} onChange={(change) => setInstitutionName(change.target.value)} readOnly={Boolean(data.institution)} maxLength={180} placeholder="Nama lembaga atau komunitas" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 read-only:bg-slate-50" /></label>
              <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-black">Data peserta</h3><p className="text-sm text-slate-600">{delegates.length} dari {quota} peserta, termasuk kepala rombongan. {quota > 1 ? `Maksimal ${quota - 1} anggota tambahan.` : ""}</p></div>{quota > 1 && <button type="button" onClick={() => setDelegates((items) => [...items, { ...newDelegate(), isLead: false }])} disabled={delegates.length >= quota} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-emerald-600 px-3 text-sm font-bold text-emerald-800 disabled:opacity-50"><Plus className="h-4 w-4" /> Tambah anggota</button>}</div>
              {delegates.map((item, index) => <fieldset key={index} className="space-y-3 rounded-xl border border-slate-200 p-4"><legend className="px-2 font-bold">{index === 0 ? "Kepala rombongan / peserta utama" : `Anggota ${index + 1}`}</legend>{index > 0 && <button type="button" onClick={() => setDelegates((items) => items.filter((_, position) => position !== index))} className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-rose-700"><Trash2 className="h-4 w-4" /> Hapus anggota</button>}
                <label className="block text-sm font-bold">Nama lengkap *<input value={item.fullName} onChange={(change) => update(index, { fullName: change.target.value })} required minLength={2} autoComplete="name" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label>
                <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-bold">Email pribadi *<input type="email" value={item.email} onChange={(change) => update(index, { email: change.target.value })} required autoComplete="email" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label><label className="block text-sm font-bold">WhatsApp *<input type="tel" value={item.whatsapp} onChange={(change) => update(index, { whatsapp: change.target.value })} required minLength={9} autoComplete="tel" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label></div>
                <RegionFields prefix={`invitation-${index}`} value={item.region} onChange={(next) => update(index, { region: next })} />
                <label className="block text-sm font-bold">Alamat domisili <span className="font-normal">(opsional)</span><textarea value={item.address} onChange={(change) => update(index, { address: change.target.value })} maxLength={500} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 p-3" /></label>
              </fieldset>)}
            </>}
            <label className="block text-sm font-bold">Catatan kepada panitia <span className="font-normal">(opsional)</span><textarea value={notes} onChange={(change) => setNotes(change.target.value)} maxLength={1000} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 p-3" /></label>
            {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            <button type="submit" disabled={saving || expired} className="min-h-12 rounded-lg bg-emerald-700 px-6 font-black text-white disabled:opacity-50">{saving ? "Menyimpan…" : "Kirim konfirmasi undangan"}</button>
          </form>}
        </>}
    </div>
  </PublicLayout>;
};
