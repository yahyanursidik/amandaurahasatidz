import React, { useEffect, useId, useRef, useState } from "react";
import { Loader2, Trash2, X } from "lucide-react";
import type { PermissionCode } from "@/config/permissions";
import { eventApi } from "@/lib/eventApi";

export const DeleteParticipantDialog: React.FC<{
  eventId: string;
  participant: { id: string; name: string; participantCode: string };
  permissions: PermissionCode[];
  disabled?: boolean;
  demoMode?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onDeleted: () => Promise<boolean | void> | boolean | void;
}> = ({ eventId, participant, permissions, disabled = false, demoMode = false, onBusyChange, onDeleted }) => {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null), busyRef = useRef(false), mounted = useRef(true);
  const [busy, setBusy] = useState(false), [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false), [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  if (!permissions.includes("participants.delete")) return null;

  const close = () => { if (!busyRef.current) dialog.current?.close(); };
  const open = () => {
    if (busyRef.current || disabled) return;
    setReason(""); setConfirmed(false); setError(""); setMessage("");
    dialog.current?.showModal(); cancel.current?.focus();
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busyRef.current || disabled || demoMode) return;
    if (!confirmed || reason.trim().length < 3) { setError("Isi alasan dan centang konfirmasi penghapusan."); return; }
    busyRef.current = true; setBusy(true); setError(""); onBusyChange?.(true);
    try {
      await eventApi(`/events/${eventId}/participants/${participant.id}`, {
        method: "DELETE", body: JSON.stringify({ reason: reason.trim() }),
      });
    } catch (cause) {
      if (mounted.current) { setError(cause instanceof Error ? cause.message : "Peserta belum dapat dihapus."); setBusy(false); }
      busyRef.current = false; onBusyChange?.(false); return;
    }
    // The delete has committed. Close before refreshing; the refresh may unmount this row.
    dialog.current?.close();
    let refreshed = false;
    if (mounted.current) {
      try { refreshed = (await onDeleted()) !== false; } catch { /* Never offer to repeat a committed delete. */ }
    }
    busyRef.current = false; onBusyChange?.(false);
    if (!mounted.current) return;
    setBusy(false);
    setMessage(refreshed ? "Peserta berhasil dihapus dari event." : "Peserta sudah dihapus. Muat ulang untuk memperbarui daftar.");
  };

  return <div>
    <button ref={trigger} type="button" onClick={open} disabled={disabled || busy} aria-haspopup="dialog" aria-controls={`${id}-dialog`}
      aria-label={`Hapus peserta ${participant.name}`}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-rose-300 px-3 text-sm font-bold text-rose-800 hover:bg-rose-50 disabled:opacity-50">
      <Trash2 className="h-4 w-4" /> Hapus peserta
    </button>
    {message && <p role="status" className="mt-2 max-w-xs text-xs text-emerald-800">{message}</p>}
    <dialog ref={dialog} id={`${id}-dialog`} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} aria-busy={busy}
      onCancel={(event) => { if (busyRef.current) event.preventDefault(); }} onClose={() => trigger.current?.focus()}
      onClick={(event) => { if (event.target === dialog.current) close(); }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/50">
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
        <div><h2 id={`${id}-title`} className="text-lg font-black">Hapus peserta dari event?</h2>
          <p className="mt-1 text-sm font-bold">{participant.name}</p><p className="mt-1 font-mono text-xs text-slate-500">{participant.participantCode}</p></div>
        <button type="button" onClick={close} disabled={busy} aria-label="Tutup penghapusan peserta" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg hover:bg-slate-100"><X className="h-5 w-5" /></button>
      </header>
      <form onSubmit={(event) => void submit(event)} className="space-y-4 p-5">
        <p id={`${id}-description`} className="rounded-lg bg-rose-50 p-3 text-sm text-rose-950">Pendaftaran, QR, dan presensi peserta pada event ini akan dihapus permanen. Data induk asatidz dan kepesertaan di event lain tetap tersimpan.</p>
        <fieldset disabled={busy || demoMode} className="space-y-4">
          <label className="block text-sm font-bold">Alasan penghapusan *<textarea value={reason} onChange={(event) => setReason(event.target.value)} required minLength={3} maxLength={1000} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm focus:outline-emerald-700" /></label>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" required checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-rose-700" /><span>Saya memahami peserta ini akan dihapus permanen dari event.</span></label>
        </fieldset>
        {demoMode && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Mode pratinjau; penghapusan dinonaktifkan.</p>}
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-950">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button ref={cancel} type="button" onClick={close} disabled={busy} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold">Batal</button>
          <button type="submit" disabled={busy || disabled || demoMode || !confirmed || reason.trim().length < 3} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-rose-700 px-4 text-sm font-bold text-white hover:bg-rose-800 disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? "Menghapus…" : "Hapus permanen"}</button>
        </div>
      </form>
    </dialog>
  </div>;
};
