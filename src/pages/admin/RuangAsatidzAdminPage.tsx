import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useGetIdentity } from "@refinedev/core";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import type { AuthIdentity } from "@/lib/refine/authProvider";
import {
  ruangApi, categoryLabels, statusLabels, publicationLabels,
  type Greeting, type PageResult, type ThreadDetail, type ThreadReply,
  type ThreadSummary, type RuangCategory, type RuangStatus,
} from "@/lib/ruangAsatidz";

const ROOT = "/admin/ruang-asatidz";
const control = "inline-flex min-h-[44px] items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50";
const button = `${control} border-slate-300 bg-white text-slate-800 hover:bg-slate-100`;
const primary = `${control} border-emerald-800 bg-emerald-800 text-white hover:bg-emerald-900`;
const field = "min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700 disabled:opacity-50";
const card = "rounded-xl border border-slate-200 bg-white p-4 sm:p-6";
const date = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
};
const message = (error: unknown) => error instanceof Error ? error.message : "Permintaan gagal. Periksa koneksi dan coba lagi.";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Alert({ children }: { children: React.ReactNode }) {
  return <div role="alert" className="my-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">{children}</div>;
}

/** Reads are abortable and generation-guarded, including refreshes after mutations. */
function useResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const request = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const reload = useCallback(async (refresh = false) => {
    if (!path) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const generation = ++request.current;
    setLoading(true);
    if (refresh) setRefreshError(""); else setError("");
    try {
      const result = await ruangApi<T>(path, { signal: abort.signal, cache: "no-store" });
      if (generation !== request.current || abort.signal.aborted) return;
      setData(result);
      setError("");
      setRefreshError("");
    } catch (failure) {
      if (generation !== request.current || abort.signal.aborted) return;
      if (refresh) setRefreshError(message(failure)); else setError(message(failure));
    } finally {
      if (generation === request.current && !abort.signal.aborted) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    setData(null);
    setError("");
    setRefreshError("");
    void reload();
    return () => { ++request.current; controller.current?.abort(); };
  }, [reload]);
  return { data, setData, loading, error, refreshError, reload };
}

/** A synchronous lock prevents double clicks before React commits busy state. */
function useMutation() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const generation = useRef(0);
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; ++generation.current; };
  }, []);
  async function run<T>(operation: () => Promise<T>, onSuccess: (result: T) => void | Promise<void>) {
    if (lock.current || !alive.current) return;
    lock.current = true;
    const current = generation.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await operation();
      if (alive.current && current === generation.current) await onSuccess(result);
    } catch (failure) {
      if (alive.current && current === generation.current) setError(message(failure));
    } finally {
      if (alive.current && current === generation.current) { lock.current = false; setBusy(false); }
    }
  }
  return { busy, error, notice, setNotice, setError, run };
}

function Pagination({ meta, loading, onPage }: { meta: PageResult<unknown>["meta"]; loading: boolean; onPage: (page: number) => void }) {
  return <nav aria-label="Navigasi halaman daftar" className="mt-4 flex flex-wrap items-center justify-between gap-3">
    <p className="text-sm text-slate-600">{meta.total} item · Halaman {meta.page} dari {Math.max(1, meta.totalPages)}</p>
    <div className="flex gap-2">
      <button type="button" className={button} disabled={loading || meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Sebelumnya</button>
      <button type="button" className={button} disabled={loading || meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>Berikutnya</button>
    </div>
  </nav>;
}

function ResourceErrors({ resource }: { resource: { error: string; refreshError: string; loading: boolean; reload: (refresh?: boolean) => Promise<void> } }) {
  return <>
    {resource.error && <Alert>{resource.error} <button type="button" className={`${button} ml-2`} disabled={resource.loading} onClick={() => void resource.reload()}>Coba muat lagi</button></Alert>}
    {resource.refreshError && <Alert>Data terbaru belum berhasil dimuat: {resource.refreshError} Perubahan yang telah berhasil disimpan tidak perlu dikirim ulang. <button type="button" className={`${button} mt-2`} disabled={resource.loading} onClick={() => void resource.reload(true)}>Muat data terbaru</button></Alert>}
  </>;
}

function Inbox({ moderation, followUp }: { moderation: boolean; followUp: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const rawCategory = query.get("category");
  const rawStatus = query.get("status");
  const category = moderation ? "EXPERIENCE" : rawCategory && Object.prototype.hasOwnProperty.call(categoryLabels, rawCategory) ? rawCategory as RuangCategory : "";
  const status = rawStatus && Object.prototype.hasOwnProperty.call(statusLabels, rawStatus) ? rawStatus as RuangStatus : rawStatus === "ALL" ? "" : followUp ? "IN_PROGRESS" : "";
  const rawPage = Number(query.get("page") || "1");
  const page = Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 100000 ? rawPage : 1;
  const selectedId = query.get("thread") || "";
  const params = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (category) params.set("category", category);
  if (status) params.set("status", status);
  const list = useResource<PageResult<ThreadSummary>>(`${ROOT}/threads?${params}`);
  function change(values: Record<string, string | null>) {
    const next = new URLSearchParams(location.search);
    for (const [key, value] of Object.entries(values)) { if (value) next.set(key, value); else next.delete(key); }
    navigate({ pathname: location.pathname, search: next.toString() });
  }
  return <div className="space-y-5">
    <section className={card} aria-labelledby="inbox-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="inbox-title" className="text-lg font-bold text-slate-900">{moderation ? "Moderasi pengalaman" : followUp ? "Tindak lanjut" : "Kotak masuk pribadi"}</h2>
        <button type="button" className={button} disabled={list.loading} onClick={() => void list.reload(Boolean(list.data))}>Muat ulang daftar</button>
      </div>
      {moderation && <p className="mt-2 text-sm leading-6 text-slate-600">Daftar seluruh pengalaman, termasuk pribadi, menunggu moderasi, dipublikasikan, dan disembunyikan. Jumlah dan pagination mencakup semua status publikasi, bukan hanya yang menunggu moderasi.</p>}
      <div className="my-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">Kategori
          <select className={`${field} mt-1`} value={category} disabled={moderation} onChange={event => change({ category: event.target.value, page: null, thread: null })}>
            <option value="">Semua kategori</option>
            {(Object.keys(categoryLabels) as RuangCategory[]).map(value => <option key={value} value={value}>{categoryLabels[value]}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">Status tindak lanjut
          <select className={`${field} mt-1`} value={status} onChange={event => change({ status: event.target.value || "ALL", page: null, thread: null })}>
            <option value="">Semua status</option>
            {(Object.keys(statusLabels) as RuangStatus[]).map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}
          </select>
        </label>
      </div>
      <ResourceErrors resource={list} />
      {list.loading && <p role="status" className="py-3 text-sm text-slate-600">Memuat kotak masuk…</p>}
      {list.data && <>
        {list.data.data.length === 0 && <p className="py-6 text-center text-slate-600">Tidak ada percakapan pada halaman dan filter ini.</p>}
        <ul className="divide-y divide-slate-200">
          {list.data.data.map(thread => <li key={thread.id}>
            <button type="button" aria-pressed={selectedId === thread.id} className={`min-h-[44px] w-full rounded-lg p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 ${selectedId === thread.id ? "bg-emerald-50" : "hover:bg-slate-50"}`} onClick={() => change({ thread: thread.id })}>
              <span className="block break-words font-semibold text-slate-900">{thread.subject}</span>
              <span className="mt-1 block text-sm text-slate-600">{thread.authorName || "Asatidz"} · {date(thread.createdAt)}</span>
              <span className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded bg-slate-100 px-2 py-1 text-slate-800">{categoryLabels[thread.category]}</span>
                <span className="rounded bg-blue-50 px-2 py-1 text-blue-900">{statusLabels[thread.status]}</span>
                {thread.category === "EXPERIENCE" && <span className="rounded bg-amber-50 px-2 py-1 text-amber-900">{publicationLabels[thread.publicationStatus]} · {thread.shareExperience ? "Setuju berbagi" : "Tanpa persetujuan berbagi"}</span>}
              </span>
            </button>
          </li>)}
        </ul>
        <Pagination meta={list.data.meta} loading={list.loading} onPage={value => change({ page: String(value), thread: null })} />
      </>}
    </section>
    {selectedId && (uuid.test(selectedId)
      ? <ThreadPanel key={selectedId} id={selectedId} close={() => change({ thread: null })} refreshList={() => list.reload(true)} />
      : <Alert>ID percakapan tidak valid. <button type="button" className={button} onClick={() => change({ thread: null })}>Tutup detail</button></Alert>)}
  </div>;
}

function ThreadPanel({ id, close, refreshList }: { id: string; close: () => void; refreshList: () => Promise<void> }) {
  const panelRef = useRef<HTMLElement>(null);
  const resource = useResource<ThreadDetail>(`${ROOT}/threads/${id}`);
  const mutation = useMutation();
  const [draftStatus, setDraftStatus] = useState<RuangStatus>("NEW");
  const [reply, setReply] = useState("");
  const thread = resource.data;
  useEffect(() => { panelRef.current?.focus(); }, []);
  useEffect(() => { if (thread) setDraftStatus(thread.status); }, [thread?.status]);
  const disabled = mutation.busy || resource.loading;
  async function update(input: { status?: RuangStatus; publicationStatus?: "PUBLISHED" | "HIDDEN" }, success: string) {
    await mutation.run(() => ruangApi<ThreadSummary>(`${ROOT}/threads/${id}`, { method: "PATCH", body: JSON.stringify(input) }), async saved => {
      resource.setData(previous => previous ? { ...previous, ...saved } : previous);
      mutation.setNotice(success);
      await Promise.all([resource.reload(true), refreshList()]);
    });
  }
  function sendReply(event: React.FormEvent) {
    event.preventDefault();
    if (!thread || disabled || thread.status === "CLOSED") return;
    const body = reply.trim();
    if (body.length < 2 || body.length > 5000) { mutation.setError("Balasan harus berisi 2–5.000 karakter."); return; }
    void mutation.run(() => ruangApi<ThreadReply>(`${ROOT}/threads/${id}/replies`, { method: "POST", body: JSON.stringify({ body }) }), async saved => {
      resource.setData(previous => previous ? { ...previous, replies: [...previous.replies, saved] } : previous);
      setReply("");
      mutation.setNotice("Balasan YTS berhasil dikirim secara pribadi. Status tindak lanjut tidak berubah otomatis.");
      await Promise.all([resource.reload(true), refreshList()]);
    });
  }
  return <section ref={panelRef} tabIndex={-1} className={`${card} focus:outline-none focus:ring-2 focus:ring-emerald-700`} aria-labelledby="thread-title" aria-busy={resource.loading || mutation.busy}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="thread-title" className="text-lg font-bold text-slate-900">Detail percakapan pribadi</h2>
      <div className="flex gap-2"><button type="button" className={button} disabled={disabled} onClick={() => void resource.reload(Boolean(thread))}>Muat ulang detail</button><button type="button" className={button} onClick={close}>Tutup detail</button></div>
    </div>
    <ResourceErrors resource={resource} />
    {resource.loading && <p role="status" className="my-3 text-sm text-slate-600">Memuat percakapan…</p>}
    {mutation.error && <Alert>{mutation.error}</Alert>}
    {mutation.notice && <p role="status" className="my-3 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">{mutation.notice}</p>}
    {thread && <div className="mt-4 space-y-5">
      <div>
        <h3 className="break-words text-xl font-bold text-slate-900">{thread.subject}</h3>
        <p className="mt-2 break-words text-sm text-slate-600">Pengirim: {thread.authorName || "Asatidz"}{thread.authorEmail ? ` · ${thread.authorEmail}` : ""}</p>
        <p className="mt-1 text-sm text-slate-600">{categoryLabels[thread.category]} · {statusLabels[thread.status]} · {date(thread.createdAt)}</p>
        <p className="mt-4 whitespace-pre-wrap break-words leading-7 text-slate-800">{thread.body}</p>
      </div>
      <form className="rounded-lg bg-slate-50 p-4" onSubmit={event => { event.preventDefault(); if (!disabled && draftStatus !== thread.status) void update({ status: draftStatus }, "Status tindak lanjut berhasil disimpan."); }}>
        <label htmlFor="thread-status" className="block text-sm font-semibold text-slate-800">Status tindak lanjut</label>
        <div className="mt-2 flex flex-wrap gap-3">
          <select id="thread-status" className={`${field} sm:w-auto`} value={draftStatus} disabled={disabled} onChange={event => setDraftStatus(event.target.value as RuangStatus)}>
            {(Object.keys(statusLabels) as RuangStatus[]).map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}
          </select>
          <button type="submit" className={primary} disabled={disabled || draftStatus === thread.status}>Simpan status</button>
        </div>
        <p className="mt-2 text-sm text-slate-600">Membaca atau membalas tidak mengubah status secara otomatis. Perubahan berlaku setelah disimpan.</p>
      </form>
      {thread.category === "EXPERIENCE" && <section className="rounded-lg border border-amber-200 bg-amber-50 p-4" aria-labelledby="publication-title">
        <h3 id="publication-title" className="font-bold text-amber-950">Publikasi pengalaman: {publicationLabels[thread.publicationStatus]}</h3>
        <p className="mt-2 text-sm leading-6 text-amber-950">{thread.shareExperience ? "Pengirim menyetujui berbagi cerita beserta nama di papan pengalaman. Email, identitas akun internal, dan balasan pribadi tidak dipublikasikan. Tinjau isi cerita untuk menjaga privasi sebelum menerbitkan." : "Pengirim tidak menyetujui berbagi. Pengalaman ini tetap pribadi dan tidak dapat dipublikasikan atau dimoderasi."}</p>
        {thread.shareExperience && <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" className={primary} disabled={disabled || thread.publicationStatus === "PUBLISHED"} onClick={() => { if (window.confirm("Publikasikan cerita dan nama pengirim di papan pengalaman sesuai persetujuannya? Balasan pribadi dan email tidak akan dibagikan.")) void update({ publicationStatus: "PUBLISHED" }, "Pengalaman berhasil dipublikasikan di papan."); }}>Publikasikan pengalaman</button>
          <button type="button" className={button} disabled={disabled || thread.publicationStatus === "HIDDEN"} onClick={() => void update({ publicationStatus: "HIDDEN" }, "Pengalaman berhasil disembunyikan dari papan.")}>Sembunyikan dari papan</button>
        </div>}
      </section>}
      <section aria-labelledby="reply-list-title">
        <h3 id="reply-list-title" className="font-bold text-slate-900">Balasan pribadi</h3>
        <p className="mt-1 text-sm text-slate-600">Hanya pengirim dan pengelola YTS yang dapat membaca percakapan ini. Balasan tidak masuk papan pengalaman.</p>
        {thread.replies.length === 0 && <p className="mt-3 text-sm text-slate-600">Belum ada balasan.</p>}
        <ol className="mt-3 space-y-3">
          {thread.replies.map(item => <li key={item.id} className={`rounded-lg border p-4 ${item.authorRole === "YTS" ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
            <p className="text-sm font-bold text-slate-800">{item.authorRole === "YTS" ? "YTS" : item.authorName || "Asatidz"} <span className="font-normal text-slate-600">· {date(item.createdAt)}</span></p>
            <p className="mt-2 whitespace-pre-wrap break-words leading-7 text-slate-800">{item.body}</p>
          </li>)}
        </ol>
      </section>
      {thread.status === "CLOSED" && <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-950">Percakapan ditutup. Untuk membalas, pilih status lain dan tekan “Simpan status” terlebih dahulu.</p>}
      <form onSubmit={sendReply} className="space-y-3">
        <label htmlFor="admin-reply" className="block text-sm font-semibold text-slate-800">Balasan sebagai YTS (pribadi)</label>
        <textarea id="admin-reply" className={field} rows={5} minLength={2} maxLength={5000} required value={reply} disabled={disabled || thread.status === "CLOSED"} onChange={event => setReply(event.target.value)} aria-describedby="reply-help" />
        <p id="reply-help" className="text-sm text-slate-600">2–5.000 karakter · {reply.length}/5.000. Status tindak lanjut disimpan terpisah.</p>
        <button type="submit" className={primary} disabled={disabled || thread.status === "CLOSED" || reply.trim().length < 2}>{mutation.busy ? "Menyimpan…" : "Kirim balasan pribadi"}</button>
      </form>
    </div>}
  </section>;
}

function Greetings() {
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Greeting | null>(null);
  const [editorVersion, setEditorVersion] = useState(0);
  const list = useResource<PageResult<Greeting>>(`${ROOT}/greetings?page=${page}&pageSize=20`);
  // Hide an old page while its replacement is loading.
  const currentPage = list.data?.meta.page === page ? list.data : null;
  function createNew() { setEditing(null); setEditorVersion(value => value + 1); }
  return <div className="grid gap-5 xl:grid-cols-2">
    <section className={card} aria-labelledby="greetings-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="greetings-title" className="text-lg font-bold text-slate-900">Sapaan YTS</h2>
        <button type="button" className={button} disabled={list.loading} onClick={() => void list.reload(Boolean(list.data))}>Muat ulang sapaan</button>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">Daftar mencakup draf dan sapaan terbit. Hanya sapaan yang dipublikasikan terlihat di portal asatidz.</p>
      <ResourceErrors resource={list} />
      {list.loading && <p role="status" className="my-3 text-sm text-slate-600">Memuat sapaan…</p>}
      {currentPage && <>
        {currentPage.data.length === 0 && <p className="my-6 text-slate-600">Belum ada sapaan pada halaman ini.</p>}
        <ul className="mt-3 divide-y divide-slate-200">
          {currentPage.data.map(greeting => <li key={greeting.id} className="space-y-2 py-4">
            <h3 className="break-words font-bold text-slate-900">{greeting.title}</h3>
            <p className="text-xs font-semibold text-slate-600">{greeting.isPublished ? "Dipublikasikan" : "Draf"} · Diperbarui {date(greeting.updatedAt)}</p>
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{greeting.body}</p>
            <button type="button" className={button} aria-label={`Edit sapaan: ${greeting.title}`} onClick={() => { setEditing(greeting); setEditorVersion(value => value + 1); }}>Edit sapaan</button>
          </li>)}
        </ul>
        <Pagination meta={currentPage.meta} loading={list.loading} onPage={setPage} />
      </>}
    </section>
    <GreetingForm key={`${editorVersion}:${page}`} greeting={editing} onNew={createNew} onSaved={saved => { setEditing(saved); return list.reload(true); }} />
  </div>;
}

function GreetingForm({ greeting, onNew, onSaved }: { greeting: Greeting | null; onNew: () => void; onSaved: (greeting: Greeting) => Promise<void> }) {
  const [savedId, setSavedId] = useState(greeting?.id || "");
  const [title, setTitle] = useState(greeting?.title || "");
  const [body, setBody] = useState(greeting?.body || "");
  const [published, setPublished] = useState(greeting?.isPublished || false);
  const mutation = useMutation();
  function save(event: React.FormEvent) {
    event.preventDefault();
    if (mutation.busy) return;
    const input = { title: title.trim(), body: body.trim(), isPublished: published };
    if (input.title.length < 5 || input.title.length > 160 || input.body.length < 10 || input.body.length > 5000) {
      mutation.setError("Judul harus 5–160 karakter dan isi sapaan 10–5.000 karakter.");
      return;
    }
    void mutation.run(() => ruangApi<Greeting>(`${ROOT}/greetings${savedId ? `/${savedId}` : ""}`, { method: savedId ? "PATCH" : "POST", body: JSON.stringify(input) }), async saved => {
      // Preserve the returned ID even if refreshing the list fails: another save
      // edits this greeting rather than accidentally creating a duplicate.
      setSavedId(saved.id);
      setTitle(saved.title);
      setBody(saved.body);
      setPublished(saved.isPublished);
      mutation.setNotice(saved.isPublished ? "Sapaan berhasil disimpan dan dipublikasikan." : "Draf sapaan berhasil disimpan.");
      await onSaved(saved);
    });
  }
  return <section className={`${card} h-fit`} aria-labelledby="greeting-editor-title">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="greeting-editor-title" className="text-lg font-bold text-slate-900">{savedId ? "Edit sapaan" : "Buat sapaan"}</h2>
      <button type="button" className={button} disabled={mutation.busy} onClick={onNew}>Buat sapaan baru</button>
    </div>
    {mutation.error && <Alert>{mutation.error}</Alert>}
    {mutation.notice && <p role="status" className="my-3 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">{mutation.notice}</p>}
    <form onSubmit={save} className="mt-4 space-y-4" aria-busy={mutation.busy}>
      <label className="block text-sm font-semibold text-slate-800" htmlFor="greeting-title">Judul sapaan (5–160 karakter)</label>
      <input id="greeting-title" className={field} value={title} onChange={event => setTitle(event.target.value)} minLength={5} maxLength={160} required disabled={mutation.busy} />
      <label className="block text-sm font-semibold text-slate-800" htmlFor="greeting-body">Isi sapaan (10–5.000 karakter)</label>
      <textarea id="greeting-body" className={field} rows={9} value={body} onChange={event => setBody(event.target.value)} minLength={10} maxLength={5000} required disabled={mutation.busy} />
      <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-semibold text-slate-800">
        <input type="checkbox" className="h-5 w-5 accent-emerald-700" checked={published} onChange={event => setPublished(event.target.checked)} disabled={mutation.busy} />Publikasikan sapaan di portal
      </label>
      <p className="text-sm leading-6 text-slate-600">Jika tidak dicentang, sapaan disimpan sebagai draf. Sapaan terbit dapat dibaca asatidz; jangan cantumkan isi percakapan pribadi atau data kontak tanpa persetujuan.</p>
      <button type="submit" className={primary} disabled={mutation.busy || title.trim().length < 5 || body.trim().length < 10}>{mutation.busy ? "Menyimpan…" : "Simpan sapaan"}</button>
    </form>
  </section>;
}

export const RuangAsatidzAdminPage: React.FC = () => {
  const location = useLocation();
  const { data: identity, isLoading } = useGetIdentity<AuthIdentity>();
  const canManage = identity?.assignments.some(assignment =>
    ["SUPER_ADMIN", "SYSTEM_ADMIN"].includes(assignment.roleCode) && !assignment.eventId && !assignment.institutionId,
  ) ?? false;
  const path = location.pathname.replace(/\/$/, "");
  const greetings = path === `${ROOT}/sapaan`;
  const moderation = path === `${ROOT}/moderasi`;
  const followUp = path === `${ROOT}/tindak-lanjut`;
  const supported = path === ROOT || greetings || moderation || followUp;
  const tabs = [{ href: ROOT, label: "Kotak masuk" }, { href: `${ROOT}/moderasi`, label: "Moderasi pengalaman" }, { href: `${ROOT}/tindak-lanjut`, label: "Tindak lanjut" }, { href: `${ROOT}/sapaan`, label: "Sapaan YTS" }];
  return <AdminLayout>
    <PageHeader title="Ruang Asatidz" description="Dengarkan aspirasi asatidz, balas secara pribadi, dan kelola sapaan Yayasan Tarbiyah Sunnah." breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Ruang Asatidz" }]} />
    {isLoading ? <p role="status" className={card}>Memeriksa akses pengelola…</p> : !canManage ? <div role="alert" className={card}><h2 className="font-bold text-slate-900">Akses pengelola diperlukan</h2><p className="mt-2 text-slate-600">Percakapan pribadi hanya dapat dikelola oleh Super Admin atau System Admin dengan izin global Ruang Asatidz. Petugas event atau lembaga tidak memiliki akses kotak masuk ini.</p></div> : <>
      <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950"><strong>Jaga amanah dan privasi.</strong> Pesan dan balasan hanya untuk pengirim dan pengelola YTS. Hanya cerita pengalaman dengan persetujuan berbagi yang boleh dipublikasikan; email dan balasan tidak tampil di papan pengalaman.</div>
      <nav aria-label="Bagian Ruang Asatidz" className="mb-5 flex flex-wrap gap-2">
        {tabs.map(tab => <Link key={tab.href} to={tab.href} aria-current={path === tab.href ? "page" : undefined} className={path === tab.href ? primary : button}>{tab.label}</Link>)}
      </nav>
      {!supported ? <Alert>Bagian Ruang Asatidz tidak ditemukan.</Alert> : greetings ? <Greetings key={`${identity?.id || identity?.email}:${path}`} /> : <Inbox key={`${identity?.id || identity?.email}:${path}:${location.search}`} moderation={moderation} followUp={followUp} />}
    </>}
  </AdminLayout>;
};