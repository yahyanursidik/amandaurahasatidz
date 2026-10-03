import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Flag } from "lucide-react";
import { canAccessYtsNotes, YTS_NOTE_FLAGS, type YtsNote, type YtsNoteFlag, type YtsNoteSummary, type YtsNotesPage } from "@/lib/ustadzNotes";
import { api, button, card, field, Label, messageOf, Notice, primary, ResourceState, TextBody, useDirtyGuard, useResource } from "@/components/ukhuwah/ui";

export function YtsNoteBadge({ summary }: { summary: YtsNoteSummary }) {
  const flag = summary.flag && YTS_NOTE_FLAGS[summary.flag];
  return <span className={`inline-flex flex-wrap items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${flag?.className ?? "border-slate-200 bg-slate-50 text-slate-700"}`}>
    <Flag aria-hidden="true" size={14} />{flag ? `${flag.color} · ${flag.label}` : "Tanpa catatan aktif"}{summary.activeCount > 0 && ` · ${summary.activeCount} catatan`}
  </span>;
}

/** Returns only summaries from a dedicated guarded endpoint, never note text on a directory page. */
export function useYtsNoteSummaries(ids: string[], enabled: boolean, refresh = 0) {
  const key = [...new Set(ids)].sort().join(",");
  const resource = useResource<YtsNoteSummary[]>(enabled && key ? `/admin/ustadz-notes/summary?ids=${encodeURIComponent(key)}` : null, refresh);
  return { ...resource, byId: Object.fromEntries((enabled ? resource.data ?? [] : []).map(item => [item.ustadzId, item])) as Record<string, YtsNoteSummary> };
}

export function YtsNoteDirectoryBadge({ id, summary, loading, error }: { id: string; summary?: YtsNoteSummary; loading: boolean; error?: string }) {
  return <Link to={`/admin/ustadz/${id}?tab=notes`} className="inline-flex min-h-11 flex-col justify-center py-1" aria-label="Buka catatan internal YTS">
    {loading ? <span className="text-xs text-slate-500">Memuat penanda YTS…</span> : error ? <span className="text-xs text-rose-700">Penanda YTS belum tersedia</span> : summary ? <YtsNoteBadge summary={summary} /> : <span className="text-xs text-slate-500">Catatan YTS belum tersedia</span>}
  </Link>;
}

export function YtsNoteLegend() {
  return <div className="space-y-2 text-sm"><p className="font-semibold">Penanda koordinasi internal YTS — bukan penilaian atau sanksi otomatis.</p>
    <div className="flex flex-wrap gap-2">{Object.entries(YTS_NOTE_FLAGS).map(([value]) => <YtsNoteBadge key={value} summary={{ ustadzId: "", activeCount: 0, flag: value as YtsNoteFlag }} />)}</div>
    <p className="text-xs text-slate-600">Badge memakai prioritas merah → kuning → biru → hijau dari catatan aktif. Arsip tidak ikut menentukan warna.</p>
  </div>;
}

type NoteDraft = { title: string; body: string; flag: YtsNoteFlag };
const emptyDraft = (): NoteDraft => ({ title: "", body: "", flag: "BLUE" });
function NoteEditor({ ustadzId, note, onSaved, onClose }: { ustadzId: string; note?: YtsNote; onSaved: () => void; onClose: () => void }) {
  const initial = note ? { title: note.title, body: note.body, flag: note.flag } : emptyDraft();
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false); const pending = useRef(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  useDirtyGuard(dirty, busy);
  async function save() {
    if (pending.current) return;
    if (draft.title.trim().length < 3 || draft.body.trim().length < 3) { setError("Judul dan isi catatan minimal 3 karakter."); return; }
    pending.current = true; setBusy(true); setError("");
    try {
      await api<YtsNote>(`/admin/ustadz-notes/${ustadzId}${note ? `/${note.id}` : ""}`, { method: note ? "PATCH" : "POST", body: JSON.stringify({ ...draft, ...(note ? { expectedVersion: note.version } : {}) }) });
      onSaved();
    } catch (cause) { setError(`${messageOf(cause)} Perubahan tetap ada. Bila revisi berubah, tutup editor dan muat ulang catatan sebelum mencoba lagi.`); }
    finally { pending.current = false; setBusy(false); }
  }
  function close() { if (!busy && (!dirty || window.confirm("Buang perubahan catatan yang belum disimpan?"))) onClose(); }
  return <section className={`${card} space-y-4`} aria-label="Editor catatan YTS">
    <div className="flex flex-wrap justify-between gap-3"><h3 className="text-lg font-bold">{note ? "Edit catatan internal" : "Tambah catatan internal"}</h3><button className={button} disabled={busy} onClick={close}>Tutup editor catatan</button></div>
    {error && <Notice error>{error}</Notice>}
    <form onSubmit={event => { event.preventDefault(); void save(); }}><fieldset disabled={busy} className="space-y-4">
      <Label name="Judul catatan"><input id="yts-note-title" className={field} value={draft.title} minLength={3} maxLength={200} required onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} /></Label>
      <Label name="Warna / flag"><select id="yts-note-flag" className={field} value={draft.flag} onChange={e => setDraft(d => ({ ...d, flag: e.target.value as YtsNoteFlag }))}>{Object.entries(YTS_NOTE_FLAGS).map(([value, flag]) => <option value={value} key={value}>{flag.color} — {flag.label}</option>)}</select></Label>
      <Label name="Catatan internal"><textarea id="yts-note-body" className={field} rows={6} value={draft.body} minLength={3} maxLength={10000} required onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} /></Label>
      <p className="text-xs text-slate-600">Catat fakta, sumber/tanggal, konteks, dan tindak lanjut seperlunya. Pisahkan informasi terverifikasi dari dugaan. Hindari tuduhan, identitas anak, atau data pribadi yang tidak diperlukan.</p>
      <button type="submit" className={primary} disabled={busy || (!dirty && !!note)}>{busy ? "Menyimpan catatan…" : "Simpan catatan"}</button>
    </fieldset></form>
  </section>;
}

type Assignment = Parameters<typeof canAccessYtsNotes>[0][number];
export function YtsNotesPanel({ ustadzId, profileName, assignments, mergedIntoId, disabled = false }: { ustadzId: string; profileName: string; assignments: Assignment[]; mergedIntoId?: string | null; disabled?: boolean }) {
  // Gate before mounting data hooks; unauthorized users make no notes request.
  if (!canAccessYtsNotes(assignments)) return null;
  if (disabled) return <Notice>Catatan internal tidak tersedia untuk profil contoh. Tidak ada catatan nyata yang dimuat.</Notice>;
  return <NotesWorkspace key={ustadzId} ustadzId={ustadzId} profileName={profileName} mergedIntoId={mergedIntoId} />;
}
function NotesWorkspace({ ustadzId, profileName, mergedIntoId }: { ustadzId: string; profileName: string; mergedIntoId?: string | null }) {
  const [archived, setArchived] = useState(false); const [filter, setFilter] = useState(""); const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0); const [editor, setEditor] = useState<{ note?: YtsNote } | null>(null);
  const [busy, setBusy] = useState(false); const pending = useRef(false);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const resource = useResource<YtsNotesPage>(`/admin/ustadz-notes/${ustadzId}?archived=${archived}&page=${page}&pageSize=20${filter ? `&flag=${filter}` : ""}`, refresh);
  const summaries = useYtsNoteSummaries([ustadzId], true, refresh);
  async function toggleArchive(note: YtsNote) {
    if (pending.current || !window.confirm(`${note.archivedAt ? "Pulihkan" : "Arsipkan"} catatan “${note.title}”? ${note.archivedAt ? "Penanda aktif akan diperbarui." : "Catatan tetap tersimpan di arsip dan tidak menentukan warna aktif."}`)) return;
    pending.current = true; setBusy(true); setError(""); setNotice("");
    try {
      await api<YtsNote>(`/admin/ustadz-notes/${ustadzId}/${note.id}/archive`, { method: "PATCH", body: JSON.stringify({ expectedVersion: note.version, archived: !note.archivedAt }) });
      setNotice(note.archivedAt ? "Catatan dipulihkan." : "Catatan diarsipkan.");
      if (page > 1 && resource.data?.data.length === 1) setPage(page - 1);
      setRefresh(n => n + 1);
    } catch (cause) { setError(messageOf(cause)); } finally { pending.current = false; setBusy(false); }
  }
  return <section className="space-y-5" aria-label="Catatan internal YTS">
    <Notice><strong>Khusus pengelola YTS yang berwenang.</strong> Catatan dan warna tidak tampil di portal asatidz, halaman publik, ekspor profil, atau pesan ke peserta. Penanda tidak mengubah persetujuan peserta, hak akses, atau status profil.</Notice>
    <YtsNoteLegend />
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Catatan internal — {profileName}</h2>{summaries.byId[ustadzId] && <YtsNoteBadge summary={summaries.byId[ustadzId]} />}</div>
    <ResourceState resource={summaries} />
    {mergedIntoId && <Notice>Profil ini telah digabung. Tambahkan catatan baru pada <Link className="underline" to={`/admin/ustadz/${mergedIntoId}?tab=notes`}>profil tujuan</Link>. Catatan lama tetap dapat dibaca dan dikelola.</Notice>}
    <div className="flex flex-wrap items-end gap-3">
      <Label name="Status catatan"><select className={field} id="yts-note-status" disabled={busy || !!editor} value={String(archived)} onChange={e => { setArchived(e.target.value === "true"); setPage(1); }}><option value="false">Aktif</option><option value="true">Arsip</option></select></Label>
      <Label name="Filter warna"><select className={field} id="yts-note-filter" disabled={busy || !!editor} value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}><option value="">Semua warna</option>{Object.entries(YTS_NOTE_FLAGS).map(([value, flag]) => <option key={value} value={value}>{flag.color} — {flag.label}</option>)}</select></Label>
      <button data-yts-note-navigation className={button} disabled={busy || !!editor} onClick={() => { resource.retry(); summaries.retry(); }}>Muat ulang catatan</button>
      {!mergedIntoId && <button data-yts-note-navigation className={primary} disabled={busy || !!editor} onClick={() => { setEditor({}); setError(""); setNotice(""); }}>Tambah catatan YTS</button>}
    </div>
    {error && <Notice error>{error}</Notice>}{notice && <Notice>{notice}</Notice>}
    <ResourceState resource={resource} />
    {editor && <NoteEditor key={editor.note?.id ?? "new"} ustadzId={ustadzId} note={editor.note} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); setNotice("Catatan tersimpan."); setRefresh(n => n + 1); }} />}
    {resource.data && <>
      {resource.data.data.length === 0 && <Notice>Belum ada catatan {archived ? "di arsip" : "aktif"} pada filter ini.</Notice>}
      {resource.data.data.map(note => <article key={note.id} className={`${card} space-y-3 ${YTS_NOTE_FLAGS[note.flag].className}`} aria-label="Catatan YTS">
        <YtsNoteBadge summary={{ ustadzId, activeCount: 0, flag: note.flag }} /><h3 className="break-words text-lg font-bold">{note.title}</h3><TextBody>{note.body}</TextBody>
        <p className="text-xs leading-6">Dibuat: {note.createdAt.slice(0, 10)} oleh {note.createdByName || "Pengelola YTS"}. Diperbarui: {note.updatedAt.slice(0, 10)} oleh {note.updatedByName || "Pengelola YTS"}. Revisi {note.version}.{note.archivedAt && ` Diarsipkan: ${note.archivedAt.slice(0, 10)}.`}</p>
        {note.ustadzId !== ustadzId && <p className="text-xs">Catatan dari profil tergabung: {note.sourceProfileName}. Atribusi asli tetap disimpan.</p>}
        <div className="flex flex-wrap gap-3">{!note.archivedAt && <button data-yts-note-navigation className={button} disabled={busy || !!editor} onClick={() => setEditor({ note })}>Edit catatan</button>}<button className={button} disabled={busy || !!editor} onClick={() => void toggleArchive(note)}>{note.archivedAt ? "Pulihkan catatan" : "Arsipkan catatan"}</button></div>
      </article>)}
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm">{resource.data.meta.total} catatan · Halaman {page} dari {Math.max(1, resource.data.meta.totalPages)}</p><div className="flex gap-2"><button className={button} disabled={busy || !!editor || page <= 1} onClick={() => setPage(p => p - 1)}>Sebelumnya</button><button className={button} disabled={busy || !!editor || page >= resource.data.meta.totalPages} onClick={() => setPage(p => p + 1)}>Berikutnya</button></div></div>
    </>}
  </section>;
}