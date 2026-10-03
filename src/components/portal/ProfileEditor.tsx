import React, { useEffect, useReducer, useRef } from "react";
import { Loader2, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { RegionFields } from "@/components/public/RegionFields";
import { eventApi } from "@/lib/eventApi";
import { findIndonesianRegency } from "@/lib/indonesiaRegionData";
import { registerProfilePopHandler } from "@/lib/portalNavigationGuard";

export type PortalProfile = {
  id: string;
  fullName: string;
  loginEmail?: string | null;
  email?: string | null;
  titlePrefix?: string | null;
  titleSuffix?: string | null;
  birthPlace?: string | null;
  birthDate?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  cityCode?: string | null;
  provinceCode?: string | null;
  educationSummary?: string | null;
  expertiseSummary?: string | null;
  profileStatus: string;
  primaryInstitution?: { institutionName: string; institutionCode: string; position?: string | null } | null;
};

const editableKeys = ["fullName", "email", "titlePrefix", "titleSuffix", "birthPlace", "birthDate", "phone", "whatsapp", "address", "educationSummary", "expertiseSummary"] as const;
export type ProfileDraft = Record<typeof editableKeys[number] | "city" | "province" | "cityCode" | "provinceCode", string>;
export function profileDraft(profile: PortalProfile): ProfileDraft {
  const fields = Object.fromEntries(editableKeys.map((key) => [key, profile[key] || ""])) as ProfileDraft;
  fields.birthDate = fields.birthDate.slice(0, 10);
  const region = findIndonesianRegency(profile.cityCode || "");
  return { ...fields, city: region?.city || "", province: region?.province || "", cityCode: region?.id || "", provinceCode: region?.provinceId || "" };
}

export type ProfileEditorState = { fields: ProfileDraft; baseline: ProfileDraft; status: "idle" | "saving" | "success" | "error"; message: string };
export function createProfileEditor(profile: PortalProfile): ProfileEditorState {
  const fields = profileDraft(profile);
  return { fields, baseline: fields, status: "idle", message: "" };
}
export const isProfileDirty = (state: ProfileEditorState) => JSON.stringify(state.fields) !== JSON.stringify(state.baseline);
type Action = { type: "edit"; fields: Partial<ProfileDraft> } | { type: "reset" } | { type: "saving" } | { type: "error"; message: string } | { type: "saved"; profile: PortalProfile; preview: boolean };
export function profileEditorReducer(state: ProfileEditorState, action: Action): ProfileEditorState {
  if (action.type === "saved") return { ...createProfileEditor(action.profile), status: "success", message: action.preview ? "Perubahan hanya tersimpan dalam pratinjau lokal; tidak dikirim ke server." : "Perubahan profil tersimpan. Email login tidak berubah." };
  if (state.status === "saving" && (action.type === "edit" || action.type === "reset")) return state;
  if (action.type === "edit") return { ...state, fields: { ...state.fields, ...action.fields }, status: "idle", message: "" };
  if (action.type === "reset") return { ...state, fields: state.baseline, status: "idle", message: "" };
  if (action.type === "saving") return { ...state, status: "saving", message: "Menyimpan profil…" };
  if (action.type === "error") return { ...state, status: "error", message: action.message };
  return state;
}

export function profilePatch(state: ProfileEditorState, today = new Date().toISOString().slice(0, 10)) {
  const fields = state.fields;
  if (fields.fullName.trim().length < 2) throw new Error("Nama lengkap minimal 2 karakter.");
  if (fields.fullName.trim().length > 160) throw new Error("Nama lengkap maksimal 160 karakter.");
  if (fields.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) throw new Error("Email kontak tidak valid.");
  if (fields.birthDate && (!/^\d{4}-\d{2}-\d{2}$/.test(fields.birthDate) || fields.birthDate < "1900-01-01" || Number.isNaN(Date.parse(fields.birthDate)) || new Date(fields.birthDate).toISOString().slice(0, 10) !== fields.birthDate || fields.birthDate > today)) throw new Error("Tanggal lahir tidak valid atau berada di masa depan.");
  for (const key of ["phone", "whatsapp"] as const) {
    const phone = fields[key].trim();
    if (phone && (!/^[+\d\s().-]+$/.test(phone) || phone.replace(/\D/g, "").length < 8 || phone.replace(/\D/g, "").length > 15)) throw new Error(`${key === "whatsapp" ? "Nomor WhatsApp" : "Nomor telepon"} tidak valid. Gunakan 8–15 digit angka.`);
  }
  const payload: Partial<ProfileDraft> = Object.fromEntries(editableKeys.map((key) => [key, fields[key].trim()]));
  const region = findIndonesianRegency(fields.cityCode);
  if (fields.city || fields.province || fields.cityCode || fields.provinceCode) {
    if (!region || region.city !== fields.city || region.province !== fields.province || region.provinceId !== fields.provinceCode) throw new Error("Pilih kabupaten/kota dari daftar saran agar provinsi terisi otomatis.");
    Object.assign(payload, { city: region.city, province: region.province, cityCode: region.id, provinceCode: region.provinceId });
  } else if (state.baseline.cityCode) Object.assign(payload, { city: "", province: "", cityCode: "", provinceCode: "" });
  return payload;
}

export function canLeaveProfile(state: ProfileEditorState, confirm: (message: string) => boolean) {
  return state.status !== "saving" && (!isProfileDirty(state) || confirm("Perubahan profil belum disimpan. Tinggalkan halaman dan buang perubahan?"));
}

export const ProfileEditor: React.FC<{
  profile: PortalProfile;
  preview?: boolean;
  onSaved: (profile: PortalProfile) => void;
  onNavigationStateChange?: (state: { dirty: boolean; saving: boolean }) => void;
}> = ({ profile, preview = false, onSaved, onNavigationStateChange }) => {
  const [state, dispatch] = useReducer(profileEditorReducer, profile, createProfileEditor);
  const liveState = useRef(state);
  liveState.current = state;
  const pending = useRef(false);
  const dirty = isProfileDirty(state);
  const saving = state.status === "saving";
  useEffect(() => {
    onNavigationStateChange?.({ dirty, saving });
    return () => onNavigationStateChange?.({ dirty: false, saving: false });
  }, [dirty, saving, onNavigationStateChange]);
  useEffect(() => {
    let historyIndex = window.history.state?.idx as number | undefined;
    let restoringHistory = false;
    // BrowserRouter can notify React before completing pushState. Read the committed
    // entry after the navigation stack unwinds, rather than capturing the prior index.
    let active = true;
    queueMicrotask(() => { if (active) historyIndex = window.history.state?.idx; });
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (isProfileDirty(liveState.current) || pending.current) { event.preventDefault(); event.returnValue = ""; }
    };
    const onLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const logout = (event.target as Element).closest?.("button");
      if (logout?.textContent?.trim() === "Keluar") {
        if (pending.current || !canLeaveProfile(liveState.current, window.confirm)) { event.preventDefault(); event.stopPropagation(); }
        return;
      }
      const link = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download") || link.href === window.location.href) return;
      if (pending.current || !canLeaveProfile(liveState.current, window.confirm)) { event.preventDefault(); event.stopPropagation(); }
    };
    // BrowserRouter's history indices let us cancel Back/Forward before its popstate listener
    // unmounts the editor. Full-document departures are handled by beforeunload instead.
    const onPopState = (event: PopStateEvent) => {
      const nextIndex = event.state?.idx as number | undefined;
      if (restoringHistory) { restoringHistory = false; event.stopImmediatePropagation(); return; }
      if (pending.current || !canLeaveProfile(liveState.current, window.confirm)) {
        if (typeof historyIndex === "number" && typeof nextIndex === "number" && historyIndex !== nextIndex) {
          event.stopImmediatePropagation();
          restoringHistory = true;
          window.history.go(historyIndex - nextIndex);
        }
        return;
      }
      historyIndex = nextIndex;
    };
    window.addEventListener("beforeunload", beforeUnload);
    const unregisterPop = registerProfilePopHandler(onPopState);
    document.addEventListener("click", onLink, true);
    return () => { active = false; unregisterPop(); window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", onLink, true); };
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending.current || !dirty) return;
    let payload: Partial<ProfileDraft>;
    try { payload = profilePatch(state); }
    catch (error) { dispatch({ type: "error", message: error instanceof Error ? error.message : "Periksa kembali data profil." }); return; }
    pending.current = true;
    dispatch({ type: "saving" });
    try {
      const response = preview ? { ...profile, ...payload } : await eventApi<PortalProfile>("/portal/profile", { method: "PATCH", body: JSON.stringify(payload) });
      const updated = { ...profile, ...response, loginEmail: response.loginEmail ?? profile.loginEmail };
      dispatch({ type: "saved", profile: updated, preview });
      onSaved(updated);
    } catch (error) {
      dispatch({ type: "error", message: error instanceof Error ? error.message : "Profil gagal disimpan. Periksa koneksi dan coba lagi." });
    } finally { pending.current = false; }
  };
  const inputClass = "mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus-visible:outline-emerald-700 disabled:bg-slate-100 disabled:opacity-70";
  const field = (key: typeof editableKeys[number], label: string, type = "text", required = false, maxLength = 255) => <div>
    <label htmlFor={`profile-${key}`} className="block text-sm font-bold text-slate-700">{label}{required ? " *" : ""}</label>
    <input id={`profile-${key}`} type={type} required={required} maxLength={maxLength} minLength={key === "fullName" ? 2 : undefined} min={type === "date" ? "1900-01-01" : undefined} max={type === "date" ? new Date().toISOString().slice(0, 10) : undefined}
      autoComplete={key === "fullName" ? "name" : key === "email" ? "email" : type === "tel" ? "tel" : undefined}
      aria-describedby={key === "email" ? "profile-contact-help" : undefined} value={state.fields[key]} onChange={(event) => dispatch({ type: "edit", fields: { [key]: event.target.value } })} className={inputClass} />
    {key === "email" && <p id="profile-contact-help" className="mt-1 text-xs leading-5 text-slate-600">Untuk kontak dan notifikasi panitia, bukan untuk mengganti email login akun.</p>}
  </div>;
  const textarea = (key: "address" | "educationSummary" | "expertiseSummary", label: string) => <div>
    <label htmlFor={`profile-${key}`} className="block text-sm font-bold text-slate-700">{label}</label>
    <textarea id={`profile-${key}`} rows={3} maxLength={key === "address" ? 500 : 2000} value={state.fields[key]} onChange={(event) => dispatch({ type: "edit", fields: { [key]: event.target.value } })} className={`${inputClass} resize-y py-3`} />
  </div>;

  return <form onSubmit={save} aria-label="Edit profil peserta" aria-busy={saving} className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
    <div className="min-w-0 border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-black text-slate-950">Edit profil peserta</h2>
      <p className="mt-1 text-sm text-slate-600">Lengkapi identitas, kontak, dan domisili Anda. Tanda * wajib diisi.</p>
      {preview && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Mode pratinjau: perubahan hanya berlaku lokal, tidak disimpan ke server.</p>}
      <fieldset disabled={saving} className="mt-5 min-w-0 space-y-5">
        <legend className="sr-only">Data profil yang dapat diedit</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("fullName", "Nama lengkap", "text", true, 160)}
          {field("email", "Email kontak (bukan email login)", "email", false, 254)}
          {field("titlePrefix", "Gelar depan", "text", false, 80)}
          {field("titleSuffix", "Gelar belakang", "text", false, 120)}
          {field("birthPlace", "Tempat lahir", "text", false, 120)}
          {field("birthDate", "Tanggal lahir", "date")}
          {field("phone", "Nomor telepon", "tel", false, 30)}
          {field("whatsapp", "Nomor WhatsApp", "tel", false, 30)}
        </div>
        <section aria-labelledby="profile-domicile-title" className="space-y-3 border-t border-slate-200 pt-4">
          <h3 id="profile-domicile-title" className="font-bold">Domisili</h3>
          {!state.baseline.cityCode && (profile.city || profile.province) && <p className="text-xs text-slate-600">Domisili tersimpan sebelumnya: {profile.city}, {profile.province}. Tetap dipertahankan jika Anda tidak memilih wilayah baru.</p>}
          <RegionFields prefix="profile" value={state.fields} onChange={(region) => dispatch({ type: "edit", fields: region })} requireSelection readOnlyProvince disabled={saving} required={false} />
          <p className="text-xs text-slate-600">Pilih kabupaten/kota dari saran. Provinsi mengikuti wilayah terpilih secara otomatis.</p>
          {state.fields.cityCode && <p className="text-xs text-slate-500">Kode kabupaten/kota: {state.fields.cityCode} · Kode provinsi: {state.fields.provinceCode}</p>}
          {textarea("address", "Alamat lengkap domisili")}
        </section>
        <div className="grid gap-4 sm:grid-cols-2">{textarea("educationSummary", "Ringkasan pendidikan")}{textarea("expertiseSummary", "Keahlian dan aktivitas dakwah")}</div>
      </fieldset>
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
        <p role={state.status === "error" ? "alert" : "status"} aria-live="polite" className={`w-full text-sm ${state.status === "error" ? "text-rose-700" : state.status === "success" ? "text-emerald-800" : "text-slate-600"}`}>
          {state.message || (dirty ? "Ada perubahan yang belum disimpan." : "Belum ada perubahan.")}
        </p>
        <button type="submit" disabled={saving || !dirty} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-800 px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Save aria-hidden="true" className="h-4 w-4" />}{saving ? "Menyimpan…" : "Simpan profil"}
        </button>
        <button type="button" disabled={saving || !dirty} onClick={() => { if (window.confirm("Buang perubahan profil yang belum disimpan?")) dispatch({ type: "reset" }); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"><RotateCcw aria-hidden="true" className="h-4 w-4" />Batalkan perubahan</button>
      </div>
    </div>
    <aside className="min-w-0 space-y-4">
      <section className="border-t-4 border-emerald-800 bg-slate-950 p-5 text-white">
        <ShieldCheck aria-hidden="true" className="h-6 w-6 text-emerald-300" />
        <h2 className="mt-4 font-black">Akun login & data yang dikunci</h2>
        <label htmlFor="profile-loginEmail" className="mt-4 block text-sm font-bold">Email login akun (tidak berubah)</label>
        <input id="profile-loginEmail" value={profile.loginEmail || "Tidak tersedia"} readOnly className="mt-2 min-h-11 w-full min-w-0 rounded-lg bg-slate-800 px-3 text-sm text-white" />
        <p className="mt-2 text-xs leading-5 text-slate-300">Mengubah email kontak tidak mengubah email atau kredensial login. Jika email login tidak tersedia, email kontak tidak digunakan sebagai penggantinya.</p>
        <dl className="mt-5 space-y-3 text-sm"><div><dt className="text-slate-400">Status profil</dt><dd className="mt-1 font-bold">{profile.profileStatus}</dd></div><div><dt className="text-slate-400">Lembaga utama</dt><dd className="mt-1 break-words font-bold">{profile.primaryInstitution?.institutionName || "Belum terhubung"}</dd></div></dl>
        <p className="mt-4 text-xs leading-5 text-slate-300">Status verifikasi, persetujuan, dan afiliasi lembaga hanya dapat diubah oleh admin/panitia.</p>
      </section>
    </aside>
  </form>;
};