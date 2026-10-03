import { useRef, useState } from "react";
import { UKHUWAH_REPORT_TEMPLATES, categoryLabels, emptyUkhuwahReport, isUkhuwahRegion, unresolvedUkhuwahFields, type UkhuwahReport, type UkhuwahReportInput, type UkhuwahLocation, type UkhuwahPageResult } from "@/lib/ukhuwah";
import { api, button, card, field, Label, messageOf, Notice, primary, ResourceState, TextBody, useDirtyGuard, useResource } from "./ui";
import { RegionFields } from "./RegionFields";

export function reportDraft(report: UkhuwahReportInput): UkhuwahReportInput {
  return { title: report.title, body: report.body, category: report.category, cityCode: report.cityCode, district: report.district, locationId: report.locationId, observedAt: report.observedAt.slice(0, 10), source: report.source ?? "", urgency: report.urgency, audience: report.category === "SENSITIVE" ? "ADMIN_ONLY" : report.audience, hideAuthor: report.hideAuthor };
}
export function reportSubmissionError(draft: UkhuwahReportInput) {
  if (draft.title.trim().length < 3 || draft.body.trim().length < 10 || !draft.source.trim() || !draft.observedAt) return "Lengkapi judul minimal 3 karakter, isi minimal 10 karakter, tanggal pengamatan, dan sumber.";
  if (draft.observedAt > new Date().toISOString().slice(0, 10)) return "Tanggal pengamatan tidak boleh di masa depan.";
  if (!isUkhuwahRegion(draft.cityCode, draft.district)) return "Pilih wilayah cakupan yang valid, termasuk kecamatan Sumedang.";
  if (unresolvedUkhuwahFields(`${draft.title}\n${draft.body}\n${draft.source}`)) return "Ganti seluruh placeholder [ISI: …] atau {{variabel}} sebelum mengajukan.";
  return "";
}
export function canSubmitRevision(saved: UkhuwahReport | null, dirty: boolean, reviewedVersion: number | null) { return !!saved && !dirty && saved.version === reviewedVersion && ["DRAFT", "REJECTED"].includes(saved.publicationStatus); }

export function ReportEditor({ prefix, report, duplicate, onSaved }: { prefix: string; report?: UkhuwahReport; duplicate?: boolean; onSaved?: (report: UkhuwahReport) => void }) {
  const initial = report ? reportDraft(report) : emptyUkhuwahReport();
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState<UkhuwahReport | null>(duplicate ? null : report ?? null);
  const [baseline, setBaseline] = useState(JSON.stringify(duplicate ? emptyUkhuwahReport() : initial));
  const [reviewed, setReviewed] = useState<number | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false); const pending = useRef(false);
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const dirty = JSON.stringify(draft) !== baseline;
  useDirtyGuard(dirty, busy);
  const locations = useResource<UkhuwahPageResult<UkhuwahLocation>>(`${prefix}/locations?pageSize=100&cityCode=${draft.cityCode}`);
  function edit(fields: Partial<UkhuwahReportInput>) {
    setDraft(current => { const next = { ...current, ...fields }; if (next.category === "SENSITIVE") next.audience = "ADMIN_ONLY"; return next; });
    setReviewed(null); setPreview(false); setError(""); setMessage("");
  }
  async function save() {
    if (pending.current) return;
    if (draft.title.trim().length < 3) { setError("Judul minimal 3 karakter diperlukan untuk menyimpan draf."); return; }
    pending.current = true; setBusy(true); setError(""); setMessage(""); setReviewed(null);
    try {
      const result = await api<UkhuwahReport>(`${prefix}/reports${saved ? `/${saved.id}` : ""}`, { method: saved ? "PATCH" : "POST", body: JSON.stringify({ ...reportDraft(draft), ...(saved ? { expectedVersion: saved.version } : {}) }) });
      setSaved(result); setDraft(reportDraft(result)); setBaseline(JSON.stringify(reportDraft(result))); setPreview(false);
      setMessage("Draf tersimpan. Pratinjau revisi tersimpan sebelum mengajukan."); onSaved?.(result);
    } catch (e) { setError(`${messageOf(e)} Perubahan tetap ada. Jika versi telah berubah, buka ulang detail sebelum mencoba lagi.`); }
    finally { pending.current = false; setBusy(false); }
  }
  async function submit() {
    if (pending.current || !canSubmitRevision(saved, dirty, reviewed)) return;
    const invalid = reportSubmissionError(draft); if (invalid) { setError(invalid); return; }
    pending.current = true; setBusy(true); setError("");
    try {
      const result = await api<UkhuwahReport>(`${prefix}/reports/${saved!.id}/submit`, { method: "POST", body: JSON.stringify({ expectedVersion: saved!.version, reviewed: true }) });
      setSaved(result); setBaseline(JSON.stringify(reportDraft(result))); setDraft(reportDraft(result)); setReviewed(null); setPreview(false);
      setMessage("Laporan diajukan. Menunggu moderasi, belum dipublikasikan ke papan bersama."); onSaved?.(result);
    } catch (e) { setReviewed(null); setError(messageOf(e)); }
    finally { pending.current = false; setBusy(false); }
  }
  const locked = saved?.publicationStatus === "PENDING";
  return <section className={`${card} space-y-5`} aria-label="Editor laporan">
    <h2 className="text-xl font-bold">{duplicate ? "Duplikat sebagai draf baru" : saved ? "Edit laporan saya" : "Laporan baru"}</h2>
    <p className="text-sm text-slate-600">Tulis pengamatan faktual dan batas informasinya. Jangan cantumkan identitas anak, tuduhan, atau kontak pribadi tanpa izin. Bukan layanan darurat.</p>
    {error && <Notice error>{error}</Notice>}{message && <Notice>{message}</Notice>}
    {locked && <Notice>Laporan sedang dimoderasi. Buka kembali setelah keputusan untuk memperbaiki isinya.</Notice>}
    <fieldset disabled={busy || locked} className="space-y-4">
      <legend className="sr-only">Isi laporan</legend>
      <Label name="Mulai dari template"><select className={field} defaultValue="" onChange={e => { const template = UKHUWAH_REPORT_TEMPLATES.find(t => t.id === e.target.value); if (template && (!dirty || window.confirm("Ganti judul dan isi dengan template?"))) edit({ title: template.title, body: template.body, category: template.category, audience: template.audience }); e.target.value = ""; }}><option value="">Pilih satu dari 8 template</option>{UKHUWAH_REPORT_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Label>
      <Label name="Judul"><input id="ukhuwah-title" className={field} maxLength={200} value={draft.title} onChange={e => edit({ title: e.target.value })} /></Label>
      <div className="grid gap-4 sm:grid-cols-2"><Label name="Kategori"><select className={field} value={draft.category} onChange={e => edit({ category: e.target.value as UkhuwahReportInput["category"] })}>{Object.entries(categoryLabels).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></Label><Label name="Prioritas"><select className={field} value={draft.urgency} onChange={e => edit({ urgency: e.target.value as "NORMAL" | "HIGH" })}><option value="NORMAL">Normal</option><option value="HIGH">Tinggi (bukan darurat)</option></select></Label></div>
      <RegionFields cityCode={draft.cityCode} district={draft.district} onChange={f => edit({ ...f, locationId: null })} />
      <Label name="Lokasi terkait (opsional)"><select className={field} value={draft.locationId ?? ""} onChange={e => { const location = locations.data?.data.find(l => l.id === e.target.value); edit({ locationId: e.target.value || null, ...(location ? { district: location.district } : {}) }); }}><option value="">Tanpa lokasi terkait</option>{draft.locationId && !locations.data?.data.some(l => l.id === draft.locationId) && <option value={draft.locationId}>Lokasi tersimpan (tidak ada di hasil saat ini)</option>}{locations.data?.data.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Label><ResourceState resource={locations} /><p className="text-xs text-slate-600">Pilihan berisi maksimal 100 lokasi terakhir dalam wilayah yang dipilih. Memilih lokasi mengikuti kecamatannya; perubahan wilayah melepas afiliasi lokasi.</p>
      <Label name="Tanggal pengamatan"><input id="ukhuwah-observedAt" className={field} type="date" value={draft.observedAt} onChange={e => edit({ observedAt: e.target.value })} /></Label>
      <Label name="Sumber dan keterbatasan informasi"><textarea id="ukhuwah-source" className={field} rows={2} maxLength={1000} value={draft.source} onChange={e => edit({ source: e.target.value })} /></Label>
      <Label name="Isi laporan (teks biasa)"><textarea id="ukhuwah-body" className={field} rows={14} maxLength={20000} value={draft.body} onChange={e => edit({ body: e.target.value })} /></Label>
      <Label name="Cakupan akses"><select id="ukhuwah-audience" className={field} disabled={draft.category === "SENSITIVE"} value={draft.audience} onChange={e => edit({ audience: e.target.value as UkhuwahReportInput["audience"] })}><option value="SHARED">Bersama — hanya setelah disetujui</option><option value="ADMIN_ONLY">Hanya saya dan pengelola</option></select></Label>
      {draft.category === "SENSITIVE" && <p className="text-sm text-amber-900">Template/kategori sensitif terkunci hanya untuk pengelola.</p>}
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={draft.hideAuthor} onChange={e => edit({ hideAuthor: e.target.checked })} />Sembunyikan nama penulis dari papan bersama (pengelola tetap dapat meninjau)</label>
      <div className="flex flex-wrap gap-3"><button className={primary} disabled={!dirty && !!saved} onClick={save}>Simpan draf</button><button className={button} disabled={!saved || dirty} onClick={() => { setPreview(true); setReviewed(null); setError(""); }}>Pratinjau revisi tersimpan</button><button className={button} disabled={!dirty} onClick={() => { if (window.confirm("Buang perubahan yang belum disimpan?")) { setDraft(JSON.parse(baseline)); setReviewed(null); setPreview(false); } }}>Batalkan perubahan</button></div>
    </fieldset>
    {saved && <p className="text-sm text-slate-600">Revisi tersimpan: {saved.version} · {saved.publicationStatus}{dirty ? " · Ada perubahan belum disimpan" : ""}</p>}
    {preview && saved && !dirty && <section className="space-y-4 rounded-lg border-2 border-emerald-300 p-5" aria-label="Pratinjau laporan"><h3 className="text-lg font-bold">{saved.title}</h3><p className="text-sm">{saved.audience === "ADMIN_ONLY" ? "Hanya penulis dan pengelola" : "Dibagikan setelah moderasi"} · {saved.hideAuthor ? "Nama disembunyikan" : "Nama penulis ditampilkan"}</p><TextBody>{saved.body}</TextBody><TextBody>Sumber: {saved.source}</TextBody><label className="flex gap-2 text-sm"><input id="ukhuwah-reviewed" type="checkbox" checked={reviewed === saved.version} disabled={busy} onChange={e => setReviewed(e.target.checked ? saved.version : null)} />Saya telah meninjau isi, sumber, privasi, dan revisi {saved.version} yang tersimpan.</label><button className={primary} disabled={busy || !canSubmitRevision(saved, dirty, reviewed)} onClick={submit}>Ajukan untuk moderasi</button></section>}
  </section>;
}