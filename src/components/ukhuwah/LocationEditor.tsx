import { useRef, useState } from "react";
import { emptyUkhuwahLocation, isUkhuwahRegion, locationTypeLabels, type UkhuwahLocation, type UkhuwahLocationInput, type UkhuwahPageResult } from "@/lib/ukhuwah";
import { UkhuwahMap } from "./UkhuwahMap";
import { RegionFields } from "./RegionFields";
import { api, button, card, field, Label, messageOf, Notice, primary, ResourceState, useDirtyGuard, useResource } from "./ui";

export function locationDraft(location: UkhuwahLocation): UkhuwahLocationInput {
  return { institutionId: location.institutionId, name: location.name, type: location.type, address: location.address, cityCode: location.cityCode, district: location.district, latitude: location.latitude, longitude: location.longitude, programs: location.programs, needs: location.needs, isPublished: location.isPublished, isVerified: location.isVerified, officialPhone: location.officialPhone ?? "", picName: location.picName ?? "", picPhone: location.picPhone ?? "", officialContactShared: location.officialContactShared ?? false, picContactShared: location.picContactShared ?? false, contactConsentConfirmed: location.contactConsentConfirmed ?? false, contactConsentSource: location.contactConsentSource ?? "" };
}
export function contactSharingValid(draft: UkhuwahLocationInput) { return !(draft.officialContactShared || draft.picContactShared) || (draft.contactConsentConfirmed && !!draft.contactConsentSource.trim()); }

export function LocationEditor({ location, onSaved, onClose }: { location?: UkhuwahLocation; onSaved: (location: UkhuwahLocation) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(location ? locationDraft(location) : emptyUkhuwahLocation());
  const [saved, setSaved] = useState(location);
  const [baseline, setBaseline] = useState(JSON.stringify(draft));
  const [busy, setBusy] = useState(false); const pending = useRef(false);
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [lookup, setLookup] = useState(""); const [search, setSearch] = useState("");
  const institutions = useResource<UkhuwahPageResult<{ id: string; name: string }>>(`/admin/ukhuwah/institutions?pageSize=20&search=${encodeURIComponent(search)}`);
  const dirty = JSON.stringify(draft) !== baseline; useDirtyGuard(dirty, busy);
  function edit(fields: Partial<UkhuwahLocationInput>) {
    setDraft(d => {
      const changedContact = (["officialPhone", "picName", "picPhone"] as const).some(key => fields[key] !== undefined && fields[key] !== d[key]);
      return { ...d, ...fields, ...(changedContact ? { contactConsentConfirmed: false, officialContactShared: false, picContactShared: false, contactConsentSource: "" } : {}) };
    }); setError(""); setMessage("");
  }
  async function save() {
    if (pending.current) return;
    if (!draft.name.trim() || !draft.address.trim() || !isUkhuwahRegion(draft.cityCode, draft.district)) { setError("Lengkapi nama, alamat, dan wilayah cakupan yang valid."); return; }
    if (!contactSharingValid(draft)) { setError("Berbagi kontak memerlukan persetujuan terkonfirmasi dan sumber/bukti izin."); return; }
    if ((draft.latitude === null) !== (draft.longitude === null)) { setError("Isi kedua koordinat atau kosongkan keduanya."); return; }
    pending.current = true; setBusy(true); setError("");
    try {
      const result = await api<UkhuwahLocation>(`/admin/ukhuwah/locations${saved ? `/${saved.id}` : ""}`, { method: saved ? "PATCH" : "POST", body: JSON.stringify({ ...draft, ...(saved ? { expectedVersion: saved.version } : {}) }) });
      setSaved(result); setDraft(locationDraft(result)); setBaseline(JSON.stringify(locationDraft(result))); setMessage("Lokasi dan cakupan kontak tersimpan."); onSaved(result);
    } catch (e) { setError(`${messageOf(e)} Perubahan tetap ada; buka ulang detail jika revisi usang.`); }
    finally { pending.current = false; setBusy(false); }
  }
  function close() { if (!busy && (!dirty || window.confirm("Buang perubahan lokasi yang belum disimpan?"))) onClose(); }
  const text = (key: "name" | "officialPhone" | "picName" | "picPhone" | "contactConsentSource", name: string, max = 200) => <Label name={name}><input id={`location-${key}`} className={field} maxLength={max} value={draft[key]} onChange={e => edit({ [key]: e.target.value })} /></Label>;
  const area = (key: "address" | "programs" | "needs", name: string) => <Label name={name}><textarea id={`location-${key}`} className={field} rows={3} maxLength={2000} value={draft[key]} onChange={e => edit({ [key]: e.target.value })} /></Label>;
  const check = (key: "isPublished" | "isVerified" | "officialContactShared" | "picContactShared" | "contactConsentConfirmed", name: string, disabled = false) => <label className="flex items-start gap-2 text-sm"><input id={`location-${key}`} type="checkbox" disabled={disabled} checked={draft[key]} onChange={e => { if (key === "contactConsentConfirmed" && !e.target.checked) edit({ contactConsentConfirmed: false, officialContactShared: false, picContactShared: false }); else edit({ [key]: e.target.checked }); }} />{name}</label>;
  const mapLocations: UkhuwahLocation[] = [{ ...draft, id: saved?.id ?? "new-pin", version: saved?.version ?? 0, createdAt: saved?.createdAt ?? "", updatedAt: saved?.updatedAt ?? "" }];
  return <section className={`${card} space-y-5`} aria-label="Editor lokasi lembaga">
    <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">{saved ? "Edit lokasi lembaga" : "Lokasi lembaga baru"}</h2><button className={button} disabled={busy} onClick={close}>Tutup editor</button></div>
    {error && <Notice error>{error}</Notice>}{message && <Notice>{message}</Notice>}
    <fieldset disabled={busy} className="space-y-4"><legend className="sr-only">Data lokasi</legend>
      {text("name", "Nama lokasi")}
      <Label name="Jenis lokasi"><select className={field} value={draft.type} onChange={e => edit({ type: e.target.value as UkhuwahLocationInput["type"] })}>{Object.entries(locationTypeLabels).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></Label>
      <div className="rounded-lg border p-4 space-y-3"><h3 className="font-semibold">Afiliasi lembaga existing (opsional)</h3><p className="text-sm text-slate-600">Afiliasi tidak memberikan izin berbagi kontak otomatis.</p><div className="flex gap-2"><input aria-label="Cari lembaga existing" className={field} value={lookup} maxLength={120} onChange={e => setLookup(e.target.value)} /><button className={button} onClick={() => setSearch(lookup)}>Cari lembaga</button></div><ResourceState resource={institutions} /><Label name="Lembaga terafiliasi"><select className={field} value={draft.institutionId ?? ""} onChange={e => edit({ institutionId: e.target.value || null })}><option value="">Tidak terafiliasi</option>{draft.institutionId && !institutions.data?.data.some(i => i.id === draft.institutionId) && <option value={draft.institutionId}>Afiliasi tersimpan</option>}{institutions.data?.data.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></Label></div>
      <RegionFields cityCode={draft.cityCode} district={draft.district} onChange={edit} />{area("address", "Alamat")}
      <div className="grid gap-4 sm:grid-cols-2">{(["latitude", "longitude"] as const).map(key => <Label key={key} name={key === "latitude" ? "Lintang" : "Bujur"}><input id={`location-${key}`} className={field} type="number" step="any" min={key === "latitude" ? -7.5 : 106.9} max={key === "latitude" ? -6.3 : 108.3} value={draft[key] ?? ""} onChange={e => edit({ [key]: e.target.value === "" ? null : Number(e.target.value) })} /></Label>)}</div>
      <p className="text-sm text-slate-600">Koordinat boleh kosong. Aktifkan peta dengan persetujuan lalu pilih pin; koordinat bukan verifikasi alamat.</p>
      <UkhuwahMap locations={mapLocations} selectedId={mapLocations[0].id} onSelect={() => {}} onPick={(latitude, longitude) => edit({ latitude, longitude })} />
      {area("programs", "Program/kegiatan")}{area("needs", "Kebutuhan agregat")}
      {check("isVerified", "Data lokasi telah diverifikasi oleh pengelola")}{check("isPublished", "Bagikan lokasi ke anggota (kontak mengikuti izin terpisah)")}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-4"><h3 className="font-bold">Kontak dan izin berbagi</h3>{text("officialPhone", "Nomor resmi lembaga", 30)}{text("picName", "Nama PIC", 200)}{text("picPhone", "Nomor pribadi PIC", 30)}{text("contactConsentSource", "Sumber/bukti persetujuan kontak", 1000)}{check("contactConsentConfirmed", "Saya telah mengonfirmasi izin pemilik kontak untuk cakupan yang dipilih")}{check("officialContactShared", "Bagikan nomor resmi ke anggota", !draft.contactConsentConfirmed || !draft.contactConsentSource.trim())}{check("picContactShared", "Bagikan nama dan nomor PIC ke anggota", !draft.contactConsentConfirmed || !draft.contactConsentSource.trim())}<p className="text-xs leading-5">Tanpa izin kontak tetap hanya untuk pengelola. Menonaktifkan persetujuan mencabut kedua cakupan berbagi.</p>{saved?.contactConfirmedAt && <p className="text-xs">Konfirmasi tercatat: {saved.contactConfirmedAt}</p>}</div>
      <button className={primary} disabled={!dirty && !!saved} onClick={save}>Simpan lokasi</button>
    </fieldset>{saved && <p className="text-xs text-slate-600">Revisi lokasi: {saved.version}</p>}
  </section>;
}