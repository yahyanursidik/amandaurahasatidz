import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { Plus, Search, Trash2 } from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { EventWorkspaceNav } from "@/components/admin/events/EventWorkspaceNav";
import { PageHeader } from "@/components/common/PageHeader";
import { MaterialKindFilter, MaterialKindIcon, MaterialPreview, materialField, materialPrimary, materialSecondary,
  type MaterialKindFilterValue } from "@/components/common/MaterialPreview";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EventApiError, eventApi } from "@/lib/eventApi";
import { MATERIAL_KINDS, MATERIAL_SOURCE_LIMIT, materialKindLabel, materialSourceError, matchesMaterialSearch, parseMaterialSource,
  type AdminMaterial, type AdminMaterialLibrary, type MaterialKind } from "@/lib/eventMaterial";
import { RECORDING_TITLE_MAX, RECORDING_URL_MAX } from "@/lib/eventRecording";
import { formatEventDate } from "@/lib/eventDateTime";

type Draft = {
  id: string;
  title: string;
  kind: MaterialKind;
  sessionId: string;
  published: boolean;
  links: Array<{ key: number; url: string }>;
};
type AdminStatus = "ALL" | "PUBLISHED" | "DRAFT";

function MaterialWorkspace({ eventId }: { eventId: string }) {
  const apiPath = `/events/${encodeURIComponent(eventId)}/materials`;
  const formId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const nextKey = useRef(0);
  const [data, setData] = useState<AdminMaterialLibrary | null>(null);
  const [revision, setRevision] = useState(0);
  const [loadError, setLoadError] = useState<{ message: string; denied: boolean } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formPreview, setFormPreview] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<MaterialKindFilterValue>("ALL");
  const [status, setStatus] = useState<AdminStatus>("ALL");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoadError(null);
    void eventApi<AdminMaterialLibrary>(apiPath, { signal: controller.signal, cache: "no-store" }).then((next) => {
      if (!controller.signal.aborted) setData(next);
    }).catch((cause) => {
      if (controller.signal.aborted) return;
      const denied = cause instanceof EventApiError && cause.status === 403;
      setLoadError({ denied, message: denied ? "Akun Anda tidak memiliki izin mengelola materi event ini."
        : cause instanceof Error ? cause.message : "Daftar materi gagal dimuat." });
    });
    return () => controller.abort();
  }, [apiPath, revision]);

  const editorId = draft?.id;
  useEffect(() => {
    if (editorId !== undefined) titleRef.current?.focus();
    else if (notice) addRef.current?.focus();
  }, [editorId, notice]);

  const openEditor = (item?: AdminMaterial) => {
    setPreviewId(null);
    setFormPreview(false);
    setSaveError("");
    setNotice("");
    const urls = item?.sources.map((source) => source.url) ?? [];
    setDraft({ id: item?.id ?? "", title: item?.title ?? "", kind: item?.kind ?? "VIDEO", published: item?.published ?? false,
      sessionId: item?.session?.id ?? "", links: (urls.length ? urls : [""]).map((url) => ({ key: nextKey.current++, url })) });
  };

  const changeLinks = (links: Draft["links"]) => {
    setDraft((current) => current && { ...current, links });
    setFormPreview(false);
    setSaveError("");
  };

  const parsed = draft?.links.map((link) => parseMaterialSource(draft.kind, link.url, data?.storageHosts)) ?? [];
  const previewSources = parsed.filter((source, index) => source && parsed.findIndex((entry) => entry?.url === source.url) === index)
    .filter((source) => source !== null);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft || saving) return;
    const missing = parsed.findIndex((source) => !source);
    if (!draft.title.trim() || missing !== -1 || previewSources.length !== draft.links.length) {
      if (!draft.title.trim()) titleRef.current?.focus();
      if (missing !== -1) document.getElementById(`${formId}-source-${draft.links[missing].key}`)?.focus();
      setSaveError(!draft.title.trim() ? "Isi judul materi." : missing !== -1
        ? materialSourceError(draft.kind, draft.links[missing].url) : "Gunakan tautan yang berbeda untuk setiap sumber.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const saved = await eventApi<AdminMaterial>(draft.id ? `${apiPath}/${draft.id}` : apiPath, {
        method: draft.id ? "PATCH" : "POST",
        body: JSON.stringify({ title: draft.title.trim(), kind: draft.kind, sessionId: draft.sessionId || null,
          urls: previewSources.map((source) => source.url), published: draft.published }),
      });
      setData((current) => current && { ...current, materials: draft.id
        ? current.materials.map((item) => item.id === saved.id ? saved : item)
        : [...current.materials, saved] });
      setDraft(null);
      setNotice(saved.published ? "Materi dibagikan." : "Draf tersimpan.");
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Materi gagal disimpan.");
    } finally {
      setSaving(false);
    }
  };

  const items = data?.materials.filter((item) => (kind === "ALL" || item.kind === kind) &&
    (status === "ALL" || item.published === (status === "PUBLISHED")) && matchesMaterialSearch(item, query)) ?? [];

  return (
    <AdminLayout>
      <PageHeader title="Materi & Rekaman" description={data?.event.name}
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Event", href: "/admin/events" },
          { label: "Ringkasan event", href: `/admin/events/${eventId}` }, { label: "Materi & Rekaman" }]}
        actions={data && <button ref={addRef} type="button" className={materialPrimary} disabled={!!draft} onClick={() => openEditor()}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Tambah materi
        </button>} />
      <EventWorkspaceNav eventId={eventId} />
      {notice && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-950">{notice}</p>}
      {loadError && <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
        <p role="alert">{loadError.message}</p>
        {!loadError.denied && <button type="button" className={`${materialSecondary} mt-3`} onClick={() => setRevision((n) => n + 1)}>Muat ulang</button>}
      </div>}
      {!loadError && !data && <p role="status" className="text-sm text-slate-700">Memuat materi event…</p>}
      {data && <div className={`grid items-start gap-5 ${draft ? "2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : ""}`}>
        {draft && <form onSubmit={save} aria-labelledby={`${formId}-heading`} aria-busy={saving}
          className="min-w-0 rounded-xl border border-emerald-200 bg-white p-4 sm:p-6">
          <h2 id={`${formId}-heading`} className="mb-4 text-lg font-bold text-emerald-950">{draft.id ? "Edit materi" : "Materi baru"}</h2>
          <fieldset disabled={saving} className="min-w-0 space-y-4">
            <fieldset>
              <legend className="mb-1 text-sm font-semibold text-slate-800">Jenis materi</legend>
              <div className="flex flex-wrap gap-2">
                {MATERIAL_KINDS.map((type) => <label key={type} className={`${type === draft.kind ? materialPrimary : materialSecondary} relative`}>
                  <input type="radio" name={`${formId}-kind`} checked={type === draft.kind}
                    className="h-4 w-4 accent-emerald-800" onChange={() => {
                      setDraft({ ...draft, kind: type }); setFormPreview(false); setSaveError("");
                    }} />
                  {type === "VIDEO" ? "Rekaman video" : "Materi PDF"}
                </label>)}
              </div>
            </fieldset>
            <label className="block text-sm font-semibold text-slate-800">
              Judul materi
              <input ref={titleRef} className={`${materialField} mt-1`} value={draft.title} maxLength={RECORDING_TITLE_MAX} required
                onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              Sesi
              <select className={`${materialField} mt-1`} value={draft.sessionId}
                onChange={(event) => setDraft({ ...draft, sessionId: event.target.value })}>
                <option value="">Umum untuk event ini</option>
                {data.sessions.map((session) => <option key={session.id} value={session.id}>{session.title} · {formatEventDate(session.date)}</option>)}
              </select>
            </label>

            <fieldset className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
              <legend className="px-1 text-sm font-bold text-slate-900">Sumber materi</legend>
              <p id={`${formId}-source-hint`} className="mb-3 text-sm text-slate-700">
                {draft.kind === "PDF" ? "Google Drive atau S3 dengan tautan PDF tetap." : "YouTube atau Google Drive."}
              </p>
              <div className="space-y-3">
                {draft.links.map((link, index) => (
                  <div key={link.key} className="min-w-0">
                    <label htmlFor={`${formId}-source-${link.key}`} className="mb-1 block text-sm font-semibold text-slate-800">
                      {index === 0 ? "Tautan utama" : `Tautan alternatif ${index}`}
                    </label>
                    <div className="flex min-w-0 items-center gap-2">
                      <input id={`${formId}-source-${link.key}`} type="url" required maxLength={RECORDING_URL_MAX} placeholder="https://…"
                        className={materialField} value={link.url} aria-describedby={`${formId}-source-hint`}
                        aria-invalid={!!link.url.trim() && !parsed[index] || undefined}
                        onChange={(event) => changeLinks(draft.links.map((entry) => entry.key === link.key ? { ...entry, url: event.target.value } : entry))} />
                      {index !== 0 && <button type="button" className={`${materialSecondary} w-11 shrink-0 px-0`}
                        onClick={() => changeLinks(draft.links.filter((entry) => entry.key !== link.key))}
                        aria-label={`Hapus tautan alternatif ${index}`}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>}
                    </div>
                    {link.url.trim() && <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2">
                      <p className={`text-sm ${parsed[index] ? "text-slate-700" : "text-rose-800"}`}>
                        {parsed[index]?.provider ?? materialSourceError(draft.kind, link.url)}
                      </p>
                      {index > 0 && parsed[index] && <button type="button" className={materialSecondary}
                        aria-label={`Jadikan sumber alternatif ${index} sebagai utama`}
                        onClick={() => changeLinks([link, ...draft.links.filter((entry) => entry.key !== link.key)])}>
                        Jadikan utama
                      </button>}
                    </div>}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {draft.links.length < MATERIAL_SOURCE_LIMIT && <button type="button" className={materialSecondary}
                  onClick={() => changeLinks([...draft.links, { key: nextKey.current++, url: "" }])}>
                  <Plus className="h-4 w-4" aria-hidden="true" /> Tambah sumber
                </button>}
                <button type="button" className={materialSecondary} disabled={!previewSources.length} aria-expanded={formPreview}
                  aria-controls={`${formId}-preview`} onClick={() => { setPreviewId(null); setFormPreview(!formPreview); }}>
                  {formPreview ? "Tutup pratinjau" : "Pratinjau"}
                </button>
              </div>
              <div id={`${formId}-preview`} className={formPreview ? "mt-4" : undefined}>
                {formPreview && <MaterialPreview kind={draft.kind} sources={previewSources} title={draft.title.trim() || "materi"} pdfPreviewPath={`${apiPath}/pdf-preview`} />}
              </div>
            </fieldset>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-slate-800">
              <input type="checkbox" checked={draft.published} className="h-5 w-5 accent-emerald-800"
                onChange={(event) => setDraft({ ...draft, published: event.target.checked })} />
              Bagikan ke peserta
            </label>
            {saveError && <p role="alert" className="text-sm font-semibold text-rose-800">{saveError}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={materialPrimary}>{saving ? "Menyimpan…" : draft.published ? "Simpan dan bagikan" : "Simpan draf"}</button>
              <button type="button" className={materialSecondary} onClick={() => { setDraft(null); setNotice(""); requestAnimationFrame(() => addRef.current?.focus()); }}>Batal</button>
            </div>
          </fieldset>
        </form>}

        <section aria-labelledby={`${formId}-library`} className="min-w-0 rounded-xl border border-slate-200 bg-white">
          <header className="grid gap-3 rounded-t-xl border-b border-slate-200 bg-emerald-50 p-4 sm:p-5">
            <h2 id={`${formId}-library`} className="text-lg font-bold text-emerald-950">Daftar materi</h2>
            {data.materials.length > 0 && <>
              <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,0.45fr)]">
                <label className="min-w-0 text-sm font-semibold text-slate-800">Cari materi
                  <span className="relative mt-1 block">
                    <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-600" aria-hidden="true" />
                    <input type="search" className={`${materialField} pl-9`} value={query} placeholder="Judul atau sesi" onChange={(event) => setQuery(event.target.value)} />
                  </span>
                </label>
                <label className="min-w-0 text-sm font-semibold text-slate-800">Publikasi
                  <select className={`${materialField} mt-1`} value={status} onChange={(event) => setStatus(event.target.value as AdminStatus)}>
                    <option value="ALL">Semua status</option>
                    <option value="PUBLISHED">Dibagikan</option>
                    <option value="DRAFT">Draf</option>
                  </select>
                </label>
              </div>
              <MaterialKindFilter value={kind} onChange={setKind} />
            </>}
          </header>
          {!items.length && <p className="p-5 text-sm text-slate-700">{data.materials.length ? "Materi belum ditemukan." : "Belum ada materi untuk event ini."}</p>}
          <ul className="divide-y divide-slate-200">
            {items.map((item) => {
              const open = previewId === item.id;
              const panelId = `admin-preview-${item.id}`;
              const providers = [...new Set(item.sources.map((source) => source.provider))].join(", ");
              return <li key={item.id} className="p-4 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 basis-52 items-start gap-3">
                    <MaterialKindIcon kind={item.kind} />
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-950 [overflow-wrap:anywhere]">{item.title}</h3>
                      <p className="mb-2 text-sm text-slate-700 [overflow-wrap:anywhere]">
                        {materialKindLabel[item.kind]}{providers ? ` · ${providers}` : ""}{item.session ? ` · ${item.session.title}` : ""}
                      </p>
                      <StatusBadge label={item.published ? "Dibagikan" : "Draf"} variant={item.published ? "success" : "neutral"} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.sources.length > 0 && <button type="button" className={materialSecondary}
                      aria-expanded={open} aria-controls={panelId} aria-label={`${open ? "Tutup pratinjau" : "Pratinjau"} ${item.title}`}
                      onClick={() => { setFormPreview(false); setPreviewId(open ? null : item.id); }}>
                      {open ? "Tutup" : "Pratinjau"}
                    </button>}
                    <button type="button" className={materialSecondary} disabled={!!draft} aria-label={`Edit ${item.title}`}
                      onClick={() => openEditor(item)}>Edit</button>
                  </div>
                </div>
                <div id={panelId} className={open ? "mt-4 rounded-xl bg-slate-50 p-3 sm:p-4" : undefined}>
                  {open && <MaterialPreview kind={item.kind} title={item.title} sources={item.sources} pdfPreviewPath={`${apiPath}/pdf-preview`} />}
                </div>
              </li>;
            })}
          </ul>
        </section>
      </div>}
    </AdminLayout>
  );
}

export function EventMaterialsPage() {
  const { id = "" } = useParams<{ id: string }>();
  const location = useLocation();
  if (location.pathname.endsWith("/recordings")) return <Navigate replace to={`/admin/events/${id}/materials${location.search}`} />;
  return <MaterialWorkspace key={id} eventId={id} />;
}
