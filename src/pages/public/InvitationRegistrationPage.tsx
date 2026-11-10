import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, CheckCircle2, MapPin } from "lucide-react";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { InvitationResponseForm, type InvitationResponsePayload } from "@/components/invitations/InvitationResponseForm";
import { ENV } from "@/config/env";
import { PublicRegistrationReceipt } from "@/components/public/PublicRegistrationReceipt";
import { readRegistrationProof, saveRegistrationProof } from "@/lib/registrationProof";
import type { ReceiptParticipant } from "@/lib/publicRegistrationReceipt";
import { formatEventDate, formatEventDateTime, eventTimezoneLabel } from "@/lib/eventDateTime";

type InvitationData = {
  invitation: { invitationNumber: string; quota?: number | null; allowGroup?: boolean; responseDeadline?: string | null; status: string };
  event: { name: string; slug?: string; timezone?: string; startDate: string; endDate: string; venueName?: string | null; publicContactWhatsapp?: string | null };
  institution?: { name: string; code: string } | null;
  recipient?: { fullName: string } | null;
};
type Submission = {
  message: string;
  participants?: Array<{ id: string; participantCode: string; qrToken: string; cardUrl: string; whatsapp?: string | null; approvalStatus: string }>;
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
      qrToken: person.qrToken,
      cardUrl: person.cardUrl,
      passwordSetupRequired: account?.passwordSetupRequired ?? !account?.temporaryPassword,
      temporaryPassword: account?.temporaryPassword,
      temporaryPasswordIssued: account?.temporaryPasswordIssued,
    };
  }) || [];

  useEffect(() => {
    const proof = readRegistrationProof<InvitationData, Submission>(proofKey);
    if (proof) { setData(proof.event); setSubmission(proof.result); setLoading(false); setError(""); return; }
    const controller = new AbortController();
    setLoading(true); setError(""); setData(null); setSubmission(null); setDelegates([]); setPolicyNotice(""); setPolicyBlocked(false);
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
        if (previous && (previous.quota !== policy.quota || previous.allowGroup !== policy.allowGroup || previous.responseDeadline !== policy.responseDeadline)) {
          setPolicyNotice(`Pengaturan undangan diperbarui oleh panitia. Maksimal ${policy.quota} peserta termasuk peserta utama. Anggota di luar batas baru dibersihkan; periksa data dan persetujuan kembali.`);
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
    submissionInFlight.current = proofKey;
    setError("");
    setDelegates(payload.delegates);
    setSaving(true);
    try {
      const response = await fetch(`${ENV.API_BASE_URL}/invitations/public/${invitationType}/${encodeURIComponent(token)}/response`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Konfirmasi undangan gagal disimpan.");
      if (data) saveRegistrationProof(proofKey, { event: data, result: result.data });
      if (current.current.proofKey === proofKey) setSubmission(result.data);
    } catch (reason) { if (current.current.proofKey === proofKey) setError(reason instanceof Error ? reason.message : "Konfirmasi gagal diproses."); }
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
            <p className="text-sm font-bold text-emerald-200">{invitationType === "individual" ? "Undangan pribadi" : "Undangan lembaga"} · {data.invitation.invitationNumber}</p>
            <h1 className="mt-3 text-2xl font-black">{data.event.name}</h1>
            {invitationType === "individual" && data.recipient && <p className="mt-2 text-base font-semibold text-emerald-100">Untuk {data.recipient.fullName}</p>}
            <p className="mt-3 flex items-start gap-2 text-sm text-emerald-100"><CalendarDays className="h-4 w-4 shrink-0" />{formatEventDate(data.event.startDate)}{data.event.startDate !== data.event.endDate ? ` – ${formatEventDate(data.event.endDate)}` : ""}</p>
            <p className="mt-2 flex items-start gap-2 text-sm text-emerald-100"><MapPin className="h-4 w-4 shrink-0" />{data.event.venueName || "Lokasi menyusul"}</p>
            {data.invitation.responseDeadline && !submission && <p className="mt-4 border-t border-emerald-800 pt-3 text-sm text-emerald-200">Konfirmasi sebelum {formatEventDateTime(data.invitation.responseDeadline, data.event.timezone || "Asia/Jakarta")} {eventTimezoneLabel(data.event.timezone || "Asia/Jakarta")}</p>}
          </header>
           {submission ? receiptParticipants.length > 0 ? <PublicRegistrationReceipt event={data.event} participants={receiptParticipants} emailQueued={submission.emailQueued || 0} approvalStatus={submission.participants?.[0]?.approvalStatus} /> : <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-6" aria-live="polite"><CheckCircle2 className="h-8 w-8 text-emerald-700" /><h2 className="mt-3 text-xl font-black">Jawaban undangan tersimpan</h2><p className="mt-2 text-sm">{submission.message}</p><p className="mt-3 text-sm">Karena berhalangan hadir, tidak ada QR atau akses portal baru.</p></section> : <InvitationResponseForm key={`${invitationType}:${token}`} data={data} invitationType={invitationType} saving={saving} error={error} policyNotice={policyNotice} unavailable={policyBlocked} onSubmit={(payload) => void submit(payload)} />}
        </>}
    </div>
  </PublicLayout>;
};
