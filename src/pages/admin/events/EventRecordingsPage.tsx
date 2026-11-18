import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { EventWorkspaceNav } from "@/components/admin/events/EventWorkspaceNav";
import { PageHeader } from "@/components/common/PageHeader";
import { RecordingPlayer } from "@/components/common/RecordingPlayer";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EventApiError, eventApi } from "@/lib/eventApi";
import { parseRecordingSource, RECORDING_TITLE_MAX, RECORDING_URL_ERROR, RECORDING_URL_MAX,
  type EventRecording, type RecordingEvent } from "@/lib/eventRecording";

type RecordingsData = { event: RecordingEvent; recordings: EventRecording[] };

const emptyForm = { title: "", url: "", published: false };
const button = "inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton = `${button} border border-slate-500 bg-white text-slate-800 hover:bg-slate-50`;
const field = "min-h-11 w-full min-w-0 rounded-lg border border-slate-500 bg-white px-3 text-base text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";

function RecordingWorkspace({ eventId }: { eventId: string }) {
  const apiPath = `/events/${encodeURIComponent(eventId)}/recordings`;
  const [data, setData] = useState<RecordingsData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [denied, setDenied] = useState(false);
  const [revision, setRevision] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [values, setValues] = useState(emptyForm);
  const [showPreview, setShowPreview] = useState(false);
  const [urlTouched, setUrlTouched] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const formId = useId();
  const source = parseRecordingSource(values.url);
  const invalidUrl = urlTouched && !!values.url.trim() && !source;

  useEffect(() => {
    const controller = new AbortController();
    setLoadError("");
    void eventApi<RecordingsData>(apiPath, { signal: controller.signal, cache: "no-store" }).then((next) => {
      if (!controller.signal.aborted) setData(next);
    }).catch((error) => {
      if (controller.signal.aborted) return;
      const noAccess = error instanceof EventApiError && error.status === 403;
      setDenied(noAccess);
      setLoadError(noAccess ? "Akun Anda tidak memiliki izin mengelola rekaman event ini."
        : error instanceof Error ? error.message : "Daftar rekaman gagal dimuat.");
    });
    return () => controller.abort();
  }, [apiPath, revision]);

  useEffect(() => { if (notice) titleRef.current?.focus(); }, [notice]);

  const reset = (recording?: EventRecording) => {
    setEditingId(recording?.id || null);
    setValues(recording ? { title: recording.title, url: recording.url, published: recording.published } : emptyForm);
    setShowPreview(false);
    setUrlTouched(false);
    setSaveError("");
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setNotice("");
    if (!values.title.trim() || !source) {
      setUrlTouched(true);
      setSaveError(!values.title.trim() ? "Isi judul rekaman." : RECORDING_URL_ERROR);
      return;
    }

    setSaving(true);
    setSaveError("");
    try {
      const saved = await eventApi<EventRecording>(editingId ? `${apiPath}/${editingId}` : apiPath, {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify({ ...values, title: values.title.trim(), url: source.url }),
      });
      setData((current) => current && { ...current, recordings: editingId
        ? current.recordings.map((item) => item.id === saved.id ? saved : item)
        : [...current.recordings, saved] });
      reset();
      setNotice(saved.published ? "Rekaman dibagikan kepada peserta yang berhak." : "Rekaman tersimpan sebagai draf.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Rekaman gagal disimpan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <PageHeader title="Rekaman event" description={data?.event.name}
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Event", href: "/admin/events" },
          { label: "Ringkasan event", href: `/admin/events/${eventId}` }, { label: "Rekaman" }]} />
      <EventWorkspaceNav eventId={eventId} />
      {loadError && <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
        <p role="alert">{loadError}</p>
        {!denied && <button type="button" className={`${secondaryButton} mt-3`} onClick={() => setRevision((value) => value + 1)}>Coba lagi</button>}
      </div>}
      {!loadError && !data && <p role="status" className="text-sm text-slate-700">Memuat rekaman event…</p>}
      {data && <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form onSubmit={save} aria-labelledby={`${formId}-heading`} aria-busy={saving}
          className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
          <h2 id={`${formId}-heading`} className="mb-4 text-lg font-bold text-slate-950">{editingId ? "Edit rekaman" : "Tambah rekaman"}</h2>
          <fieldset disabled={saving} className="min-w-0 space-y-4">
            <label className="block text-sm font-semibold text-slate-800">
              Judul rekaman
              <input ref={titleRef} className={`${field} mt-1`} required maxLength={RECORDING_TITLE_MAX}
                value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} />
            </label>
            <div>
              <label htmlFor={`${formId}-url`} className="block text-sm font-semibold text-slate-800">Tautan video</label>
              <input id={`${formId}-url`} className={`${field} mt-1`} type="url" required maxLength={RECORDING_URL_MAX}
                placeholder="https://…" value={values.url} aria-describedby={`${formId}-url-hint`} aria-invalid={invalidUrl || undefined}
                onBlur={() => setUrlTouched(true)} onChange={(event) => {
                  setValues({ ...values, url: event.target.value });
                  setShowPreview(false);
                }} />
              <p id={`${formId}-url-hint`} className={`mt-2 text-sm ${invalidUrl ? "text-rose-800" : "text-slate-700"}`}>
                {invalidUrl ? RECORDING_URL_ERROR : "Tempel tautan video YouTube atau file video Google Drive."}
              </p>
              {source && <>
                <button type="button" className={`${secondaryButton} mt-3`} aria-expanded={showPreview} aria-controls={`${formId}-preview`}
                  onClick={() => setShowPreview(!showPreview)}>
                  {showPreview ? "Tutup pratinjau" : `Pratinjau ${source.provider}`}
                </button>
                <div id={`${formId}-preview`}>{showPreview && <RecordingPlayer source={source} title={values.title.trim() || "rekaman event"} />}</div>
              </>}
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-slate-800">
              <input type="checkbox" className="h-5 w-5 shrink-0 accent-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                checked={values.published} onChange={(event) => setValues({ ...values, published: event.target.checked })} />
              Bagikan di Portal Asatidz
            </label>
            <p className="text-sm leading-6 text-slate-700">Pastikan peserta memiliki akses ke file di Google Drive atau video di YouTube.</p>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={`${button} bg-emerald-800 text-white hover:bg-emerald-900`}>
                {saving ? "Menyimpan…" : values.published ? "Simpan dan bagikan" : "Simpan draf"}
              </button>
              {editingId && <button type="button" className={secondaryButton} onClick={() => { reset(); titleRef.current?.focus(); }}>Batal edit</button>}
            </div>
          </fieldset>
          {saveError && <p role="alert" className="mt-4 text-sm font-semibold text-rose-800">{saveError}</p>}
          {notice && <p role="status" className="mt-4 text-sm font-semibold text-emerald-800">{notice}</p>}
        </form>

        <section aria-labelledby={`${formId}-saved`} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
          <h2 id={`${formId}-saved`} className="text-lg font-bold text-slate-950">Rekaman tersimpan</h2>
          {data.recordings.length === 0 ? <p className="mt-3 text-sm text-slate-700">Belum ada rekaman untuk event ini.</p> :
            <ul className="mt-2 divide-y divide-slate-200">
              {data.recordings.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-slate-950 [overflow-wrap:anywhere]">{item.title}</h3>
                    <p className="my-1 text-sm text-slate-700">{parseRecordingSource(item.url)?.provider}</p>
                    <StatusBadge label={item.published ? "Dibagikan" : "Draf"} variant={item.published ? "success" : "neutral"} />
                  </div>
                  <button type="button" className={secondaryButton} disabled={saving} aria-label={`Edit ${item.title}`}
                    onClick={() => { reset(item); setNotice(""); titleRef.current?.focus(); }}>Edit</button>
                </li>
              ))}
            </ul>}
        </section>
      </div>}
    </AdminLayout>
  );
}

export function EventRecordingsPage() {
  const { id = "" } = useParams<{ id: string }>();
  return <RecordingWorkspace key={id} eventId={id} />;
}
