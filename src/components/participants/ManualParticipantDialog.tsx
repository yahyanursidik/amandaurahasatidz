import React, { useEffect, useId, useRef, useState } from "react";
import { Loader2, UserPlus, X } from "lucide-react";
import { eventApi } from "@/lib/eventApi";

export interface ManualParticipantDialogProps {
  eventId: string;
  eventName?: string;
  demoMode?: boolean;
  onCreated: () => Promise<void> | void;
}

type ParticipantFields = {
  fullName: string;
  email: string;
  whatsapp: string;
  phone: string;
  address: string;
  institutionName: string;
  notes: string;
  attendanceConfirmed: boolean;
};

const emptyFields: ParticipantFields = {
  fullName: "",
  email: "",
  whatsapp: "",
  phone: "",
  address: "",
  institutionName: "",
  notes: "",
  attendanceConfirmed: false,
};

const inputClassName = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 disabled:bg-slate-100";
const secondaryButtonClassName = "min-h-[44px] rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50";

// eventApi supplies ENV.API_BASE_URL, JSON handling, and session cookies.
// Keep the legacy token header compatible with the event registration API.
async function createManualParticipant(eventId: string, fields: ParticipantFields): Promise<void> {
  const token = localStorage.getItem("yts_auth_token") || "";
  await eventApi(`/events/${encodeURIComponent(eventId)}/participants/manual`, {
    method: "POST",
    headers: token ? { Authorization: token } : undefined,
    body: JSON.stringify({
      fullName: fields.fullName.trim(),
      email: fields.email.trim(),
      whatsapp: fields.whatsapp.trim(),
      // Omit blank optional values; the backend owns the phone fallback.
      phone: fields.phone.trim() || undefined,
      address: fields.address.trim() || undefined,
      institutionName: fields.institutionName.trim() || undefined,
      notes: fields.notes.trim() || undefined,
      attendanceConfirmed: fields.attendanceConfirmed,
    }),
  });
}

export const ManualParticipantDialog: React.FC<ManualParticipantDialogProps> = ({
  eventId,
  eventName,
  demoMode = false,
  onCreated,
}) => {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  // A synchronous lock also guards duplicate submissions before React rerenders.
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<ParticipantFields>({ ...emptyFields });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const openDialog = () => {
    if (busyRef.current || dialogRef.current?.open) return;
    setMessage("");
    dialogRef.current?.showModal();
    nameRef.current?.focus();
  };

  const closeDialog = () => {
    if (!busyRef.current) dialogRef.current?.close();
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busyRef.current || demoMode) return;
    if (!event.currentTarget.reportValidity()) return;
    if (!eventId.trim()) {
      setError("Event belum dipilih. Pilih event sebelum menambahkan peserta.");
      return;
    }
    if (!fields.fullName.trim() || !fields.email.trim() || !fields.whatsapp.trim()) {
      setError("Nama lengkap, email, dan nomor WhatsApp wajib diisi, bukan hanya spasi.");
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await createManualParticipant(eventId, fields);
    } catch (reason) {
      if (!mountedRef.current) return;
      setError(reason instanceof Error ? reason.message : "Peserta belum dapat disimpan. Silakan coba lagi.");
      busyRef.current = false;
      setBusy(false);
      return; // Preserve every field for correction or retry.
    }

    // The POST succeeded. A refresh failure must not invite a duplicate POST.
    if (!mountedRef.current) return;
    setFields({ ...emptyFields });
    try {
      await onCreated();
      if (!mountedRef.current) return;
      setMessage("Peserta berhasil ditambahkan dengan status menunggu peninjauan (PENDING_REVIEW).");
    } catch {
      if (!mountedRef.current) return;
      setMessage("Peserta sudah tersimpan dan menunggu peninjauan, tetapi daftar peserta belum dapat diperbarui. Muat ulang daftar; jangan kirim peserta yang sama lagi.");
    } finally {
      if (!mountedRef.current) return;
      busyRef.current = false;
      setBusy(false);
      dialogRef.current?.close();
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openDialog}
        disabled={busy}
        aria-haspopup="dialog"
        aria-controls={`${id}-dialog`}
        className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg bg-emerald-800 px-4 text-sm font-bold text-white hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <UserPlus aria-hidden="true" className="h-4 w-4" />
        Tambah peserta manual
      </button>
      <p role="status" aria-live="polite" className={message ? "mt-2 max-w-xl text-sm leading-6 text-slate-700" : "sr-only"}>
        {message}
      </p>

      <dialog
        id={`${id}-dialog`}
        ref={dialogRef}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        aria-busy={busy}
        onCancel={(event) => {
          if (busyRef.current) event.preventDefault();
        }}
        onClose={() => triggerRef.current?.focus()}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
            closeDialog();
          }
        }}
        className="m-auto max-h-[90dvh] w-[min(42rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/60"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 p-5">
          <div className="min-w-0">
            <h2 id={`${id}-title`} className="text-xl font-black text-slate-950">Tambah peserta manual</h2>
            <p className="mt-1 break-words text-sm text-slate-600">{eventName || "Event daurah"}</p>
          </div>
          <button type="button" onClick={closeDialog} disabled={busy} aria-label="Tutup dialog tambah peserta" className={`${secondaryButtonClassName} grid min-w-[44px] place-items-center px-2`}>
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={submit} className="space-y-5 p-5">
          <p id={`${id}-description`} className="text-sm leading-6 text-slate-600">
            Peserta baru selalu berstatus menunggu peninjauan (PENDING_REVIEW), bukan langsung disetujui. Kolom bertanda * wajib diisi.
            {" "}Profil yang identitasnya cocok akan digunakan kembali tanpa menimpa data induk; konflik nama atau kontak harus diperbaiki terlebih dahulu di profil master.
          </p>
          {demoMode && (
            <div role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
              Mode demo: formulir dapat dicoba, tetapi penyimpanan dinonaktifkan. Tidak ada data yang dikirim atau peserta yang ditambahkan.
            </div>
          )}
          {error && (
            <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-900 focus:outline focus:outline-2 focus:outline-rose-700">
              {error}
            </div>
          )}

          <fieldset disabled={busy} className="min-w-0 space-y-4">
            <legend className="sr-only">Data peserta manual</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {([
                { key: "fullName", label: "Nama lengkap", type: "text", required: true, autoComplete: "name" },
                { key: "email", label: "Email", type: "email", required: true, autoComplete: "email" },
                { key: "whatsapp", label: "Nomor WhatsApp", type: "tel", required: true, autoComplete: "tel" },
                { key: "phone", label: "Nomor telepon (opsional)", type: "tel", required: false, autoComplete: "off" },
              ] as const).map((field) => (
                <div key={field.key}>
                  <label htmlFor={`${id}-${field.key}`} className="text-sm font-bold text-slate-800">{field.label}{field.required && " *"}</label>
                  <input
                    ref={field.key === "fullName" ? nameRef : undefined}
                    id={`${id}-${field.key}`}
                    name={field.key}
                    type={field.type}
                    required={field.required}
                    autoComplete={field.autoComplete}
                    value={fields[field.key]}
                    onChange={(event) => setFields((current) => ({ ...current, [field.key]: event.target.value }))}
                    className={inputClassName}
                  />
                </div>
              ))}
            </div>
            <div>
              <label htmlFor={`${id}-institutionName`} className="text-sm font-bold text-slate-800">Nama lembaga (opsional)</label>
              <input id={`${id}-institutionName`} name="institutionName" type="text" autoComplete="organization" value={fields.institutionName} onChange={(event) => setFields((current) => ({ ...current, institutionName: event.target.value }))} aria-describedby={`${id}-institution-help`} className={inputClassName} />
              <p id={`${id}-institution-help`} className="mt-1 text-xs leading-5 text-slate-500">Ketik nama lembaga, termasuk nama yang sudah ada di master lembaga. Kosongkan untuk peserta individu.</p>
            </div>
            {([
              { key: "address", label: "Alamat (opsional)", autoComplete: "street-address" },
              { key: "notes", label: "Catatan (opsional)", autoComplete: "off" },
            ] as const).map((field) => (
              <div key={field.key}>
                <label htmlFor={`${id}-${field.key}`} className="text-sm font-bold text-slate-800">{field.label}</label>
                <textarea id={`${id}-${field.key}`} name={field.key} rows={2} autoComplete={field.autoComplete} value={fields[field.key]} onChange={(event) => setFields((current) => ({ ...current, [field.key]: event.target.value }))} className={inputClassName} />
              </div>
            ))}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <label htmlFor={`${id}-attendanceConfirmed`} className="flex min-h-[44px] items-center gap-3 text-sm font-bold text-slate-800">
                <input id={`${id}-attendanceConfirmed`} name="attendanceConfirmed" type="checkbox" checked={fields.attendanceConfirmed} onChange={(event) => setFields((current) => ({ ...current, attendanceConfirmed: event.target.checked }))} aria-describedby={`${id}-confirmation-help`} className="h-4 w-4 shrink-0 accent-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700" />
                Peserta sudah mengonfirmasi kesediaan hadir
              </label>
              <p id={`${id}-confirmation-help`} className="mt-1 text-xs leading-5 text-slate-600">Ini hanya konfirmasi kesediaan hadir, bukan presensi/check-in dan bukan persetujuan peserta.</p>
            </div>
          </fieldset>

          <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={closeDialog} disabled={busy} className={secondaryButtonClassName}>Batal</button>
            <button type="submit" disabled={busy || demoMode || !eventId.trim()} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 text-sm font-bold text-white hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
              {busy && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
              {busy ? "Menyimpan peserta…" : "Simpan peserta"}
            </button>
          </footer>
        </form>
      </dialog>
    </>
  );
};