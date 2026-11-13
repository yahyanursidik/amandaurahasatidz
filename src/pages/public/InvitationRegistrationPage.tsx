import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, CheckCircle2, MapPin, Users } from "lucide-react";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { InvitationResponseForm, type InvitationResponsePayload } from "@/components/invitations/InvitationResponseForm";
import { ENV } from "@/config/env";
import { PublicRegistrationReceipt } from "@/components/public/PublicRegistrationReceipt";
import { readRegistrationProof, saveRegistrationProof } from "@/lib/registrationProof";
import type { ReceiptParticipant } from "@/lib/publicRegistrationReceipt";
import { formatEventDate, formatEventDateTime, eventTimezoneLabel } from "@/lib/eventDateTime";
import { invitationIsSelfRegistration, type InvitationRegistrationMode } from "@/lib/institutionInvitation";

type InvitationData = {
  invitation: { invitationNumber: string; quota?: number | null; totalQuota?: number; registeredCount?: number; remainingQuota?: number; registrationMode?: InvitationRegistrationMode; allowGroup?: boolean; responseDeadline?: string | null; status: string };
  event: { name: string; slug?: string; timezone?: string; startDate: string; endDate: string; venueName?: string | null; publicContactWhatsapp?: string | null; attendanceConfirmationRequired?: boolean };
  institution?: { name: string; code: string } | null;
  recipient?: { fullName: string } | null;
};
type Submission = {
  message: string;
  participants?: Array<Pick<ReceiptParticipant, "participantCode" | "registrationStatusUrl" | "confirmationUrl" | "whatsapp" | "approvalStatus" | "confirmationStatus"> & { id: string }>;
  emailQueued?: number;
  portalAccounts?: Array<{ participantId: string; participantName: string; email: string; temporaryPassword?: string | null; temporaryPasswordIssued?: boolean; passwordSetupRequired?: boolean; loginUrl: string; setupError?: string }>;
};

export const InvitationRegistrationPage: React.FC = () => {
  const { token = "" } = useParams<{ token: string }>();
  const invitationType = useLocation().pathname.includes("/individual/") ? "individual" : "institution";
  const proofKey = `registration:invitation:${invitationType}:${token}`;
  const [data, setData] = useState<InvitationData | null>(() => readRegistrationProof<InvitationData, Submission>(proofKey)?.event || null);
  const [delegates, setDelegates] = useState<InvitationResponsePayload["delegates"]>([]);
  const [submission, setSubmission] = useState<Submission | null>(() => readRegistrationProof<InvitationData, Submission>(proofKey)?.result || null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!data);
  const [saving, setSaving] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [policyNotice, setPolicyNotice] = useState("");
  const [policyBlocked, setPolicyBlocked] = useState(false);
  const current = useRef({ data, submission, saving, proofKey, policyBlocked });
  const submissionInFlight = useRef<string | null>(null);
  current.current = { data, submission, saving, proofKey, policyBlocked };
  const receiptParticipants: ReceiptParticipant[] = submission?.participants?.map((person, index) => {
    const account = submission.portalAccounts?.find((item) => item.participantId === person.id);
    return {
      fullName: account?.participantName || delegates[index]?.fullName || "Peserta",
      email: account?.email || delegates[index]?.email || "",
      whatsapp: person.whatsapp,
      participantCode: person.participantCode,
      registrationStatusUrl: person.registrationStatusUrl,
      confirmationUrl: person.confirmationUrl,
      approvalStatus: person.approvalStatus,
      confirmationStatus: person.confirmationStatus,
      passwordSetupRequired: account?.passwordSetupRequired ?? !account?.temporaryPassword,
      temporaryPassword: account?.temporaryPassword,
      temporaryPasswordIssued: account?.temporaryPasswordIssued,
    };
  }) || [];
  const selfRegistration = Boolean(data && invitationIsSelfRegistration({ ...data.invitation, invitationType: invitationType.toUpperCase() }));
  const selfRegistrationFull = selfRegistration && (data?.invitation.remainingQuota ?? 1) <= 0;

  useEffect(() => {
    // A representative may reopen the same link after the foundation converts it
    // to individual sign-up. Keep their saved receipt, but reveal the next-person action.
    if (!submission || !data || invitationType !== "institution" || selfRegistration) return;
    const controller = new AbortController();
    void fetch(`${ENV.API_BASE_URL}/invitations/public/institution/${encodeURIComponent(token)}/policy`, {
      signal: controller.signal, cache: "no-store",
    }).then(async (response) => response.ok ? response.json() : null).then((payload) => {
      if (!controller.signal.aborted && payload?.data?.registrationMode === "INDIVIDUAL_SELF") {
        setData((existing) => existing ? { ...existing, invitation: { ...existing.invitation, ...payload.data } } : existing);
      }
    }).catch(() => { /* Preserve the saved receipt if policy cannot be refreshed. */ });
    return () => controller.abort();
  }, [submission, data?.invitation.registrationMode, invitationType, token, selfRegistration]);

  useEffect(() => {
    const proof = readRegistrationProof<InvitationData, Submission>(proofKey);
    if (proof) { setData(proof.event); setSubmission(proof.result); setLoading(false); setError(""); return; }
    const controller = new AbortController();
    setLoading(true); setError(""); setData(null); setSubmission(null); setDelegates([]); setPolicyNotice(""); setPolicyBlocked(false); setVerificationToken(""); setAccessCode("");
    void Promise.resolve().then(() => controller.signal.aborted ? null
      : fetch(`${ENV.API_BASE_URL}/invitations/public/${invitationType}/${encodeURIComponent(token)}`, { signal: controller.signal, cache: "no-store" }))
      .then(async (response) => {
        if (!response) return;
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message || "Undangan tidak dapat dibuka. Minta tautan baru dari panitia.");
        if (!controller.signal.aborted) setData(result.data);
      })
      .catch((reason) => { if (!controller.signal.aborted) { setData(null); setError(reason instanceof Error ? reason.message : "Undangan tidak dapat dibuka."); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, invitationType, proofKey]);

  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    const refreshPolicy = async () => {
      if (pending || document.visibilityState === "hidden" || !current.current.data || current.current.submission || current.current.saving) return;
      pending = true;
      try {
        const response = await fetch(`${ENV.API_BASE_URL}/invitations/public/${invitationType}/${encodeURIComponent(token)}/policy`, { signal: controller.signal, cache: "no-store" });
        const payload = await response.json();
        if (controller.signal.aborted || current.current.proofKey !== proofKey || current.current.submission || current.current.saving) return;
        if (!response.ok) {
          if ([403, 404, 409].includes(response.status)) { setPolicyBlocked(true); setError(payload.error?.message || "Undangan tidak lagi menerima konfirmasi."); }
          return;
        }
        const policy = payload.data as InvitationData["invitation"];
        if (!policy || typeof policy.quota !== "number" || typeof policy.allowGroup !== "boolean") return;
        const previous = current.current.data?.invitation;
        if (previous && (previous.quota !== policy.quota || previous.allowGroup !== policy.allowGroup || previous.responseDeadline !== policy.responseDeadline || previous.totalQuota !== policy.totalQuota)) {
          setPolicyNotice(policy.registrationMode === "INDIVIDUAL_SELF"
            ? `Kuota atau tenggat undangan telah diperbarui. Periksa sisa kursi sebelum mengirim.`
            : `Pengaturan undangan diperbarui oleh panitia. Maksimal ${policy.quota} peserta termasuk peserta utama. Anggota di luar batas baru dibersihkan; periksa data dan persetujuan kembali.`);
        }
        if (current.current.policyBlocked) setError("");
        setPolicyBlocked(false);
        setData((existing) => existing ? { ...existing, invitation: { ...existing.invitation, ...policy } } : existing);
      } catch { /* Keep entered data during an offline policy check; POST still enforces current server limits. */ }
      finally { pending = false; }
    };
    window.addEventListener("focus", refreshPolicy);
    document.addEventListener("visibilitychange", refreshPolicy);
    return () => { controller.abort(); window.removeEventListener("focus", refreshPolicy); document.removeEventListener("visibilitychange", refreshPolicy); };
  }, [token, invitationType, proofKey]);

  const submit = async (payload: InvitationResponsePayload) => {
    if (saving || policyBlocked || submissionInFlight.current === proofKey) return;
    if (invitationType === "institution" && !verificationToken) { setVerifyError("Isi kode unik lembaga dari panitia terlebih dahulu."); return; }
    submissionInFlight.current = proofKey;
    setError("");
    setDelegates(payload.delegates);
    setSaving(true);
    try {
      const response = await fetch(`${ENV.API_BASE_URL}/invitations/public/${invitationType}/${encodeURIComponent(token)}/response`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, ...(invitationType === "institution" ? { verificationToken } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Konfirmasi undangan gagal disimpan.");
      if (data) saveRegistrationProof(proofKey, { event: data, result: result.data });
      if (current.current.proofKey === proofKey) setSubmission(result.data);
    } catch (reason) { if (current.current.proofKey === proofKey) { setError(reason instanceof Error ? reason.message : "Konfirmasi gagal diproses."); if (invitationType === "institution") setVerificationToken(""); } }
    finally {
      if (submissionInFlight.current === proofKey) submissionInFlight.current = null;
      if (current.current.proofKey === proofKey) setSaving(false);
    }
  };

  return <PublicLayout>
    <div className={`mx-auto space-y-5 py-4 text-slate-900 ${submission ? "max-w-4xl" : "max-w-3xl"}`}>
      <Link to={data?.event.slug ? `/events/${data.event.slug}` : "/"} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-emerald-800"><ArrowLeft className="h-4 w-4" /> {data?.event.slug ? "Lihat acara" : "Beranda"}</Link>
      {loading ? <p role="status" className="rounded-xl bg-white p-8 text-sm">Memuat formulir undangan…</p> : !data ?
        <section role="alert" className="rounded-xl border border-rose-200 bg-white p-6"><h1 className="text-xl font-black">Undangan tidak tersedia</h1><p className="mt-2 text-sm">{error}</p></section> : <>
          <header className="rounded-2xl bg-emerald-950 p-6 text-white sm:p-8">
            <p className="text-sm font-bold text-emerald-200">{invitationType === "individual" ? "Undangan pribadi" : selfRegistration ? "Undangan lembaga · pendaftaran mandiri" : "Undangan lembaga"} · {data.invitation.invitationNumber}</p>
            <h1 className="mt-3 text-2xl font-black">{data.event.name}</h1>
            {selfRegistration && data.institution && <p className="mt-2 text-base font-semibold text-emerald-100">Ahlan wa sahlan, asatidz {data.institution.name}</p>}
            {invitationType === "individual" && data.recipient && <p className="mt-2 text-base font-semibold text-emerald-100">Untuk {data.recipient.fullName}</p>}
            <p className="mt-3 flex items-start gap-2 text-sm text-emerald-100"><CalendarDays className="h-4 w-4 shrink-0" />{formatEventDate(data.event.startDate)}{data.event.startDate !== data.event.endDate ? ` – ${formatEventDate(data.event.endDate)}` : ""}</p>
            <p className="mt-2 flex items-start gap-2 text-sm text-emerald-100"><MapPin className="h-4 w-4 shrink-0" />{data.event.venueName || "Lokasi menyusul"}</p>
            {data.invitation.responseDeadline && !submission && <p className="mt-4 border-t border-emerald-800 pt-3 text-sm text-emerald-200">Konfirmasi sebelum {formatEventDateTime(data.invitation.responseDeadline, data.event.timezone || "Asia/Jakarta")} {eventTimezoneLabel(data.event.timezone || "Asia/Jakarta")}</p>}
          </header>
          {!submission && invitationType === "institution" && !verificationToken && <form className="rounded-xl border border-slate-200 bg-white p-5" onSubmit={(event) => {
            event.preventDefault(); if (verifying) return; setVerifying(true); setVerifyError("");
            void fetch(`${ENV.API_BASE_URL}/invitations/public/institution/${encodeURIComponent(token)}/code/verify`, {
              method: "POST", cache: "no-store", referrerPolicy: "no-referrer", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: accessCode }),
            }).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error?.message || "Kode belum dapat diperiksa."); setVerificationToken(body.data.verificationToken); })
              .catch((cause) => setVerifyError(cause instanceof Error ? cause.message : "Kode belum dapat diperiksa."))
              .finally(() => setVerifying(false));
          }}>
            <label className="block text-sm font-bold" htmlFor="institution-access-code">Kode unik lembaga
              <input id="institution-access-code" autoComplete="off" required minLength={8} maxLength={12} value={accessCode} disabled={verifying}
                onChange={(event) => setAccessCode(event.target.value.toUpperCase())} placeholder="ABCD-2345"
                className="mt-2 min-h-12 w-full rounded-lg border border-slate-300 px-3 font-mono text-lg focus-visible:outline-2 focus-visible:outline-emerald-700" />
            </label>
            <p className="my-3 text-sm text-slate-600">Gunakan kode yang disampaikan panitia bersama undangan {data.institution?.name || "lembaga"}. Tidak perlu menunggu OTP email.</p>
            {verifyError && <p role="alert" className="mb-3 text-sm text-rose-800">{verifyError}</p>}
            <button type="submit" disabled={verifying} className="inline-flex min-h-12 items-center whitespace-nowrap rounded-lg bg-emerald-700 px-4 font-bold text-white disabled:opacity-60">{verifying ? "Memeriksa…" : "Verifikasi kode"}</button>
          </form>}
           {submission ? <>
             {receiptParticipants.length > 0 ? <PublicRegistrationReceipt event={data.event} participants={receiptParticipants} emailQueued={submission.emailQueued || 0} approvalStatus={submission.participants?.[0]?.approvalStatus} /> : <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-6" aria-live="polite"><CheckCircle2 className="h-8 w-8 text-emerald-700" /><h2 className="mt-3 text-xl font-black">Jawaban undangan tersimpan</h2><p className="mt-2 text-sm">{submission.message}</p><p className="mt-3 text-sm">Karena berhalangan hadir, tidak ada QR atau akses portal baru.</p></section>}
             {selfRegistration && receiptParticipants.length > 0 && <section className="rounded-2xl border border-sky-200 bg-sky-50 p-5"><h2 className="font-black text-sky-950">Asatidz lain dari lembaga ini?</h2><p className="mt-1 text-sm text-sky-900">Simpan tautan status pribadi dan akses portal Anda sebelum membuka formulir untuk asatidz berikutnya.</p><button type="button" onClick={() => { try { window.sessionStorage.removeItem(proofKey); } catch { /* The current receipt is still visible. */ } window.location.reload(); }} className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-xl bg-sky-800 px-5 font-bold text-white hover:bg-sky-900"><Users className="h-5 w-5" /> Daftarkan asatidz lain</button></section>}
           </> : selfRegistrationFull ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6" role="status"><h2 className="text-xl font-black text-amber-950">Kuota lembaga sudah penuh</h2><p className="mt-2 text-sm text-amber-900">Seluruh {data.invitation.totalQuota || 1} kursi telah terisi atau sedang menunggu persetujuan admin. Hubungi panitia bila ada perubahan peserta.</p><button type="button" onClick={() => window.location.reload()} className="mt-4 min-h-11 rounded-lg border border-amber-700 px-4 text-sm font-bold text-amber-950">Periksa kuota lagi</button></section> : <InvitationResponseForm key={`${invitationType}:${token}`} data={data} invitationType={invitationType} saving={saving} error={error} policyNotice={policyNotice} unavailable={policyBlocked || invitationType === "institution" && !verificationToken} onSubmit={(payload) => void submit(payload)} />}
        </>}
    </div>
  </PublicLayout>;
};
