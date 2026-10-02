import { useEffect, useId, useRef, useState } from "react";
import { Check, ListChecks, Loader2, X } from "lucide-react";
import { eventApi } from "@/lib/eventApi";
import {
  eligibleApprovalIds, runParticipantBulkApproval, selectionAfterBulkApproval, toggleApprovalSelection,
  type ApprovalCandidate, type BulkApprovalItem, type BulkApprovalResponse,
} from "@/lib/participantBulkApproval";

type Candidate = ApprovalCandidate & { ustadzName: string; participantCode: string };
type Props = {
  eventId: string;
  eventName?: string;
  participants: Candidate[];
  filteredParticipants: Candidate[];
  pageParticipants: Candidate[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onBusyChange: (busy: boolean) => void;
  onCompleted: () => Promise<boolean>;
  disabled?: boolean;
  demoMode?: boolean;
  requiresRefresh?: boolean;
  onRefreshRequiredChange?: (required: boolean) => void;
};

export function BulkParticipantApprovalPanel({ eventId, eventName, participants, filteredParticipants,
  pageParticipants, selectedIds, onSelectionChange, onBusyChange, onCompleted, disabled = false, demoMode = false,
  requiresRefresh = false, onRefreshRequiredChange }: Props) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pageCheckbox = useRef<HTMLInputElement>(null);
  const filterCheckbox = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [confirmationIds, setConfirmationIds] = useState<string[]>([]);
  const [scope, setScope] = useState("");
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [results, setResults] = useState<BulkApprovalItem[] | null>(null);
  const [refreshWarning, setRefreshWarning] = useState("");
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [error, setError] = useState("");
  const eligibleIds = eligibleApprovalIds(participants);
  const pageIds = eligibleApprovalIds(pageParticipants);
  const filterIds = eligibleApprovalIds(filteredParticipants);
  const pendingIds = eligibleApprovalIds(participants, true);
  const chosen = selectedIds.filter((pid) => eligibleIds.includes(pid));
  const locked = disabled || busy || refreshBusy || requiresRefresh || Boolean(refreshWarning);
  const pageSelected = pageIds.filter((pid) => chosen.includes(pid)).length;
  const filterSelected = filterIds.filter((pid) => chosen.includes(pid)).length;
  const hiddenCount = chosen.filter((pid) => !filteredParticipants.some((item) => item.id === pid)).length;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (pageCheckbox.current) pageCheckbox.current.indeterminate = pageSelected > 0 && pageSelected < pageIds.length;
    if (filterCheckbox.current) filterCheckbox.current.indeterminate = filterSelected > 0 && filterSelected < filterIds.length;
  }, [pageSelected, pageIds.length, filterSelected, filterIds.length]);

  const confirm = (ids: string[], label: string) => {
    if (locked || busyRef.current || ids.length === 0) return;
    setConfirmationIds([...ids]);
    setScope(label);
    setError("");
    dialogRef.current?.showModal();
  };

  const submit = async () => {
    if (busyRef.current || locked || demoMode || confirmationIds.length === 0) return;
    const validIds = confirmationIds.filter((pid) => eligibleIds.includes(pid));
    if (validIds.length !== confirmationIds.length) {
      setError("Status peserta berubah. Tutup dialog dan pilih ulang peserta yang dapat disetujui.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    onBusyChange(true);
    setResults(null);
    setRefreshWarning("");
    setProgress({ processed: 0, total: validIds.length });
    try {
      const token = localStorage.getItem("yts_auth_token") || "";
      const outcome = await runParticipantBulkApproval(validIds, (participantIds) =>
        eventApi<BulkApprovalResponse>(`/events/${encodeURIComponent(eventId)}/participants/bulk-approve`, {
          method: "POST", headers: token ? { Authorization: token } : undefined,
          body: JSON.stringify({ participantIds }),
        }), (processed, total) => setProgress({ processed, total }), () => mounted.current);
      if (mounted.current) {
        setResults(outcome);
        onSelectionChange(selectionAfterBulkApproval(selectedIds, validIds, outcome));
      }
      // Preserve the outcome even when reloading fails. Never present partial success as all-success.
      try {
        const refreshed = await onCompleted();
        onRefreshRequiredChange?.(!refreshed);
        if (mounted.current) {
          if (!refreshed) setRefreshWarning("Hasil proses tersimpan, tetapi daftar belum berhasil dimuat ulang. Muat ulang halaman sebelum mencoba lagi.");
        }
      } catch {
        onRefreshRequiredChange?.(true);
        if (mounted.current) {
          setRefreshWarning("Daftar belum berhasil dimuat ulang. Periksa status terbaru sebelum mencoba lagi.");
        }
      }
    } catch (reason) {
      onRefreshRequiredChange?.(true);
      if (mounted.current) setError(reason instanceof Error ? reason.message : "Persetujuan gagal diproses. Periksa status terbaru.");
    } finally {
      busyRef.current = false;
      // The parent may still exist after switching away from the participants tab.
      // Its event/mounted guards prevent an old request unlocking another event.
      onBusyChange(false);
      if (mounted.current) {
        setBusy(false);
        dialogRef.current?.close();
      }
    }
  };

  const refresh = async () => {
    if (refreshBusy || busyRef.current || disabled) return;
    setRefreshBusy(true);
    try {
      if (await onCompleted() && mounted.current) {
        setRefreshWarning("");
        onRefreshRequiredChange?.(false);
      }
    } catch {
      // Preserve the warning and keep approval disabled until the status can be verified.
    } finally {
      if (mounted.current) setRefreshBusy(false);
    }
  };

  const successCount = results?.filter((item) => item.status === "SUCCESS").length || 0;
  const failed = results?.filter((item) => item.status !== "SUCCESS") || [];
  return <section aria-label="Persetujuan massal peserta" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-sm font-black text-emerald-950"><ListChecks className="h-5 w-5" />Persetujuan massal peserta</h2>
        <p className="mt-1 text-xs leading-5 text-emerald-950">Pilih peserta menunggu tinjauan atau daftar tunggu yang masih aktif. Kapasitas dan kuota tetap diperiksa. Presensi tidak berubah.</p>
      </div>
      <button type="button" disabled={locked || pendingIds.length === 0} onClick={() => confirm(pendingIds, "Semua peserta menunggu tinjauan di event ini, termasuk di luar filter dan halaman saat ini")}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-800 px-3 text-sm font-bold text-white disabled:opacity-50"><Check className="h-4 w-4" />Setujui semua menunggu ({pendingIds.length})</button>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
      <label className="flex min-h-11 items-center gap-2 text-sm font-bold"><input ref={pageCheckbox} type="checkbox" checked={pageIds.length > 0 && pageSelected === pageIds.length} disabled={locked || pageIds.length === 0}
        onChange={(event) => onSelectionChange(toggleApprovalSelection(chosen, pageIds, event.target.checked))} className="h-4 w-4 accent-emerald-800" />Pilih semua di halaman ({pageIds.length})</label>
      <label className="flex min-h-11 items-center gap-2 text-sm font-bold"><input ref={filterCheckbox} type="checkbox" checked={filterIds.length > 0 && filterSelected === filterIds.length} disabled={locked || filterIds.length === 0}
        onChange={(event) => onSelectionChange(toggleApprovalSelection(chosen, filterIds, event.target.checked))} className="h-4 w-4 accent-emerald-800" />Pilih semua hasil filter ({filterIds.length})</label>
      <span className="text-sm font-bold">{chosen.length} peserta dipilih{hiddenCount > 0 ? ` (${hiddenCount} di luar filter)` : ""}</span>
      <button type="button" disabled={locked || chosen.length === 0} onClick={() => onSelectionChange([])} className="min-h-11 rounded-lg border border-emerald-300 bg-white px-3 text-sm font-bold disabled:opacity-50">Batalkan pilihan</button>
      <button type="button" disabled={locked || chosen.length === 0} onClick={() => confirm(chosen, "Peserta yang dipilih, termasuk pilihan di halaman/filter lain")}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-800 px-3 text-sm font-bold text-white disabled:opacity-50"><Check className="h-4 w-4" />Setujui terpilih ({chosen.length})</button>
    </div>
    {demoMode && <p className="mt-2 text-xs">Mode pratinjau: penyimpanan persetujuan massal dinonaktifkan.</p>}
    {busy && <div role="status" className="mt-3"><p className="flex items-center gap-2 text-sm font-bold"><Loader2 className="h-4 w-4 animate-spin" />Memproses {progress.processed} / {progress.total} peserta…</p><progress aria-label="Progres persetujuan massal" value={progress.processed} max={progress.total || 1} className="mt-2 w-full" /></div>}
    {results && <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
      <p role="status" className="text-sm font-bold">Hasil persetujuan: {successCount} berhasil, {results.filter((item) => item.status === "FAILED").length} gagal, {results.filter((item) => item.status === "UNKNOWN").length} belum pasti, {results.filter((item) => item.status === "NOT_PROCESSED").length} belum diproses.</p>
      {failed.length > 0 && <details className="mt-2 text-sm" open><summary className="cursor-pointer font-bold">Rincian peserta yang perlu diperiksa ({failed.length})</summary><ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">{failed.map((item) => {
        const participant = participants.find((person) => person.id === item.participantId);
        return <li key={item.participantId} className="rounded border border-amber-200 bg-amber-50 p-2"><span className="font-bold">{participant?.ustadzName || item.participantId} · {participant?.participantCode || ""}</span><p className="mt-1 text-xs">{item.message}</p></li>;
      })}</ul></details>}
    </div>}
    {(refreshWarning || requiresRefresh) && <div className="mt-3"><p role="alert" className="text-sm text-amber-950">{refreshWarning || "Status peserta harus dimuat ulang sebelum persetujuan berikutnya."}</p><button type="button" onClick={() => void refresh()} disabled={disabled || refreshBusy || busy} className="mt-2 min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold disabled:opacity-50">{refreshBusy ? "Memuat ulang…" : "Muat ulang status peserta"}</button></div>}
    <dialog ref={dialogRef} id={`${id}-dialog`} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
      onCancel={(event) => { if (busyRef.current) event.preventDefault(); }}
      className="m-auto max-h-[90dvh] w-[min(40rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl backdrop:bg-slate-950/60">
      <header className="flex items-start justify-between gap-3"><h2 id={`${id}-title`} className="text-lg font-black">Setujui {confirmationIds.length} peserta?</h2><button type="button" disabled={busy} onClick={() => dialogRef.current?.close()} aria-label="Tutup konfirmasi persetujuan" className="grid min-h-11 min-w-11 place-items-center rounded border border-slate-300 disabled:opacity-50"><X className="h-4 w-4" /></button></header>
      <div id={`${id}-description`} className="mt-3 space-y-2 text-sm leading-6"><p className="font-bold">{eventName || "Event yang dipilih"}</p><p>{scope}.</p><p>Status peserta akan menjadi APPROVED jika lolos kapasitas dan kuota. Konfirmasi kehadiran dan presensi tidak diubah. Sebagian peserta dapat gagal dan hasilnya akan ditampilkan.</p></div>
      <ul className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-3 text-sm">{confirmationIds.map((pid) => {
        const participant = participants.find((person) => person.id === pid);
        return <li key={pid} className="py-1">{participant?.ustadzName || pid} · {participant?.participantCode}</li>;
      })}</ul>
      {demoMode && <p role="status" className="mt-3 text-sm">Pratinjau saja. Tidak ada perubahan database.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-rose-900">{error}</p>}
      {busy && <p role="status" className="mt-3 text-sm">Memproses {progress.processed} / {progress.total}. Jangan tutup halaman.</p>}
      <footer className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} onClick={() => dialogRef.current?.close()} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold disabled:opacity-50">Batal</button><button type="button" disabled={locked || demoMode || confirmationIds.length === 0} onClick={() => void submit()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-800 px-4 text-sm font-bold text-white disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? "Memproses…" : "Ya, setujui peserta"}</button></footer>
    </dialog>
  </section>;
}