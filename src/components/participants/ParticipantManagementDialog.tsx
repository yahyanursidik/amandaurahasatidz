import React, { useEffect, useId, useRef, useState } from "react";
import { Loader2, Settings2, X } from "lucide-react";
import { eventApi } from "@/lib/eventApi";
import type { PermissionCode } from "@/config/permissions";
import { availableParticipantCommands, participantCommandLabels, type ParticipantCommand, type ParticipantCommandTarget } from "@/lib/participantManagement";

type Candidate = { id: string; fullName: string; email: string | null };

export const ParticipantManagementDialog: React.FC<{
  eventId: string; participant: ParticipantCommandTarget; permissions: PermissionCode[];
  disabled?: boolean; demoMode?: boolean; onBusyChange?: (busy: boolean) => void;
  onCompleted: () => Promise<boolean | void> | boolean | void;
}> = ({ eventId, participant, permissions, disabled = false, demoMode = false, onBusyChange, onCompleted }) => {
  const id = useId(), dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const reasonInput = useRef<HTMLTextAreaElement>(null), busyRef = useRef(false), mounted = useRef(true);
  const actions = availableParticipantCommands(participant, permissions);
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [action, setAction] = useState<ParticipantCommand>("waitlist");
  const [reason, setReason] = useState(""), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [search, setSearch] = useState(""), [selected, setSelected] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]), [searching, setSearching] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!open || action !== "replace" || search.trim().length < 2 || demoMode) { setCandidates([]); setSearching(false); return; }
    const controller = new AbortController();
    setSearching(true); setSelected("");
    const timeout = window.setTimeout(() => {
      void eventApi<Candidate[]>(`/events/${eventId}/participants/${participant.id}/replacement-options?${new URLSearchParams({ search: search.trim() })}`, { signal: controller.signal })
        .then((items) => { if (!controller.signal.aborted) setCandidates(items); })
        .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Calon pengganti gagal dimuat."); })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 300);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [open, action, search, demoMode, eventId, participant.id]);
  if (!actions.length) return null;

  const openDialog = () => {
    if (busyRef.current || disabled) return;
    setAction(actions[0]); setReason(""); setSearch(""); setSelected(""); setError(""); setMessage("");
    setOpen(true); dialog.current?.showModal(); reasonInput.current?.focus();
  };
  const close = () => { if (!busyRef.current) dialog.current?.close(); };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busyRef.current || disabled || demoMode) return;
    if (!actions.includes(action) || reason.trim().length < 3 || action === "replace" && !selected) { setError("Lengkapi aksi, alasan, dan peserta pengganti bila diperlukan."); return; }
    busyRef.current = true; setBusy(true); setError(""); onBusyChange?.(true);
    try {
      await eventApi(`/events/${eventId}/participants/${participant.id}/${action}`, { method: "POST",
        body: JSON.stringify({ reason: reason.trim(), ...(action === "replace" ? { newUstadzId: selected } : {}) }) });
    } catch (cause) {
      if (mounted.current) { setError(cause instanceof Error ? cause.message : "Aksi gagal diproses. Periksa status terbaru sebelum mencoba kembali."); setBusy(false); }
      busyRef.current = false; onBusyChange?.(false); return;
    }
    if (!mounted.current) { busyRef.current = false; onBusyChange?.(false); return; }
    let refreshed = false;
    try { refreshed = (await onCompleted()) !== false; } catch { /* The mutation has already committed. Never invite a repeated POST. */ }
    // Refresh can unmount this row behind a loading skeleton. Always release the
    // parent lock even when this dialog no longer exists after the committed POST.
    busyRef.current = false; onBusyChange?.(false);
    if (!mounted.current) return;
    setMessage(refreshed ? `${participantCommandLabels[action]} berhasil disimpan. Riwayat peserta tetap tersimpan.` : "Perubahan sudah tersimpan, tetapi daftar belum diperbarui. Muat ulang; jangan kirim aksi yang sama lagi.");
    setBusy(false); setOpen(false); dialog.current?.close();
  };
  const control = "mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:outline-emerald-700";
  return <div>
    <button ref={trigger} type="button" disabled={disabled || busy} onClick={openDialog} aria-haspopup="dialog" aria-controls={`${id}-dialog`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700 disabled:opacity-50"><Settings2 className="h-4 w-4" /> Kelola status</button>
    {message && <p role="status" className="mt-2 max-w-xs text-xs text-emerald-800">{message}</p>}
    <dialog id={`${id}-dialog`} ref={dialog} aria-labelledby={`${id}-title`} aria-busy={busy}
      onCancel={(event) => { if (busyRef.current) event.preventDefault(); }}
      onClose={() => { setOpen(false); trigger.current?.focus(); }}
      onClick={(event) => { if (event.target === dialog.current) close(); }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/50">
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-5"><div><h2 id={`${id}-title`} className="text-lg font-black">Kelola peserta</h2><p className="mt-1 text-sm">{participant.name}</p><p className="mt-1 font-mono text-xs text-slate-500">{participant.participantCode}</p></div><button type="button" onClick={close} disabled={busy} aria-label="Tutup pengelolaan peserta" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg hover:bg-slate-100"><X className="h-5 w-5" /></button></header>
      <form onSubmit={(event) => void submit(event)} className="space-y-4 p-5">
        <fieldset disabled={busy || demoMode} className="min-w-0 space-y-4">
          <label className="block text-sm font-bold">Aksi<select value={action} onChange={(event) => { setAction(event.target.value as ParticipantCommand); setError(""); }} className={control}>{actions.map((value) => <option key={value} value={value}>{participantCommandLabels[value]}</option>)}</select></label>
          {action === "replace" && <>
            <label className="block text-sm font-bold">Cari asatidz pengganti<input value={search} onChange={(event) => { setSearch(event.target.value); setSelected(""); }} maxLength={100} placeholder="Nama atau email, minimal 2 karakter" className={control} /></label>
            <label className="block text-sm font-bold">Pengganti<select value={selected} required onChange={(event) => setSelected(event.target.value)} className={control}><option value="">{searching ? "Mencari…" : "Pilih asatidz yang belum terdaftar"}</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.fullName}{candidate.email ? ` · ${candidate.email}` : ""}</option>)}</select></label>
            <p className="rounded-lg bg-sky-50 p-3 text-xs text-sky-950">Pengganti perlu persetujuan baru. QR dan riwayat peserta lama tidak dialihkan.</p>
          </>}
          {action === "cancel" && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-950">QR dinonaktifkan. Riwayat pendaftaran dan presensi tetap tersimpan.</p>}
          <label className="block text-sm font-bold">Alasan *<textarea ref={reasonInput} value={reason} onChange={(event) => setReason(event.target.value)} required minLength={3} maxLength={1000} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm focus:outline-emerald-700" /></label>
        </fieldset>
        {demoMode && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Mode pratinjau; perubahan status tidak dikirim ke database.</p>}
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-950">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} onClick={close} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold">Batal</button><button type="submit" disabled={busy || demoMode || disabled || searching} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? "Menyimpan…" : "Simpan perubahan"}</button></div>
      </form>
    </dialog>
  </div>;
};
