import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { PageHeader } from "@/components/common/PageHeader";
import {
  ruangApi, categoryLabels, statusLabels, publicationLabels,
  type RuangCategory, type PageResult, type ThreadSummary,
  type ThreadDetail, type Greeting, type BoardExperience,
} from "@/lib/ruangAsatidz";

const ROOT = "/portal/ruang-asatidz";
const control = "inline-flex min-h-[44px] items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50";
const button = `${control} border-slate-300 bg-white text-slate-800 hover:bg-slate-50`;
const primary = `${control} border-emerald-800 bg-emerald-800 text-white hover:bg-emerald-900`;
const field = "min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-60";
const card = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6";
const tabs = [
  { path: "", label: "Disapa" }, { path: "/saran", label: "Saran" },
  { path: "/pengalaman", label: "Pengalaman" }, { path: "/kebutuhan", label: "Kebutuhan" },
  { path: "/pesan", label: "Pesan Saya" }, { path: "/terhubung", label: "Terhubung" },
];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Permintaan belum dapat diproses. Silakan coba lagi.";
}
function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Tanggal tidak tersedia" : new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium", timeStyle: "short",
  }).format(date);
}
function Body({ children }: { children: ReactNode }) {
  return <div className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700 [overflow-wrap:anywhere]">{children}</div>;
}
function Notice({ children }: { children: ReactNode }) {
  return <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">{children}</div>;
}
function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert" className="space-y-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">
    <p>{message}</p><button type="button" className={button} onClick={retry}>Coba muat ulang</button>
  </div>;
}

// Keyed result prevents even a single render of another route/filter's private data.
function useResource<T>(path: string, refresh = 0) {
  const key = `${path}:${refresh}`;
  const [state, setState] = useState<{ key: string; data?: T; error?: string; loading: boolean }>({ key, loading: true });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState({ key, loading: true });
    void ruangApi<T>(path, { signal: controller.signal }).then(
      (data) => { if (active) setState({ key, data, loading: false }); },
      (error: unknown) => { if (active && !controller.signal.aborted) setState({ key, error: errorMessage(error), loading: false }); },
    );
    return () => { active = false; controller.abort(); };
  }, [path, key, attempt]);
  return { ...(state.key === key ? state : { key, loading: true }), retry: () => setAttempt((value) => value + 1) };
}

function positiveInteger(value: string | null, fallback: number, max = Number.MAX_SAFE_INTEGER) {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? Math.min(number, max) : fallback;
}
function usePagination(prefix = "") {
  const [params, setParams] = useSearchParams();
  const pageKey = prefix ? `${prefix}Page` : "page";
  const sizeKey = prefix ? `${prefix}PageSize` : "pageSize";
  const page = positiveInteger(params.get(pageKey), 1);
  const pageSize = positiveInteger(params.get(sizeKey), 20, 50);
  function change(name: string, value: string) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(name, value); else next.delete(name);
      if (name !== pageKey) next.set(pageKey, "1");
      return next;
    });
  }
  return { params, page, pageSize, change, pageKey, sizeKey };
}
type Pagination = ReturnType<typeof usePagination>;
function Pager({ meta, pagination, busy }: { meta?: PageResult<unknown>["meta"]; pagination: Pagination; busy: boolean }) {
  return <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
    <label className="flex items-center gap-2 text-sm text-slate-700">Per halaman
      <select className={`${field} w-auto`} value={pagination.pageSize} onChange={(event) => pagination.change(pagination.sizeKey, event.target.value)}>
        {Array.from(new Set([10, 20, 50, pagination.pageSize])).sort((a, b) => a - b).map((size) => <option key={size} value={size}>{size}</option>)}
      </select>
    </label>
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-slate-600">{meta ? `${meta.total} item · Halaman ${meta.page} dari ${Math.max(1, meta.totalPages)}` : "Memuat halaman…"}</span>
      <button type="button" className={button} disabled={busy || !meta || meta.page <= 1} onClick={() => pagination.change(pagination.pageKey, String(Math.max(1, (meta?.page ?? 1) - 1)))}>Sebelumnya</button>
      <button type="button" className={button} disabled={busy || !meta || meta.page >= meta.totalPages} onClick={() => pagination.change(pagination.pageKey, String((meta?.page ?? 1) + 1))}>Berikutnya</button>
    </div>
  </div>;
}

function ThreadBadges({ thread }: { thread: ThreadSummary }) {
  return <div className="flex flex-wrap gap-2 text-xs font-semibold">
    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{categoryLabels[thread.category]}</span>
    <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-900">{statusLabels[thread.status]}</span>
    <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-950">{publicationLabels[thread.publicationStatus]}</span>
  </div>;
}

function MyThreads({ summary = false, refresh = 0 }: { summary?: boolean; refresh?: number }) {
  const pagination = usePagination();
  const rawCategory = pagination.params.get("category") ?? "";
  const rawStatus = pagination.params.get("status") ?? "";
  const category = Object.hasOwn(categoryLabels, rawCategory) ? rawCategory : "";
  const status = Object.hasOwn(statusLabels, rawStatus) ? rawStatus : "";
  const query = new URLSearchParams({ page: String(pagination.page), pageSize: String(pagination.pageSize) });
  if (!summary && category) query.set("category", category);
  if (!summary && status) query.set("status", status);
  const result = useResource<PageResult<ThreadSummary>>(`/ruang-asatidz/threads?${query}`, refresh);
  return <section className={card} aria-labelledby="my-threads-title" aria-busy={result.loading}>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="my-threads-title" className="text-lg font-bold text-slate-900">{summary ? "Kabar pesan saya" : "Riwayat pesan saya"}</h2>
        <p className="mt-1 text-sm text-slate-600">{summary ? "Pantau pesan dan tindak lanjut YTS di ruang pribadi Anda." : "Semua saran, pengalaman, kebutuhan, dan pertanyaan Anda."}</p></div>
      {summary && <Link className={button} to={`${ROOT}/pesan`}>Buka Pesan Saya</Link>}
    </div>
    {!summary && <div className="mb-5 grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-sm font-medium">Kategori<select className={field} value={category} onChange={(event) => pagination.change("category", event.target.value)}>
        <option value="">Semua kategori</option>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label className="space-y-1 text-sm font-medium">Status<select className={field} value={status} onChange={(event) => pagination.change("status", event.target.value)}>
        <option value="">Semua status</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
    </div>}
    {result.loading && <p role="status" className="py-6 text-sm text-slate-600">Memuat pesan Anda…</p>}
    {result.error && <LoadError message={result.error} retry={result.retry} />}
    {result.data && <>
      {summary && <p className="mb-4 text-sm font-semibold text-emerald-900">{result.data.meta.total} pesan tercatat · {result.data.data.length} ditampilkan pada halaman ini</p>}
      {result.data.data.length === 0 ? <p className="rounded-lg bg-slate-50 p-5 text-sm text-slate-600">{summary ? "Belum ada pesan. Mulai dengan saran, pengalaman, kebutuhan, atau pertanyaan Anda." : "Tidak ada pesan pada halaman atau filter ini."}</p> :
        <ul className="space-y-3">{result.data.data.map((thread) => <li key={thread.id} className="rounded-lg border border-slate-200 p-4">
          <ThreadBadges thread={thread} />
          <Link to={`${ROOT}/pesan/${encodeURIComponent(thread.id)}`} className="mt-2 flex min-h-[44px] items-center break-words rounded-md font-bold text-slate-900 hover:text-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 [overflow-wrap:anywhere]">{thread.subject}</Link>
          <p className="text-xs text-slate-500">Diperbarui {dateLabel(thread.updatedAt)}</p>
        </li>)}</ul>}
    </>}
    <Pager meta={result.data?.meta} pagination={pagination} busy={result.loading} />
  </section>;
}

function Greetings() {
  const pagination = usePagination("greeting");
  const result = useResource<PageResult<Greeting>>(`/ruang-asatidz/greetings?page=${pagination.page}&pageSize=${pagination.pageSize}`);
  return <section className={card} aria-labelledby="greetings-title" aria-busy={result.loading}>
    <h2 id="greetings-title" className="mb-4 text-lg font-bold text-slate-900">Sapaan dari YTS</h2>
    {result.loading && <p role="status" className="text-sm text-slate-600">Memuat sapaan…</p>}
    {result.error && <LoadError message={result.error} retry={result.retry} />}
    {result.data && (result.data.data.length ? <div className="space-y-5">{result.data.data.map((greeting) => <article key={greeting.id} className="rounded-lg border-l-4 border-emerald-700 bg-emerald-50/50 p-4">
      <h3 className="mb-2 break-words font-bold text-emerald-950">{greeting.title}</h3><Body>{greeting.body}</Body>
      <p className="mt-3 text-xs text-slate-500">{dateLabel(greeting.updatedAt)}</p>
    </article>)}</div> : <p className="text-sm text-slate-600">Belum ada sapaan yang diterbitkan.</p>)}
    <Pager meta={result.data?.meta} pagination={pagination} busy={result.loading} />
  </section>;
}

const formCopy: Record<RuangCategory, { title: string; description: string; placeholder: string }> = {
  SUGGESTION: { title: "Saran Anda berarti", description: "Sampaikan masukan untuk menjadi lebih baik bersama.", placeholder: "Apa yang dapat kami perbaiki?" },
  EXPERIENCE: { title: "Setiap pengalaman berharga", description: "Ceritakan pelajaran, tantangan, atau momen yang berkesan.", placeholder: "Pengalaman yang ingin saya ceritakan…" },
  NEED: { title: "Mari sampaikan kebutuhan Anda", description: "Jelaskan kebutuhan dan konteksnya agar YTS dapat meninjau permintaan Anda.", placeholder: "Apa yang Anda butuhkan dan mengapa?" },
  QUESTION: { title: "Ada yang ingin ditanyakan?", description: "Mulai percakapan pribadi dengan YTS di sini.", placeholder: "Pertanyaan yang ingin saya sampaikan…" },
};

function CreateThread({ category, onCreated }: { category: RuangCategory; onCreated?: () => void }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const lock = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); }, []);
  const copy = formCopy[category];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const cleanSubject = subject.trim();
    const cleanBody = body.trim();
    setError(""); setCreatedId(null);
    if (cleanSubject.length < 5 || cleanSubject.length > 160 || cleanBody.length < 10 || cleanBody.length > 5000) {
      setError("Judul harus 5–160 karakter dan isi pesan 10–5.000 karakter, tanpa menghitung spasi di awal/akhir.");
      return;
    }
    lock.current = true; setBusy(true);
    const controller = new AbortController(); request.current = controller;
    try {
      const created = await ruangApi<ThreadSummary>("/ruang-asatidz/threads", {
        method: "POST", signal: controller.signal,
        body: JSON.stringify({ category, subject: cleanSubject, body: cleanBody, ...(category === "EXPERIENCE" ? { shareExperience: share } : {}) }),
      });
      if (controller.signal.aborted) return;
      setCreatedId(created.id); setSubject(""); setBody(""); setShare(false);
      // Refresh has its own error state; a successful creation must never be retried as a failed submit.
      onCreated?.();
    } catch (reason) {
      if (!controller.signal.aborted) setError(errorMessage(reason));
    } finally {
      lock.current = false;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return <section className={card} aria-labelledby="create-title">
    <h2 id="create-title" className="text-lg font-bold text-slate-900">{copy.title}</h2>
    <p className="mb-5 mt-1 text-sm leading-6 text-slate-600">{copy.description}</p>
    {createdId && <div className="mb-5"><Notice>Pesan berhasil disimpan di Ruang Asatidz. <Link className="inline-flex min-h-[44px] items-center rounded px-2 font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700" to={`${ROOT}/pesan/${encodeURIComponent(createdId)}`}>Buka percakapan</Link></Notice></div>}
    <form onSubmit={submit} className="space-y-5" aria-busy={busy}>
      <fieldset disabled={busy} className="space-y-5">
        <label className="block space-y-2 text-sm font-semibold text-slate-800" htmlFor="thread-subject">Judul pesan
          <input id="thread-subject" className={field} value={subject} onChange={(event) => setSubject(event.target.value)} minLength={5} maxLength={160} required aria-describedby="subject-help" />
        </label>
        <p id="subject-help" className="text-xs text-slate-500">5–160 karakter · {subject.length}/160</p>
        <label className="block space-y-2 text-sm font-semibold text-slate-800" htmlFor="thread-body">Isi pesan
          <textarea id="thread-body" className={`${field} min-h-[180px]`} value={body} onChange={(event) => setBody(event.target.value)} minLength={10} maxLength={5000} rows={7} required placeholder={copy.placeholder} aria-describedby="body-help" />
        </label>
        <p id="body-help" className="text-xs text-slate-500">10–5.000 karakter · {body.length}/5.000. Hindari data pribadi orang lain.</p>
        {category === "EXPERIENCE" && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <label className="flex min-h-[44px] cursor-pointer items-start gap-3 text-sm leading-6 text-amber-950">
            <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-emerald-800" checked={share} onChange={(event) => setShare(event.target.checked)} aria-describedby="share-help" />
            <span>Saya setuju pengalaman ini, termasuk nama saya sebagai penulis, ditampilkan kepada asatidz lain di papan Terhubung setelah disetujui moderator YTS.</span>
          </label>
          <p id="share-help" className="mt-2 text-xs leading-5 text-amber-900">Pilihan ini tidak wajib dan tidak dicentang secara otomatis. Tanpa persetujuan ini, pengalaman tetap pribadi. Balasan percakapan tidak ditampilkan di papan.</p>
        </div>}
        {category === "NEED" && <p className="rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">Kebutuhan yang disampaikan adalah permintaan untuk ditinjau, bukan jaminan bantuan atau pemenuhan.</p>}
      </fieldset>
      {error && <div role="alert" className="rounded-lg bg-rose-50 p-4 text-sm leading-6 text-rose-900">
        <p>{error}</p><p>Jika koneksi terputus saat mengirim, pesan mungkin sudah tersimpan. Periksa <Link to={`${ROOT}/pesan`} className="inline-flex min-h-[44px] items-center rounded px-1 font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-800">Pesan Saya</Link> sebelum mengirim ulang.</p>
      </div>}
      <div className="flex flex-wrap items-center gap-3"><button type="submit" className={primary} disabled={busy}>{busy ? "Menyimpan…" : "Kirim pesan"}</button>
        <span className="text-xs leading-5 text-slate-500">Tidak mengirim email atau WhatsApp secara otomatis.</span></div>
    </form>
  </section>;
}

function Board() {
  const pagination = usePagination();
  const result = useResource<PageResult<BoardExperience>>(`/ruang-asatidz/experiences?page=${pagination.page}&pageSize=${pagination.pageSize}`);
  return <section className={card} aria-labelledby="board-title" aria-busy={result.loading}>
    <h2 id="board-title" className="text-lg font-bold text-slate-900">Terhubung lewat pengalaman</h2>
    <p className="mb-5 mt-2 text-sm leading-6 text-slate-600">Pengalaman yang dibagikan atas persetujuan penulis dan telah disetujui moderator YTS. Percakapan pribadi dan balasannya tidak tampil di sini.</p>
    {result.loading && <p role="status" className="text-sm text-slate-600">Memuat pengalaman…</p>}
    {result.error && <LoadError message={result.error} retry={result.retry} />}
    {result.data && (result.data.data.length ? <div className="space-y-5">{result.data.data.map((experience) => <article key={experience.id} className="rounded-xl border border-slate-200 p-5">
      <h3 className="break-words text-lg font-bold text-slate-900">{experience.subject}</h3>
      <p className="mb-3 mt-2 text-xs text-slate-500">{experience.authorName || "Asatidz"} · Diterbitkan {dateLabel(experience.publishedAt)}</p>
      <Body>{experience.body}</Body>
    </article>)}</div> : <p className="rounded-lg bg-slate-50 p-5 text-sm text-slate-600">Belum ada pengalaman di halaman ini. Pengalaman baru akan tampil setelah persetujuan penulis dan moderasi.</p>)}
    <Pager meta={result.data?.meta} pagination={pagination} busy={result.loading} />
  </section>;
}

function ThreadConversation({ threadId }: { threadId: string }) {
  const [refresh, setRefresh] = useState(0);
  const result = useResource<ThreadDetail>(`/ruang-asatidz/threads/${encodeURIComponent(threadId)}`, refresh);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const lock = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); }, []);
  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || !result.data || result.loading || result.data.status === "CLOSED") return;
    const cleanBody = body.trim();
    setError(""); setSent(false);
    if (cleanBody.length < 2 || cleanBody.length > 5000) { setError("Balasan harus 2–5.000 karakter, tanpa spasi di awal/akhir."); return; }
    lock.current = true; setBusy(true);
    const controller = new AbortController(); request.current = controller;
    try {
      await ruangApi(`/ruang-asatidz/threads/${encodeURIComponent(threadId)}/replies`, {
        method: "POST", signal: controller.signal, body: JSON.stringify({ body: cleanBody }),
      });
      if (controller.signal.aborted) return;
      setBody(""); setSent(true);
      setRefresh((value) => value + 1);
    } catch (reason) {
      if (!controller.signal.aborted) setError(errorMessage(reason));
    } finally {
      lock.current = false;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return <div className="space-y-5">
    <Link to={`${ROOT}/pesan`} className={button}>← Kembali ke Pesan Saya</Link>
    {sent && <Notice>Balasan berhasil disimpan. Jika percakapan gagal dimuat ulang, cukup muat ulang; tidak perlu mengirim balasan yang sama lagi.</Notice>}
    {result.loading && <p role="status" className={card}>Memuat percakapan pribadi…</p>}
    {result.error && <LoadError message={`${sent ? "Balasan tersimpan, tetapi percakapan belum dapat dimuat ulang. " : ""}${result.error}`} retry={result.retry} />}
    {result.data && <>
      <article className={card}>
        <ThreadBadges thread={result.data} />
        <h2 className="my-4 break-words text-xl font-bold text-slate-900 [overflow-wrap:anywhere]">{result.data.subject}</h2>
        <Body>{result.data.body}</Body>
        <p className="mt-4 text-xs text-slate-500">Dikirim {dateLabel(result.data.createdAt)}</p>
        {result.data.category === "EXPERIENCE" && <p className="mt-3 text-sm leading-6 text-slate-600">{result.data.shareExperience ? "Anda mengizinkan pengalaman dan nama penulis ditampilkan di papan setelah moderasi. Balasan tetap pribadi." : "Pengalaman ini tidak diizinkan untuk dibagikan ke papan Terhubung."}</p>}
      </article>
      <section className={card} aria-labelledby="replies-title">
        <h2 id="replies-title" className="mb-5 text-lg font-bold text-slate-900">Percakapan pribadi</h2>
        {result.data.replies.length === 0 ? <p className="text-sm text-slate-600">Belum ada balasan. Tindak lanjut dapat dipantau di halaman ini.</p> :
          <ol className="space-y-4">{result.data.replies.map((item) => <li key={item.id} className={`rounded-lg border p-4 ${item.authorRole === "YTS" ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
            <p className="mb-2 text-sm font-bold text-slate-900">{item.authorRole === "YTS" ? "Tim YTS" : "Anda"}{item.authorName ? ` · ${item.authorName}` : ""}</p>
            <Body>{item.body}</Body><p className="mt-3 text-xs text-slate-500">{dateLabel(item.createdAt)}</p>
          </li>)}</ol>}
      </section>
      {result.data.status === "CLOSED" ? <Notice>Percakapan ini telah ditutup dan tidak menerima balasan baru. Anda tetap dapat membaca riwayatnya atau membuat pesan baru.</Notice> :
        <section className={card} aria-labelledby="reply-title"><h2 id="reply-title" className="mb-4 text-lg font-bold text-slate-900">Tambahkan balasan</h2>
          <form onSubmit={reply} className="space-y-4" aria-busy={busy}>
            <label htmlFor="reply-body" className="block space-y-2 text-sm font-semibold text-slate-800">Balasan untuk YTS
              <textarea id="reply-body" className={`${field} min-h-[140px]`} rows={5} value={body} onChange={(event) => setBody(event.target.value)} required minLength={2} maxLength={5000} disabled={busy} aria-describedby="reply-help" />
            </label>
            <p id="reply-help" className="text-xs text-slate-500">2–5.000 karakter · {body.length}/5.000. Balasan hanya untuk Anda dan YTS.</p>
            {error && <div role="alert" className="rounded-lg bg-rose-50 p-4 text-sm leading-6 text-rose-900">
              <p>{error}</p><p>Jika koneksi terputus, balasan mungkin sudah tersimpan. Muat ulang percakapan sebelum mengirim ulang.</p>
              <button type="button" className={`${button} mt-3`} onClick={result.retry} disabled={busy}>Muat ulang percakapan</button>
            </div>}
            <button type="submit" className={primary} disabled={busy || result.loading}>{busy ? "Menyimpan balasan…" : "Kirim balasan"}</button>
          </form>
        </section>}
    </>}
  </div>;
}

function Messages() {
  const [refresh, setRefresh] = useState(0);
  return <div className="space-y-6"><MyThreads refresh={refresh} /><CreateThread category="QUESTION" onCreated={() => setRefresh((value) => value + 1)} /></div>;
}

export function RuangAsatidzPage() {
  const location = useLocation();
  const path = location.pathname.replace(/\/+$/, "");
  const subpath = path === ROOT ? "" : path.startsWith(`${ROOT}/`) ? path.slice(ROOT.length) : "/not-found";
  const detailMatch = /^\/pesan\/([^/]+)$/.exec(subpath);
  let content: ReactNode;
  switch (subpath) {
    case "": content = <div className="space-y-6">
      <section className="rounded-xl bg-emerald-900 p-6 text-white sm:p-8"><p className="text-sm font-semibold text-emerald-200">Disapa · Didengar · Terhubung</p>
        <h2 className="mt-3 text-2xl font-bold">Ruang untuk cerita dan suara Anda</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-50">Assalamu’alaikum, Asatidz. Sampaikan saran, ceritakan pengalaman, atau ajukan kebutuhan. YTS dapat membaca dan menindaklanjuti pesan Anda di ruang ini.</p>
        <div className="mt-5 flex flex-wrap gap-3"><Link to={`${ROOT}/saran`} className={button}>Sampaikan saran</Link><Link to={`${ROOT}/pesan`} className={button}>Mulai percakapan</Link></div>
      </section><Greetings /><MyThreads summary /></div>; break;
    case "/saran": content = <CreateThread category="SUGGESTION" />; break;
    case "/pengalaman": content = <CreateThread category="EXPERIENCE" />; break;
    case "/kebutuhan": content = <CreateThread category="NEED" />; break;
    case "/pesan": content = <Messages />; break;
    case "/terhubung": content = <Board />; break;
    default: content = detailMatch ? <ThreadConversation threadId={detailMatch[1]} /> : <section className={card}><h2 className="font-bold">Halaman tidak ditemukan</h2><Link className={`${button} mt-4`} to={ROOT}>Kembali ke Ruang Asatidz</Link></section>;
  }
  return <PortalLayout>
    <PageHeader title="Ruang Asatidz" description="Disapa. Didengar. Terhubung." actions={<Link to="/portal" className={button}>Beranda Portal</Link>} />
    <nav aria-label="Navigasi Ruang Asatidz" className="mb-5 flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = subpath === tab.path || (tab.path === "/pesan" && Boolean(detailMatch));
        return <Link key={tab.path} to={`${ROOT}${tab.path}`} aria-current={active ? "page" : undefined} className={active ? primary : button}>{tab.label}</Link>;
      })}
    </nav>
    <aside aria-label="Privasi dan batas layanan" className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
      <strong className="text-slate-900">Pribadi secara default.</strong> Pesan dan balasan hanya dapat diakses oleh Anda dan tim YTS. Pengalaman hanya dibagikan ke papan jika Anda menyetujuinya dan moderator menyetujui publikasi, termasuk nama penulis. Ruang ini bukan kanal darurat. Kebutuhan adalah permintaan untuk ditinjau, bukan jaminan pemenuhan. Jika Anda berpindah halaman saat mengirim atau koneksi terputus, periksa riwayat sebelum mengirim ulang karena pesan mungkin sudah tersimpan.
    </aside>
    <div key={path}>{content}</div>
  </PortalLayout>;
}

export default RuangAsatidzPage;