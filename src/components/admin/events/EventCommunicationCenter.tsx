import React, { useEffect, useId, useReducer, useRef, useState } from "react";
import { Bell, BookOpen, Copy, Eye, Mail, Plus, Save, Search, Send } from "lucide-react";
import { eventApi } from "@/lib/eventApi";
import { BUILTIN_COMMUNICATION_TEMPLATES, COMMUNICATION_VARIABLES } from "@/lib/communicationTemplates";
import {
  COMMUNICATION_AUDIENCES, canPublishCommunication, communicationEditorReducer, communicationFields,
  communicationFingerprint, createCommunicationEditor, emptyCommunication, filterCommunicationDrafts,
  isCommunicationDirty, localCommunicationPreview, validateCommunication,
  hasCommunicationPermission, type CommunicationPermissions,
  type CommunicationDraft, type CommunicationFields, type CommunicationPreview, type CommunicationTemplate, type PreviewSnapshot,
} from "@/lib/eventCommunications";

export type CommunicationNavigationState = { hasUnsavedChanges: boolean; pending: boolean };
export type EventCommunicationCenterProps = {
  eventId: string; previewMode?: boolean; refreshKey?: number;
  onUnsavedChange?: (state: CommunicationNavigationState) => void;
};
export function getCommunicationNavigationState(dirtyDraft: boolean, templateOpen: boolean, pending: boolean): CommunicationNavigationState {
  return { hasUnsavedChanges: dirtyDraft || templateOpen, pending };
}
export function canSwitchCommunicationEvent(state: CommunicationNavigationState, currentEvent: string, nextEvent: string, confirmDiscard: () => boolean): boolean {
  if (currentEvent === nextEvent) return true;
  if (state.pending) return false;
  return !state.hasUnsavedChanges || confirmDiscard();
}
export function canPreviewCommunication(canManage: boolean, canRead: boolean, saved: boolean, localOnly: boolean): boolean {
  return localOnly || (saved ? canRead : canManage);
}
const button = "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50";
const primary = `${button} !border-emerald-700 !bg-emerald-700 !text-white hover:!bg-emerald-800`;
const input = "mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100";
const panel = "rounded-xl border border-slate-200 bg-white p-4 sm:p-6";
const statusLabel = (status: string) => ({ DRAFT: "Draft", PUBLISHING: "Sedang dipublikasikan", PUBLISHED: "Dipublikasikan", UNPUBLISHED: "Ditarik" })[status] || status;
const dateLabel = (value?: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("id-ID") : "—";
const errorText = (error: unknown) => error instanceof Error ? error.message : "Permintaan gagal. Silakan coba lagi.";
type Institution = { id: string; name: string };
type TemplateEditor = { id?: string; name: string; category: string; fields: CommunicationFields };

function MessageFields({ fields, onChange, disabled, institutions, template = false }: {
  fields: CommunicationFields; onChange: (fields: Partial<CommunicationFields>) => void; disabled: boolean;
  institutions: Institution[]; template?: boolean;
}) {
  const id = useId();
  const [variableField, setVariableField] = useState<"body" | "title" | "emailSubject">("body");
  return <fieldset disabled={disabled} className="space-y-4">
    <div><label htmlFor={`${id}-title`} className="text-sm font-bold text-slate-700">Judul pengumuman portal</label>
      <input id={`${id}-title`} required minLength={3} maxLength={200} className={input} value={fields.title} onChange={(e) => onChange({ title: e.target.value })} /></div>
    <div><label htmlFor={`${id}-subject`} className="text-sm font-bold text-slate-700">Subjek email (terpisah dari judul portal)</label>
      <input id={`${id}-subject`} maxLength={200} required={fields.sendEmailNotification} className={input} value={fields.emailSubject} onChange={(e) => onChange({ emailSubject: e.target.value })} />
      <p className="mt-1 text-xs text-slate-500">Wajib diisi saat notifikasi email aktif.</p></div>
    <div><label htmlFor={`${id}-body`} className="text-sm font-bold text-slate-700">Isi pesan — teks biasa</label>
      <textarea id={`${id}-body`} required minLength={5} maxLength={20000} rows={9} className={`${input} leading-6`} value={fields.body} onChange={(e) => onChange({ body: e.target.value })} />
      <p className="mt-1 text-xs text-slate-500">HTML tidak dijalankan. Gunakan variabel yang tersedia; nilai dipersonalisasi oleh server.</p></div>
    <div className="rounded-lg bg-slate-50 p-3">
      <label htmlFor={`${id}-variable-field`} className="text-xs font-bold text-slate-600">Tambahkan variabel ke</label>
      <select id={`${id}-variable-field`} className={`${input} mb-2`} value={variableField} onChange={(e) => setVariableField(e.target.value as typeof variableField)}>
        <option value="body">Isi pesan</option><option value="title">Judul portal</option><option value="emailSubject">Subjek email</option>
      </select>
      <div className="flex flex-wrap gap-2">{COMMUNICATION_VARIABLES.map((variable) => <button key={variable.key} type="button" className="rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700 hover:border-emerald-500 focus-visible:outline focus-visible:outline-emerald-700" title={variable.label}
        onClick={() => onChange({ [variableField]: `${fields[variableField]}{{${variable.key}}}` })}>{`{{${variable.key}}}`}</button>)}</div>
    </div>
    <div><label htmlFor={`${id}-audience`} className="text-sm font-bold text-slate-700">Segmen penerima</label>
      <select id={`${id}-audience`} className={input} value={fields.audienceType} onChange={(e) => onChange({ audienceType: e.target.value, targetInstitutionId: null })}>
        {!COMMUNICATION_AUDIENCES.some((item) => item.value === fields.audienceType) && <option value={fields.audienceType}>Segmen lama tidak didukung — pilih ulang</option>}
        {COMMUNICATION_AUDIENCES.map((audience) => <option key={audience.value} value={audience.value}>{audience.label}</option>)}
      </select></div>
    {!template && fields.audienceType === "SPECIFIC_INSTITUTION" && <div>
      <label htmlFor={`${id}-institution`} className="text-sm font-bold text-slate-700">Lembaga penerima</label>
      <select id={`${id}-institution`} required className={input} value={fields.targetInstitutionId || ""} onChange={(e) => onChange({ targetInstitutionId: e.target.value || null })}>
        <option value="">Pilih lembaga</option>{institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}
      </select><p className="mt-1 text-xs text-slate-500">Daftar memuat hingga 100 lembaga. Jika lembaga tidak tersedia, periksa direktori lembaga.</p>
    </div>}
    {template && fields.audienceType === "SPECIFIC_INSTITUTION" && <p className="text-xs text-amber-800">Lembaga tujuan dipilih saat template digunakan pada draft.</p>}
    <label className="flex min-h-[44px] items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm">
      <input type="checkbox" className="mt-1 h-4 w-4 accent-emerald-700" checked={fields.sendEmailNotification} onChange={(e) => onChange({ sendEmailNotification: e.target.checked })} />
      <span><strong>Antrekan notifikasi email saat publikasi</strong><span className="mt-1 block text-xs text-slate-500">Pilihan ini disimpan bersama draft. Pesan tetap tampil di portal; email hanya untuk alamat valid tanpa duplikasi.</span></span>
    </label>
  </fieldset>;
}

export function CommunicationPreviewCard({ snapshot, localOnly, sampleIndex, onSampleChange }: {
  snapshot: PreviewSnapshot; localOnly: boolean; sampleIndex: number; onSampleChange: (value: number) => void;
}) {
  const id = useId();
  const data = snapshot.data;
  const sample = sampleIndex >= 0 ? data.samples[sampleIndex] : null;
  return <section className={panel} aria-labelledby={`${id}-heading`}>
    <h3 id={`${id}-heading`} className="flex items-center gap-2 text-lg font-bold text-slate-900"><Eye size={20} />{localOnly ? "Pratinjau contoh lokal" : snapshot.draftId ? "Pratinjau server — draft tersimpan" : "Pratinjau server — belum disimpan"}</h3>
    <p className="mt-2 text-sm text-slate-600">Pratinjau tidak mengirim pesan. {snapshot.draftId ? "Perubahan apa pun mewajibkan simpan dan pratinjau ulang." : "Simpan draft dan buat pratinjau tersimpan sebelum publikasi."}</p>
    <dl className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{[
      [localOnly ? "Penerima contoh" : "Penerima portal", data.recipientCount], ["Email unik valid", data.emailRecipientCount],
      ["Tanpa email valid", data.missingEmailCount], ["Email duplikat", data.duplicateEmailCount],
    ].map(([label, count]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-600">{label}</dt><dd className="mt-1 text-xl font-bold text-slate-900">{count}</dd></div>)}</dl>
    {data.warnings.length > 0 && <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><strong>Perhatian</strong><ul className="mt-1 list-inside list-disc">{data.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
    {data.unresolvedVariables.length > 0 && <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">Variabel belum terisi: {data.unresolvedVariables.join(", ")}. Publikasi diblokir; perbaiki data atau pesan.</div>}
    <label htmlFor={`${id}-sample`} className="text-sm font-bold text-slate-700">Contoh personalisasi penerima</label>
    <select id={`${id}-sample`} className={`${input} mb-4`} value={sampleIndex} onChange={(e) => onSampleChange(Number(e.target.value))}>
      <option value={-1}>Pratinjau utama</option>{data.samples.map((item, index) => <option key={index} value={index}>{item.name} — {item.email || "tanpa email"}</option>)}
    </select>
    <div className="mb-4 rounded-lg border border-slate-200 p-4"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Tampilan portal</p>
      <h4 className="break-words font-bold text-slate-900">{sample?.title ?? data.title}</h4><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{sample?.body ?? data.body}</p></div>
    <p className="text-sm text-slate-700"><strong>Subjek email:</strong> {sample?.emailSubject ?? data.emailSubject}</p>
    <p className="mb-2 mt-1 text-xs text-slate-500">HTML email {localOnly ? "contoh lokal" : "dari server"}, terisolasi tanpa izin skrip. {sample && !sample.emailHtml ? "HTML personalisasi tidak tersedia; bingkai menampilkan HTML utama." : "Bingkai mengikuti pilihan contoh penerima."}</p>
    <iframe title="Pratinjau HTML email terisolasi" sandbox="" srcDoc={sample?.emailHtml ?? data.emailHtml} className="h-72 w-full rounded-lg border border-slate-200 bg-white" referrerPolicy="no-referrer" />
  </section>;
}

export function EventCommunicationCenter({ eventId, previewMode = false, refreshKey = 0, onUnsavedChange }: EventCommunicationCenterProps) {
  const id = useId();
  const [editor, dispatch] = useReducer(communicationEditorReducer, undefined, () => createCommunicationEditor());
  const editorRef = useRef(editor); editorRef.current = editor;
  const context = `${eventId}:${previewMode}`;
  const contextRef = useRef(context); contextRef.current = context;
  const mounted = useRef(true);
  const [drafts, setDrafts] = useState<CommunicationDraft[]>([]);
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [permissions, setPermissions] = useState<CommunicationPermissions | null>(null);
  const [loading, setLoading] = useState(!previewMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [templateSearch, setTemplateSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [templateForm, setTemplateForm] = useState<TemplateEditor | null>(null);
  const [sampleIndex, setSampleIndex] = useState(-1);
  const root = `/events/${encodeURIComponent(eventId)}`;
  const dirty = isCommunicationDirty(editor);
  const editable = ["DRAFT", "UNPUBLISHED"].includes(editor.status);
  const canManage = previewMode || hasCommunicationPermission(permissions, eventId, "announcements.manage");
  const canRead = previewMode || hasCommunicationPermission(permissions, eventId, "announcements.read");
  const canPublish = !previewMode && hasCommunicationPermission(permissions, eventId, "announcements.publish");
  const disabled = busy || loading;
  const allTemplates: CommunicationTemplate[] = [...BUILTIN_COMMUNICATION_TEMPLATES, ...templates];
  const categories = [...new Set(allTemplates.map((item) => item.category))];
  const filteredTemplates = allTemplates.filter((item) => (category === "ALL" || item.category === category)
    && `${item.name} ${item.description || ""} ${item.title} ${item.body}`.toLocaleLowerCase("id").includes(templateSearch.trim().toLocaleLowerCase("id")));
  const visibleDrafts = filterCommunicationDrafts(drafts, draftSearch, statusFilter);
  const templateOpen = templateForm !== null;
  const savedEditor = !!editor.draftId && !dirty;

  useEffect(() => {
    onUnsavedChange?.(getCommunicationNavigationState(dirty, templateOpen, busy || loading));
  }, [dirty, templateOpen, busy, loading, onUnsavedChange]);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    dispatch({ type: "open", fields: emptyCommunication() });
    setDrafts([]); setTemplates([]); setInstitutions([]); setPermissions(null); setTemplateForm(null); setNotice(""); setError(""); setBusy(false);
  }, [context]);
  useEffect(() => {
    let active = true;
    dispatch({ type: "invalidate" });
    if (previewMode || !eventId) { setLoading(false); return; }
    setLoading(true); setError("");
    const load = async () => {
      const results = await Promise.allSettled([
        eventApi<CommunicationDraft[]>(`${root}/announcements`),
        eventApi<CommunicationTemplate[]>(`${root}/communication-templates`),
        eventApi<Institution[]>(`${root}/announcements/institutions`),
        eventApi<CommunicationPermissions>("/me/permissions"),
      ]);
      if (!active) return;
      const [announcements, custom, institutionData, permissionData] = results;
      if (announcements.status === "fulfilled") setDrafts(announcements.value);
      if (custom.status === "fulfilled") setTemplates(custom.value);
      if (institutionData.status === "fulfilled") setInstitutions(institutionData.value);
      if (permissionData.status === "fulfilled") setPermissions(permissionData.value);
      const errors = results.filter((result): result is PromiseRejectedResult => result.status === "rejected").map((result) => errorText(result.reason));
      if (errors.length) setError(`Sebagian data gagal dimuat: ${errors.join(" ")}`);
      setLoading(false);
    };
    void load(); return () => { active = false; };
  }, [context, refreshKey]);
  useEffect(() => {
    if (!dirty && !templateForm) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, templateForm]);

  const run = async (work: (isActive: () => boolean) => Promise<void>) => {
    if (busy) return;
    const startedContext = context;
    const isActive = () => mounted.current && contextRef.current === startedContext;
    setBusy(true); setError(""); setNotice("");
    try { await work(isActive); } catch (reason) { if (isActive()) setError(errorText(reason)); }
    finally { if (isActive()) setBusy(false); }
  };
  const allowDiscard = () => !dirty || window.confirm("Perubahan draft belum disimpan. Buang perubahan dan lanjutkan?");
  const openDraft = (draft: CommunicationDraft, duplicate = false) => {
    if (!canManage) return;
    if (!allowDiscard()) return;
    dispatch({ type: "open", fields: communicationFields(draft), ...(duplicate ? {} : { draftId: draft.id, status: draft.status, updatedAt: draft.updatedAt }) });
    setSampleIndex(-1); setNotice(duplicate ? "Salinan dibuka sebagai draft baru. Simpan sebelum publikasi." : "Draft dibuka. Tinjau lalu buat pratinjau server.");
  };
  const saveDraft = () => {
    if (!canManage) return;
    const errors = validateCommunication(editor.fields);
    if (errors.length) { setError(errors.join(" ")); return; }
    if (!editable) return;
    void run(async (isActive) => {
      const saved = previewMode
        ? { ...editor.fields, id: editor.draftId || `local-${Date.now()}`, status: "DRAFT", createdAt: new Date().toISOString() }
        : await eventApi<CommunicationDraft>(`${root}/announcements${editor.draftId ? `/${encodeURIComponent(editor.draftId)}` : ""}`, {
          method: editor.draftId ? "PATCH" : "POST", body: JSON.stringify(editor.fields),
        });
      if (!isActive()) return;
      setDrafts((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
      dispatch({ type: "saved", draft: saved });
      setNotice(previewMode ? "Draft disimpan hanya di memori lokal; hilang saat halaman dimuat ulang." : "Draft tersimpan. Buat pratinjau tersimpan untuk membuka publikasi.");
    });
  };
  const preview = (draft?: CommunicationDraft) => {
    const saved = !!draft || savedEditor;
    if (!canPreviewCommunication(canManage, canRead, saved, previewMode)) return;
    if (draft && !allowDiscard()) return;
    const fields = draft ? communicationFields(draft) : editor.fields;
    const errors = validateCommunication(fields);
    if (errors.length) { setError(errors.join(" ")); return; }
    const draftId = draft?.id || editor.draftId;
    // Lock the editor while resolving preview; do not accept a response for another revision.
    const revision = editor.revision + 1;
    if (draft) dispatch({ type: "open", fields, draftId: draft.id, status: draft.status, updatedAt: draft.updatedAt });
    else dispatch({ type: "invalidate" });
    void run(async (isActive) => {
      const data = previewMode ? localCommunicationPreview(fields)
        : await eventApi<CommunicationPreview>(saved ? `${root}/announcements/${encodeURIComponent(draftId!)}/preview` : `${root}/announcements/preview`, {
          method: "POST", ...(!saved ? { body: JSON.stringify(fields) } : {}),
        });
      if (!isActive()) return;
      const previewVersion = data.expectedUpdatedAt || data.updatedAt;
      const editorVersion = draft?.updatedAt || editor.savedUpdatedAt;
      if (saved && !previewMode && editorVersion && editorVersion !== previewVersion) {
        throw new Error("Draft di server berubah sejak dibuka. Segarkan daftar dan buka kembali draft terbaru sebelum membuat pratinjau.");
      }
      dispatch({ type: "preview", data, saved: saved && !previewMode, expectedRevision: revision }); setSampleIndex(-1);
    });
  };
  const publish = () => {
    if (!canPublish || !canPublishCommunication(editor, previewMode)) return;
    void run(async (isActive) => {
      const result = await eventApi<{ announcement: CommunicationDraft; emailEnqueuedCount: number; emailFailedCount: number }>(`${root}/announcements/${encodeURIComponent(editor.draftId!)}/publish`, {
        method: "POST", body: JSON.stringify({ sendEmailNotification: editor.fields.sendEmailNotification, expectedUpdatedAt: editor.preview!.data.expectedUpdatedAt || editor.preview!.data.updatedAt }),
      });
      if (!isActive()) return;
      const published = result.announcement || { ...editor.fields, id: editor.draftId!, status: "PUBLISHED" };
      setDrafts((items) => items.map((item) => item.id === published.id ? published : item)); dispatch({ type: "saved", draft: published });
      setNotice(`Pengumuman dipublikasikan di portal. ${result.emailEnqueuedCount ?? 0} email diantrekan; ${result.emailFailedCount ?? 0} gagal diantrekan. Diantrekan bukan berarti telah terkirim. Periksa antrean email untuk status pengiriman.`);
    });
  };
  const unpublish = (draft: CommunicationDraft) => {
    if (!canPublish || !window.confirm("Tarik pengumuman dari portal? Email yang sudah diantrekan atau dikirim tidak dapat ditarik kembali.")) return;
    void run(async (isActive) => {
      const updated = await eventApi<CommunicationDraft>(`${root}/announcements/${encodeURIComponent(draft.id)}/unpublish`, { method: "POST" });
      if (!isActive()) return;
      setDrafts((items) => items.map((item) => item.id === draft.id ? updated : item));
      if (editor.draftId === draft.id) dispatch({ type: "saved", draft: updated });
      setNotice("Pengumuman ditarik dari portal. Email yang telah diantrekan atau dikirim tidak dibatalkan.");
    });
  };
  const saveTemplate = (event: React.FormEvent) => {
    event.preventDefault(); if (!templateForm || previewMode || !canManage) return;
    const errors = validateCommunication({ ...templateForm.fields, targetInstitutionId: templateForm.fields.audienceType === "SPECIFIC_INSTITUTION" ? "template-placeholder" : null });
    if (!templateForm.name.trim() || !templateForm.category.trim()) errors.push("Nama dan kategori template wajib diisi.");
    if (errors.length) { setError(errors.join(" ")); return; }
    void run(async (isActive) => {
      const { targetInstitutionId: _target, ...fields } = templateForm.fields;
      const saved = await eventApi<CommunicationTemplate>(`${root}/communication-templates${templateForm.id ? `/${encodeURIComponent(templateForm.id)}` : ""}`, {
        method: templateForm.id ? "PATCH" : "POST", body: JSON.stringify({ ...fields, name: templateForm.name.trim(), category: templateForm.category.trim() }),
      });
      if (!isActive()) return;
      setTemplates((items) => [saved, ...items.filter((item) => item.id !== saved.id)]); setTemplateForm(null); setNotice("Template khusus tersimpan untuk program ini.");
    });
  };
  const archiveTemplate = (template: CommunicationTemplate) => {
    if (previewMode || !canManage || !window.confirm(`Arsipkan template “${template.name}”? Draft yang sudah memakai template tidak berubah.`)) return;
    void run(async (isActive) => {
      await eventApi(`${root}/communication-templates/${encodeURIComponent(template.id)}`, { method: "DELETE" });
      if (!isActive()) return;
      setTemplates((items) => items.filter((item) => item.id !== template.id));
      if (templateForm?.id === template.id) setTemplateForm(null);
      setNotice("Template diarsipkan. Draft yang ada tidak diubah.");
    });
  };

  return <div className="space-y-6" aria-label="Pusat komunikasi program" aria-busy={busy || loading}>
    <section className={panel}>
      <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Bell size={22} />Pusat komunikasi</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Susun pengumuman portal dan notifikasi email dengan template, segmen penerima, dan pratinjau personalisasi. Tidak ada penjadwalan atau pengiriman WhatsApp di sini.</p>
      {previewMode && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><strong>Mode contoh lokal.</strong> Semua jumlah dan personalisasi adalah contoh. Tidak ada panggilan API, pengiriman pesan, atau penyimpanan template ke database.</p>}
      <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        ["Draft", drafts.filter((item) => item.status === "DRAFT").length], ["Dipublikasikan", drafts.filter((item) => item.status === "PUBLISHED").length],
        ["Ditarik", drafts.filter((item) => item.status === "UNPUBLISHED").length], ["Template tersedia", allTemplates.length],
      ].map(([label, count]) => <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 p-3"><dt className="text-xs text-slate-600">{label}</dt><dd className="mt-1 text-2xl font-bold text-slate-900">{count}</dd></div>)}</dl>
    </section>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}
    {loading && <p role="status" className="text-sm text-slate-600">Memuat draft, template, dan lembaga…</p>}
    {!loading && !canManage && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Akses baca saja. Penyimpanan draft dan pengelolaan template tidak tersedia untuk akun ini.</p>}

    <section className={panel} aria-labelledby={`${id}-templates`}>
      <h3 id={`${id}-templates`} className="flex items-center gap-2 text-lg font-bold text-slate-900"><BookOpen size={20} />Pustaka template</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><div><label htmlFor={`${id}-template-search`} className="text-sm font-bold text-slate-700">Cari template</label>
        <input id={`${id}-template-search`} type="search" className={input} placeholder="Nama atau isi template" value={templateSearch} onChange={(e) => setTemplateSearch(e.target.value)} /></div>
        <div><label htmlFor={`${id}-category`} className="text-sm font-bold text-slate-700">Kategori template</label><select id={`${id}-category`} className={input} value={category} onChange={(e) => setCategory(e.target.value)}><option value="ALL">Semua kategori</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></div></div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filteredTemplates.map((template) => {
        const custom = templates.some((item) => item.id === template.id);
        return <article key={template.id} className="flex flex-col rounded-lg border border-slate-200 p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><span className="rounded bg-slate-100 px-2 py-1">{template.category}</span><span>{custom ? "Khusus program" : "Bawaan · hanya baca"}</span></div>
          <h4 className="mt-2 font-bold text-slate-900">{template.name}</h4><p className="mt-1 text-sm text-slate-600">{template.description || template.title}</p>
          <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-xs leading-5 text-slate-500">{template.body}</p>
          <div className="mt-auto flex flex-wrap gap-2 pt-4"><button type="button" className={button} disabled={disabled || !canManage} onClick={() => {
            if (!canManage || !allowDiscard()) return; dispatch({ type: "open", fields: communicationFields(template) }); setNotice(`Template “${template.name}” diterapkan pada draft baru. Pilih penerima dan simpan.`);
          }}>Gunakan template</button>
            {custom && canManage && <><button type="button" className={button} disabled={disabled || previewMode} onClick={() => {
              if (templateForm && !window.confirm("Buang perubahan template yang sedang dibuka?")) return;
              setTemplateForm({ id: template.id, name: template.name, category: template.category, fields: communicationFields(template) });
            }}>Edit template</button><button type="button" className={button} disabled={disabled || previewMode} onClick={() => archiveTemplate(template)}>Arsipkan</button></>}
          </div>
        </article>;
      })}</div>
      {!filteredTemplates.length && <p className="mt-4 text-sm text-slate-500">Tidak ada template sesuai pencarian.</p>}
    </section>

    {templateForm && <section className={panel} aria-labelledby={`${id}-template-edit`}>
      <h3 id={`${id}-template-edit`} className="text-lg font-bold text-slate-900">{templateForm.id ? "Edit template khusus" : "Simpan sebagai template khusus"}</h3>
      <p className="mt-1 text-sm text-slate-600">Template disimpan terpisah; draft dan pengumuman yang ada tidak berubah.</p>
      <form onSubmit={saveTemplate} className="mt-4 space-y-4"><div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor={`${id}-template-name`} className="text-sm font-bold text-slate-700">Nama template</label><input id={`${id}-template-name`} required maxLength={120} className={input} value={templateForm.name} disabled={disabled || !canManage} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} /></div>
        <div><label htmlFor={`${id}-template-category`} className="text-sm font-bold text-slate-700">Kategori</label><input id={`${id}-template-category`} required maxLength={80} className={input} value={templateForm.category} disabled={disabled || !canManage} onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })} /></div>
      </div><MessageFields fields={templateForm.fields} institutions={institutions} template disabled={disabled || !canManage} onChange={(fields) => { if (canManage) setTemplateForm({ ...templateForm, fields: communicationFields({ ...templateForm.fields, ...fields }) }); }} />
        <div className="flex flex-wrap gap-2"><button type="submit" className={primary} disabled={disabled || previewMode || !canManage}><Save size={16} />Simpan template</button><button type="button" className={button} disabled={disabled} onClick={() => { if (window.confirm("Buang perubahan template dan tutup editor template?")) setTemplateForm(null); }}>Batal edit template</button></div>
      </form>
    </section>}

    <div className="grid items-start gap-6 xl:grid-cols-2">
      <section className={panel} aria-labelledby={`${id}-editor`}>
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 id={`${id}-editor`} className="text-lg font-bold text-slate-900">{editor.draftId ? `Pengumuman · ${statusLabel(editor.status)}` : "Draft baru"}</h3>
          <button type="button" className={button} disabled={disabled || !canManage} onClick={() => { if (canManage && allowDiscard()) dispatch({ type: "open", fields: emptyCommunication() }); }}><Plus size={16} />Draft baru</button></div>
        {dirty && <p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Ada perubahan belum disimpan. Pratinjau sebelumnya tidak berlaku; simpan dan pratinjau ulang sebelum publikasi.</p>}
        {!editable && <p className="mt-3 text-sm text-amber-800">Pengumuman sudah atau sedang dipublikasikan dan tidak dapat diedit langsung. Duplikasikan menjadi draft baru; hubungi admin jika proses publikasi tertahan.</p>}
        <form className="mt-4 space-y-4" onSubmit={(event) => { event.preventDefault(); saveDraft(); }}>
          <MessageFields fields={editor.fields} institutions={institutions} disabled={disabled || !editable || !canManage} onChange={(fields) => { if (canManage) dispatch({ type: "change", fields }); }} />
          <div className="flex flex-wrap gap-2">{canManage && <button type="submit" className={primary} disabled={disabled || !editable}><Save size={16} />{previewMode ? "Simpan draft lokal" : editor.draftId ? "Simpan perubahan draft" : "Simpan draft"}</button>}
            <button type="button" className={button} disabled={disabled || !canPreviewCommunication(canManage, canRead, savedEditor, previewMode)} onClick={() => preview()}><Eye size={16} />{previewMode ? "Pratinjau contoh" : savedEditor ? "Pratinjau tersimpan" : "Pratinjau tanpa menyimpan"}</button>
            {canManage && <button type="button" className={button} disabled={disabled || previewMode} onClick={() => {
              if (templateForm && !window.confirm("Buang perubahan template yang sedang dibuka?")) return;
              setTemplateForm({ name: editor.fields.title, category: "Khusus", fields: { ...editor.fields } });
            }}><BookOpen size={16} />Simpan sebagai template</button>}
            <button type="button" className={button} disabled={disabled} onClick={() => { if (allowDiscard()) dispatch({ type: "open", fields: emptyCommunication() }); }}>Batal / tutup draft</button>
          </div>
          {previewMode && <p className="text-xs text-slate-500">Penyimpanan template dan publikasi tidak tersedia dalam mode contoh.</p>}
        </form>
      </section>
      <div className="space-y-4">
        {editor.preview ? <CommunicationPreviewCard snapshot={editor.preview} localOnly={previewMode} sampleIndex={sampleIndex} onSampleChange={setSampleIndex} />
          : <section className={panel}><h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Eye size={20} />Pratinjau pesan</h3><p className="mt-2 text-sm text-slate-600">Buat pratinjau untuk melihat teks portal, HTML email, jumlah penerima, dan peringatan dari server. Pratinjau draft tersimpan wajib sebelum publikasi.</p></section>}
        <section className={panel} aria-labelledby={`${id}-publish`}>
          <h3 id={`${id}-publish`} className="flex items-center gap-2 text-lg font-bold text-slate-900"><Send size={20} />Konfirmasi publikasi</h3>
          <p className="mt-2 text-sm text-slate-600">Publikasi menampilkan pesan di portal. {editor.fields.sendEmailNotification ? "Notifikasi email akan diantrekan; antrean tidak menjamin email telah terkirim." : "Notifikasi email tidak diantrekan."} Email yang sudah diproses tidak bisa ditarik kembali.</p>
          <label className="mt-4 flex min-h-[44px] items-start gap-3 text-sm text-slate-700"><input type="checkbox" className="mt-1 h-4 w-4 accent-emerald-700" checked={editor.confirmed}
            disabled={disabled || !canPublish || !editor.preview?.draftId || !(editor.preview.data.expectedUpdatedAt || editor.preview.data.updatedAt) || dirty || !editable || !!editor.preview.data.unresolvedVariables.length || editor.preview.data.recipientCount === 0}
            onChange={(event) => dispatch({ type: "confirm", value: event.target.checked })} /><span>Saya telah memeriksa isi, segmen, jumlah penerima, dan peringatan pada pratinjau tersimpan. Saya menyetujui publikasi{editor.fields.sendEmailNotification ? " dan antrean email" : " tanpa email"}.</span></label>
          {(canPublish || previewMode) && <button type="button" className={`${primary} mt-4 w-full`} disabled={disabled || !canPublish || !canPublishCommunication(editor, previewMode)} onClick={publish}><Send size={16} />Publikasikan pengumuman</button>}
          {!canPublish && !previewMode && <p className="mt-3 text-sm text-slate-500">Akun ini tidak memiliki izin publikasi untuk program ini.</p>}
          <p className="mt-2 text-xs text-slate-500">{previewMode ? "Publikasi dinonaktifkan dalam mode contoh lokal." : "Simpan draft, buat pratinjau tersimpan, lalu centang persetujuan. Setiap perubahan membatalkan persetujuan."}</p>
        </section>
      </div>
    </div>

    <section className={panel} aria-labelledby={`${id}-drafts`}>
      <h3 id={`${id}-drafts`} className="text-lg font-bold text-slate-900">Daftar draft dan pengumuman</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><div><label htmlFor={`${id}-draft-search`} className="flex items-center gap-2 text-sm font-bold text-slate-700"><Search size={16} />Cari pengumuman</label><input id={`${id}-draft-search`} type="search" className={input} placeholder="Judul, subjek, atau isi pesan" value={draftSearch} onChange={(e) => setDraftSearch(e.target.value)} /></div>
        <div><label htmlFor={`${id}-status`} className="text-sm font-bold text-slate-700">Status pengumuman</label><select id={`${id}-status`} className={input} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="ALL">Semua status</option>{["DRAFT", "PUBLISHING", "PUBLISHED", "UNPUBLISHED"].map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></div></div>
      <div className="mt-4 space-y-3">{visibleDrafts.map((draft) => <article key={draft.id} className="rounded-lg border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-2"><h4 className="break-words font-bold text-slate-900">{draft.title}</h4><span className={`rounded-full px-2 py-1 text-xs font-bold ${draft.status === "PUBLISHED" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{statusLabel(draft.status)}</span></div>
        <p className="mt-2 text-xs text-slate-500">{COMMUNICATION_AUDIENCES.find((item) => item.value === draft.audienceType)?.label || "Segmen lama tidak didukung"} · {draft.sendEmailNotification ? "Notifikasi email aktif" : "Portal tanpa email"}</p>
        <p className="mt-1 text-xs text-slate-500">Dibuat: {dateLabel(draft.createdAt)} · Diperbarui: {dateLabel(draft.updatedAt)}{draft.publishedAt ? ` · Publikasi: ${dateLabel(draft.publishedAt)}` : ""}</p>
        <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-sm text-slate-600">{draft.body}</p>
        <div className="mt-3 flex flex-wrap gap-2">{canManage && <button type="button" className={button} disabled={disabled || !["DRAFT", "UNPUBLISHED"].includes(draft.status)} onClick={() => openDraft(draft)}>Edit draft</button>}
          {canManage && <button type="button" className={button} disabled={disabled} onClick={() => openDraft(draft, true)}><Copy size={16} />Duplikasikan</button>}
          <button type="button" className={button} disabled={disabled || !canPreviewCommunication(canManage, canRead, true, previewMode)} onClick={() => preview(draft)}><Eye size={16} />Pratinjau</button>
          {draft.status === "PUBLISHED" && canPublish && <button type="button" className={button} disabled={disabled || previewMode} onClick={() => unpublish(draft)}>Tarik publikasi</button>}
        </div>
      </article>)}</div>
      {!visibleDrafts.length && <p className="mt-4 text-sm text-slate-500">{drafts.length ? "Tidak ada pengumuman sesuai filter." : "Belum ada draft. Gunakan template atau tulis pesan baru."}</p>}
      <p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><Mail size={16} />Status publikasi portal bukan status pengiriman email.</p>
      {hasCommunicationPermission(permissions, eventId, "email.read") && <a href="/admin/email-jobs" className={`${button} mt-3`}>Lihat antrean dan email gagal</a>}
    </section>
  </div>;
}

export default EventCommunicationCenter;