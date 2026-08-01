import React, { useState } from "react";
import { Check, Clipboard, KeyRound, Loader2, ShieldAlert, X } from "lucide-react";
import { eventApi } from "@/lib/eventApi";

type PortalCredential = {
  participantId: string;
  participantName: string;
  email: string;
  temporaryPassword: string | null;
  loginUrl: string;
  action: "CREATED" | "RESET" | "LINKED_EXISTING";
  shownOnce: boolean;
};

type Props = {
  eventId: string;
  participant: {
    id: string;
    name: string;
    email?: string | null;
    portalPasswordConfigured?: boolean | null;
  };
  previewMode?: boolean;
  onCompleted?: () => void | Promise<void>;
};

export const ParticipantPortalAccessAction: React.FC<Props> = ({
  eventId,
  participant,
  previewMode = false,
  onCompleted,
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [credential, setCredential] = useState<PortalCredential | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!participant.email) return;
    const resetExisting = Boolean(participant.portalPasswordConfigured);
    if (
      resetExisting &&
      !window.confirm(
        `Reset password portal ${participant.name}? Password lama akan langsung tidak berlaku.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = previewMode
        ? {
            participantId: participant.id,
            participantName: participant.name,
            email: participant.email,
            temporaryPassword: "Aman!Demo2026#7",
            loginUrl: "/login/ustadz",
            action: resetExisting ? ("RESET" as const) : ("CREATED" as const),
            shownOnce: true,
          }
        : await eventApi<PortalCredential>(
            `/events/${eventId}/participants/${participant.id}/portal-account`,
            {
              method: "POST",
              body: JSON.stringify({ resetExisting }),
            },
          );
      setCredential(result);
      await onCompleted?.();
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Login portal tidak dapat dibuat.");
    } finally {
      setBusy(false);
    }
  };

  const loginUrl = credential
    ? new URL(credential.loginUrl, window.location.origin).toString()
    : "";
  const credentialText = credential
    ? [
        "Akses Portal Peserta Aman Daurah Asatidz",
        `Nama: ${credential.participantName}`,
        `Email: ${credential.email}`,
        ...(credential.temporaryPassword ? [`Password sementara: ${credential.temporaryPassword}`] : []),
        `Login: ${loginUrl}`,
        "Mohon simpan secara pribadi dan segera ganti password setelah berhasil masuk.",
      ].join("\n")
    : "";

  const copyCredential = async () => {
    await navigator.clipboard.writeText(credentialText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <>
      <div>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy || !participant.email}
          title={!participant.email ? "Lengkapi email peserta terlebih dahulu" : undefined}
          className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {participant.portalPasswordConfigured ? "Reset login" : "Buat login"}
        </button>
        {error && <p className="mt-1 max-w-56 text-xs leading-5 text-rose-700">{error}</p>}
      </div>

      {credential && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="portal-credential-title" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Kredensial siap</p>
                <h2 id="portal-credential-title" className="mt-1 text-xl font-black text-slate-950">Login portal {credential.participantName}</h2>
              </div>
              <button type="button" onClick={() => setCredential(null)} aria-label="Tutup" className="grid h-11 w-11 place-items-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </header>

            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              <div className="flex items-start gap-2"><ShieldAlert className="mt-1 h-4 w-4 shrink-0" /><p>{credential.temporaryPassword ? "Password hanya ditampilkan sekarang. Bagikan langsung kepada peserta melalui kanal pribadi." : "Peserta sudah memiliki akun dengan email yang sama. Profil ditautkan tanpa mengubah password yang lama."}</p></div>
            </div>
            <dl className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div><dt className="font-bold text-slate-500">Email login</dt><dd className="mt-1 break-all font-mono font-bold text-slate-950">{credential.email}</dd></div>
              <div><dt className="font-bold text-slate-500">Password</dt><dd className="mt-1 break-all font-mono text-lg font-black text-slate-950">{credential.temporaryPassword || "Gunakan password akun yang sudah dimiliki"}</dd></div>
              <div><dt className="font-bold text-slate-500">Halaman login</dt><dd className="mt-1 break-all text-emerald-800">{loginUrl}</dd></div>
            </dl>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setCredential(null)} className="min-h-[44px] rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700">Tutup</button>
              <button type="button" onClick={() => void copyCredential()} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">
                {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                {copied ? "Kredensial tersalin" : "Salin kredensial"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
};
