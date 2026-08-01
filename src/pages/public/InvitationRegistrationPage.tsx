/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
 * Hallmark · macrostructure: Split Studio · tone: utilitarian-professional · anchor hue: emerald
 * genre: modern-minimal · theme: existing emerald-slate · nav: N9 · footer: Ft2
 */
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Crown,
  Info,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { ENV } from "@/config/env";
import { DEFAULT_EVENT_POSTER, posterObjectPosition } from "@/lib/eventPoster";

type InvitationType = "institution" | "individual";
type ResponseStatus = "ACCEPTED" | "DECLINED";

type Delegate = {
  fullName: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  isLead: boolean;
};

type InvitationData = {
  invitation: {
    invitationNumber: string;
    quota?: number | null;
    responseDeadline?: string | null;
  };
  event: {
    name: string;
    subtitle?: string | null;
    startDate: string;
    endDate: string;
    venueName?: string | null;
    venueAddress?: string | null;
    posterUrl?: string | null;
    posterAlt?: string | null;
    posterFocalPoint?: string | null;
  };
  institution?: {
    name: string;
    code: string;
    representativeEmailMasked?: string | null;
    verificationRequired?: boolean;
  } | null;
};

const EMPTY_DELEGATE: Delegate = {
  fullName: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  isLead: true,
};

const PREVIEW_INVITATION: InvitationData = {
  invitation: {
    invitationNumber: "INV-PRATINJAU-001",
    quota: 3,
    responseDeadline: "2026-08-05T16:59:00Z",
  },
  event: {
    name: "Daurah Asatidz Nasional 2026",
    subtitle: "Pratinjau alur verifikasi dan pendaftaran delegasi lembaga",
    startDate: "2026-08-15T01:00:00Z",
    endDate: "2026-08-18T09:00:00Z",
    venueName: "Aula Markaz",
    venueAddress: "Bandung, Jawa Barat",
    posterUrl: DEFAULT_EVENT_POSTER,
    posterAlt: "Interior perpustakaan sebagai poster pratinjau Daurah Asatidz",
    posterFocalPoint: "CENTER",
  },
  institution: {
    name: "Ma’had Ilmu Sunnah Bandung",
    code: "MISB-01",
    representativeEmailMasked: "ko••••@mahadsunnah.or.id",
    verificationRequired: true,
  },
};

function apiError(result: any, fallback: string) {
  const fieldErrors = result?.error?.details?.fieldErrors;
  if (fieldErrors) {
    const detail = Object.values(fieldErrors).flat().filter(Boolean).join(" ");
    return detail || result.error?.message || fallback;
  }
  return result?.error?.message || fallback;
}

function formatDate(value?: string | null, includeTime = false) {
  if (!value) return "Belum ditentukan";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  }).format(new Date(value));
}

export const InvitationRegistrationPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const location = useLocation();
  const invitationType: InvitationType = location.pathname.includes("/individual/")
    ? "individual"
    : "institution";

  const [data, setData] = useState<InvitationData | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [previewCode, setPreviewCode] = useState("");
  const [otpExpiresAt, setOtpExpiresAt] = useState("");
  const [otpMessage, setOtpMessage] = useState("");
  const [otpError, setOtpError] = useState("");
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [responseStatus, setResponseStatus] = useState<ResponseStatus>("ACCEPTED");
  const [delegates, setDelegates] = useState<Delegate[]>([]);
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [submission, setSubmission] = useState<any>(null);

  useEffect(() => {
    if (!token) {
      setPageError("Tautan undangan tidak lengkap. Minta panitia mengirim ulang tautan resmi.");
      setIsLoading(false);
      return;
    }
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(
          `${ENV.API_BASE_URL}/invitations/public/${invitationType}/${token}`,
          { signal: controller.signal },
        );
        const result = await response.json();
        if (!response.ok) throw new Error(apiError(result, "Undangan tidak dapat dibuka."));
        setData(result.data);
        if (invitationType === "individual") setVerificationToken("individual-link-verified");
      } catch (error) {
        if (!controller.signal.aborted) {
          if (import.meta.env.DEV) {
            setData(PREVIEW_INVITATION);
            setIsPreview(true);
          } else {
            setPageError(error instanceof Error ? error.message : "Undangan tidak dapat dibuka.");
          }
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [invitationType, token]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const quota = Math.max(1, data?.invitation.quota || 1);
  const verificationRequired = invitationType === "institution" && Boolean(data?.institution?.verificationRequired);
  const verified = invitationType === "individual" || Boolean(verificationToken);
  const deadlineExpired = Boolean(
    data?.invitation.responseDeadline && new Date(data.invitation.responseDeadline) < new Date(),
  );
  const step = submission ? 3 : verified ? 2 : 1;
  const dates = useMemo(() => {
    if (!data) return "";
    const start = formatDate(data.event.startDate);
    const end = formatDate(data.event.endDate);
    return start === end ? start : `${start} – ${end}`;
  }, [data]);

  const requestOtp = async () => {
    if (!token || !email.trim()) {
      setOtpError("Masukkan email perwakilan yang menerima undangan.");
      return;
    }
    setIsRequestingOtp(true);
    setOtpError("");
    setOtpMessage("");
    try {
      if (isPreview) {
        if (email.trim().toLowerCase() !== "kontak@mahadsunnah.or.id") {
          throw new Error("Email uji tidak cocok. Gunakan kontak@mahadsunnah.or.id pada mode pratinjau.");
        }
        const randomValues = new Uint32Array(1);
        window.crypto.getRandomValues(randomValues);
        const localCode = (randomValues[0] % 1_000_000).toString().padStart(6, "0");
        setChallengeToken(`preview-${Date.now()}`);
        setOtpExpiresAt(new Date(Date.now() + 5 * 60 * 1000).toISOString());
        setPreviewCode(localCode);
        setOtpMessage("Kode uji lokal dibuat untuk pratinjau.");
        setCooldown(30);
        setOtpCode("");
        return;
      }
      const response = await fetch(
        `${ENV.API_BASE_URL}/invitations/public/institution/${token}/otp/request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(apiError(result, "Kode OTP tidak dapat dikirim."));
      setChallengeToken(result.data.challengeToken);
      setOtpExpiresAt(result.data.expiresAt);
      setPreviewCode(result.data.previewCode || "");
      setOtpMessage(`Kode dikirim ke ${result.data.maskedEmail}.`);
      setCooldown(30);
      setOtpCode("");
    } catch (error) {
      setOtpError(error instanceof Error ? error.message : "Kode OTP tidak dapat dikirim.");
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const verifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !challengeToken) {
      setOtpError("Minta kode OTP terlebih dahulu.");
      return;
    }
    setIsVerifyingOtp(true);
    setOtpError("");
    try {
      if (isPreview) {
        if (otpCode !== previewCode) throw new Error("Kode OTP uji tidak cocok. Salin kode yang tampil pada panel pratinjau.");
        setVerificationToken("preview-verification-token");
        setOtpMessage("");
        setPreviewCode("");
        setDelegates([EMPTY_DELEGATE]);
        return;
      }
      const response = await fetch(
        `${ENV.API_BASE_URL}/invitations/public/institution/${token}/otp/verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code: otpCode, challengeToken }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(apiError(result, "Kode OTP tidak dapat diverifikasi."));
      setVerificationToken(result.data.verificationToken);
      setOtpMessage("");
      setPreviewCode("");
      setDelegates([EMPTY_DELEGATE]);
    } catch (error) {
      setOtpError(error instanceof Error ? error.message : "Kode OTP tidak dapat diverifikasi.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const updateDelegate = (index: number, field: keyof Delegate, value: string | boolean) => {
    setDraftSaved(false);
    setDelegates((current) =>
      current.map((delegate, delegateIndex) =>
        delegateIndex === index ? { ...delegate, [field]: value } : delegate,
      ),
    );
  };

  const addDelegate = () => {
    if (delegates.length >= quota) return;
    setDelegates((current) => [
      ...current,
      { ...EMPTY_DELEGATE, isLead: current.length === 0 },
    ]);
  };

  const removeDelegate = (index: number) => {
    setDelegates((current) => {
      const next = current.filter((_, delegateIndex) => delegateIndex !== index);
      if (next.length > 0 && !next.some((delegate) => delegate.isLead)) next[0] = { ...next[0], isLead: true };
      return next;
    });
  };

  const setLead = (index: number) => {
    setDelegates((current) =>
      current.map((delegate, delegateIndex) => ({ ...delegate, isLead: delegateIndex === index })),
    );
  };

  const validateForm = () => {
    if (responseStatus === "DECLINED") return "";
    if (delegates.length === 0) return "Tambahkan minimal satu asatidz yang mewakili lembaga.";
    if (delegates.filter((delegate) => delegate.isLead).length !== 1) return "Pilih tepat satu ketua rombongan.";
    for (const [index, delegate] of delegates.entries()) {
      if (delegate.fullName.trim().length < 2) return `Lengkapi nama asatidz ke-${index + 1}.`;
      if (delegate.whatsapp.replace(/\D/g, "").length < 8) return `Lengkapi nomor WhatsApp asatidz ke-${index + 1}.`;
    }
    const whatsappNumbers = delegates.map((delegate) => delegate.whatsapp.replace(/\D/g, ""));
    if (new Set(whatsappNumbers).size !== whatsappNumbers.length) {
      return "Setiap asatidz harus memakai nomor WhatsApp yang berbeda.";
    }
    return "";
  };

  const submitResponse = async (isFinal: boolean) => {
    if (!token) throw new Error("Token undangan tidak tersedia.");
    if (isPreview) {
      return {
        message: isFinal
          ? "Mode pratinjau: konfirmasi berhasil disimulasikan tanpa menyimpan data produksi."
          : "Mode pratinjau: draft berhasil disimulasikan.",
        participants: [],
      };
    }
    const endpoint = `${ENV.API_BASE_URL}/invitations/public/${invitationType}/${token}/response`;
    const payload = invitationType === "individual"
      ? { responseStatus }
      : {
          responseStatus,
          notes: notes.trim() || null,
          isFinal,
          verificationToken,
          delegates: responseStatus === "ACCEPTED"
            ? delegates.map((delegate) => ({
                fullName: delegate.fullName.trim(),
                isLead: delegate.isLead,
                email: delegate.email.trim() || null,
                phone: delegate.phone.trim() || null,
                whatsapp: delegate.whatsapp.trim() || null,
                address: delegate.address.trim() || null,
              }))
            : [],
        };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(apiError(result, "Konfirmasi tidak dapat disimpan."));
    return result.data;
  };

  const saveDraft = async () => {
    const error = validateForm();
    if (error) {
      setFormError(error);
      return;
    }
    setIsSaving(true);
    setFormError("");
    try {
      await submitResponse(false);
      setDraftSaved(true);
    } catch (errorValue) {
      setFormError(errorValue instanceof Error ? errorValue.message : "Draft tidak dapat disimpan.");
    } finally {
      setIsSaving(false);
    }
  };

  const submitFinal = async (event: React.FormEvent) => {
    event.preventDefault();
    const error = validateForm();
    if (error) {
      setFormError(error);
      return;
    }
    setIsSaving(true);
    setFormError("");
    try {
      setSubmission(await submitResponse(true));
    } catch (errorValue) {
      setFormError(errorValue instanceof Error ? errorValue.message : "Konfirmasi tidak dapat disimpan.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PublicLayout>
      <div className="invitation-registration" aria-busy={isLoading}>
        {isLoading && (
          <div className="invitation-registration__skeleton" aria-label="Memuat data undangan">
            <div />
            <div />
          </div>
        )}

        {!isLoading && pageError && (
          <section className="invitation-registration__fatal" role="alert">
            <ShieldCheck aria-hidden="true" />
            <div>
              <h1>Undangan tidak dapat dibuka</h1>
              <p>{pageError}</p>
              <p>Periksa kembali tautan atau minta panitia menerbitkan tautan undangan baru.</p>
            </div>
          </section>
        )}

        {!isLoading && data && (
          <>
            {isPreview && (
              <div className="invitation-registration__preview-banner" role="status">
                <Info aria-hidden="true" />
                <div><strong>Mode pratinjau lokal</strong><span>Database tidak dapat dijangkau. Gunakan email uji kontak@mahadsunnah.or.id; seluruh interaksi hanya simulasi.</span></div>
              </div>
            )}
            <section className="invitation-registration__event" aria-labelledby="invitation-event-title">
              <figure className="invitation-registration__poster">
                <img
                  src={data.event.posterUrl || DEFAULT_EVENT_POSTER}
                  alt={data.event.posterAlt || `Poster ${data.event.name}`}
                  style={{ objectPosition: posterObjectPosition(data.event.posterFocalPoint || "CENTER") }}
                  width="960"
                  height="1200"
                  fetchPriority="high"
                />
              </figure>
              <div className="invitation-registration__event-copy">
                <div className="invitation-registration__reference">
                  <span>Kode referensi</span>
                  <strong>{data.invitation.invitationNumber}</strong>
                </div>
                <h1 id="invitation-event-title">{data.event.name}</h1>
                {data.event.subtitle && <p>{data.event.subtitle}</p>}
                <dl className="invitation-registration__facts">
                  <div><CalendarDays aria-hidden="true" /><dt>Pelaksanaan</dt><dd>{dates}</dd></div>
                  <div><MapPin aria-hidden="true" /><dt>Lokasi</dt><dd>{[data.event.venueName, data.event.venueAddress].filter(Boolean).join(" · ") || "Akan diumumkan"}</dd></div>
                  <div><Building2 aria-hidden="true" /><dt>Penerima</dt><dd>{data.institution?.name || "Undangan individu"}</dd></div>
                  <div><Clock3 aria-hidden="true" /><dt>Batas konfirmasi</dt><dd>{formatDate(data.invitation.responseDeadline, true)}</dd></div>
                </dl>
                {invitationType === "institution" && (
                  <p className="invitation-registration__quota">Kuota undangan: <strong>{quota} asatidz</strong></p>
                )}
              </div>
            </section>

            <ol className="invitation-registration__steps" aria-label="Tahapan pendaftaran">
              {["Verifikasi", "Data kehadiran", "Selesai"].map((label, index) => {
                const number = index + 1;
                return (
                  <li key={label} className={number === step ? "is-active" : number < step ? "is-complete" : ""} aria-current={number === step ? "step" : undefined}>
                    <span>{number < step ? "✓" : number}</span><strong>{label}</strong>
                  </li>
                );
              })}
            </ol>

            {!verified && !submission && (
              <section className="invitation-registration__verification" aria-labelledby="verification-title">
                <div className="invitation-registration__security-copy">
                  <ShieldCheck aria-hidden="true" />
                  <h2 id="verification-title">Verifikasi perwakilan lembaga</h2>
                  <p>Kode referensi di atas bukan kata sandi. Untuk membuka data delegasi, minta OTP yang dikirim ke email perwakilan terdaftar.</p>
                  <div className="invitation-registration__masked-email">
                    <Mail aria-hidden="true" />
                    <span>Email tujuan</span>
                    <strong>{data.institution?.representativeEmailMasked || "Belum tercatat"}</strong>
                  </div>
                </div>

                {verificationRequired ? (
                  <form onSubmit={verifyOtp} className="invitation-registration__otp-form" noValidate>
                    <div className="invitation-field">
                      <label htmlFor="representative-email">Email perwakilan</label>
                      <div className="invitation-field__action-row">
                        <input
                          id="representative-email"
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="nama@lembaga.or.id"
                          aria-invalid={Boolean(otpError)}
                          aria-describedby="otp-feedback"
                          disabled={verified}
                        />
                        <button type="button" onClick={() => void requestOtp()} disabled={isRequestingOtp || cooldown > 0}>
                          {isRequestingOtp ? <Loader2 className="invitation-spinner" aria-hidden="true" /> : <Mail aria-hidden="true" />}
                          <span>{cooldown > 0 ? `Kirim ulang ${cooldown}s` : challengeToken ? "Kirim ulang" : "Kirim kode"}</span>
                        </button>
                      </div>
                      <p>Email harus sama dengan data lembaga pada undangan.</p>
                    </div>

                    {challengeToken && (
                      <div className="invitation-field">
                        <label htmlFor="invitation-otp">Kode OTP 6 digit</label>
                        <div className="invitation-field__otp">
                          <KeyRound aria-hidden="true" />
                          <input
                            id="invitation-otp"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            value={otpCode}
                            onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                            placeholder="000000"
                            aria-invalid={Boolean(otpError)}
                          />
                        </div>
                        <p>Berlaku sampai {otpExpiresAt ? formatDate(otpExpiresAt, true) : "5 menit setelah dikirim"}.</p>
                      </div>
                    )}

                    {previewCode && (
                      <div className="invitation-registration__preview-code" role="status">
                        <Info aria-hidden="true" />
                        <span>Mode development · kode uji lokal</span>
                        <strong>{previewCode}</strong>
                        <small>Kode ini tidak pernah ditampilkan di produksi.</small>
                      </div>
                    )}

                    <div id="otp-feedback" className={otpError ? "invitation-feedback is-error" : "invitation-feedback"} aria-live="polite">
                      {otpError || otpMessage || "Kode OTP hanya berlaku untuk tautan dan email undangan ini."}
                    </div>

                    <button className="invitation-primary-action" type="submit" disabled={!challengeToken || otpCode.length !== 6 || isVerifyingOtp || deadlineExpired}>
                      {isVerifyingOtp ? <Loader2 className="invitation-spinner" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
                      <span>{isVerifyingOtp ? "Memverifikasi…" : "Verifikasi dan buka formulir"}</span>
                    </button>
                  </form>
                ) : (
                  <div className="invitation-feedback is-error" role="alert">
                    Email perwakilan belum tersedia. Hubungi panitia agar data lembaga diperbarui sebelum pendaftaran dibuka.
                  </div>
                )}
              </section>
            )}

            {verified && !submission && (
              <form className="invitation-registration__form" onSubmit={submitFinal} noValidate>
                <header className="invitation-registration__form-head">
                  <div>
                    <CheckCircle2 aria-hidden="true" />
                    <span>Undangan terverifikasi</span>
                  </div>
                  <h2>{invitationType === "institution" ? "Konfirmasi lembaga dan data asatidz" : "Konfirmasi kehadiran"}</h2>
                  <p>Periksa kembali data sebelum mengirim konfirmasi final. Setiap asatidz akan melakukan check-in secara individu.</p>
                </header>

                <fieldset className="invitation-registration__decision">
                  <legend>Status kehadiran</legend>
                  <label className={responseStatus === "ACCEPTED" ? "is-selected" : ""}>
                    <input type="radio" name="responseStatus" value="ACCEPTED" checked={responseStatus === "ACCEPTED"} onChange={() => setResponseStatus("ACCEPTED")} />
                    <CheckCircle2 aria-hidden="true" />
                    <span><strong>Insyaallah hadir</strong><small>{invitationType === "institution" ? "Daftarkan asatidz yang mewakili lembaga." : "Catat kehadiran saya."}</small></span>
                  </label>
                  <label className={responseStatus === "DECLINED" ? "is-selected" : ""}>
                    <input type="radio" name="responseStatus" value="DECLINED" checked={responseStatus === "DECLINED"} onChange={() => setResponseStatus("DECLINED")} />
                    <span><strong>Belum dapat hadir</strong><small>Kirim jawaban agar panitia dapat memperbarui kuota.</small></span>
                  </label>
                </fieldset>

                {invitationType === "institution" && responseStatus === "ACCEPTED" && (
                  <section className="invitation-registration__delegates" aria-labelledby="delegate-title">
                    <div className="invitation-registration__section-head">
                      <div>
                        <h3 id="delegate-title">Asatidz yang didaftarkan</h3>
                        <p>{delegates.length} dari {quota} kuota terpakai · satu orang wajib menjadi ketua rombongan.</p>
                      </div>
                      <button type="button" onClick={addDelegate} disabled={delegates.length >= quota}>
                        <Plus aria-hidden="true" /><span>Tambah asatidz</span>
                      </button>
                    </div>

                    {delegates.map((delegate, index) => (
                      <article className="invitation-delegate" key={index}>
                        <header>
                          <div><span>{index + 1}</span><strong>Data asatidz</strong></div>
                          <div>
                            <button type="button" className={delegate.isLead ? "is-lead" : ""} onClick={() => setLead(index)}>
                              <Crown aria-hidden="true" /><span>{delegate.isLead ? "Ketua rombongan" : "Jadikan ketua"}</span>
                            </button>
                            <button type="button" onClick={() => removeDelegate(index)} aria-label={`Hapus data asatidz ke-${index + 1}`} disabled={delegates.length === 1}>
                              <Trash2 aria-hidden="true" />
                            </button>
                          </div>
                        </header>
                        <div className="invitation-delegate__fields">
                          <div className="invitation-field">
                            <label htmlFor={`delegate-name-${index}`}>Nama lengkap dan gelar *</label>
                            <input id={`delegate-name-${index}`} value={delegate.fullName} onChange={(event) => updateDelegate(index, "fullName", event.target.value)} placeholder="Ustadz Ahmad, Lc." autoComplete="name" />
                            <p>Tulis seperti yang akan tampil pada daftar peserta.</p>
                          </div>
                          <div className="invitation-field">
                            <label htmlFor={`delegate-whatsapp-${index}`}>Nomor WhatsApp *</label>
                            <input id={`delegate-whatsapp-${index}`} type="tel" inputMode="tel" value={delegate.whatsapp} onChange={(event) => updateDelegate(index, "whatsapp", event.target.value)} placeholder="081234567890" autoComplete="tel" />
                            <p>Dipakai untuk informasi operasional dan konfirmasi pribadi.</p>
                          </div>
                          <div className="invitation-field">
                            <label htmlFor={`delegate-phone-${index}`}>Nomor telepon</label>
                            <div className="invitation-field__with-copy">
                              <input id={`delegate-phone-${index}`} type="tel" inputMode="tel" value={delegate.phone} onChange={(event) => updateDelegate(index, "phone", event.target.value)} placeholder="Opsional jika sama dengan WhatsApp" />
                              <button type="button" onClick={() => updateDelegate(index, "phone", delegate.whatsapp)} disabled={!delegate.whatsapp}>Samakan</button>
                            </div>
                            <p>Boleh dikosongkan jika sama dengan nomor WhatsApp.</p>
                          </div>
                          <div className="invitation-field">
                            <label htmlFor={`delegate-email-${index}`}>Email asatidz</label>
                            <input id={`delegate-email-${index}`} type="email" value={delegate.email} onChange={(event) => updateDelegate(index, "email", event.target.value)} placeholder="ustadz@lembaga.or.id" autoComplete="email" />
                            <p>Dipakai untuk akses portal peserta bila tersedia.</p>
                          </div>
                          <div className="invitation-field invitation-field--wide">
                            <label htmlFor={`delegate-address-${index}`}>Alamat domisili</label>
                            <textarea id={`delegate-address-${index}`} rows={3} maxLength={500} value={delegate.address} onChange={(event) => updateDelegate(index, "address", event.target.value)} placeholder="Kota/kabupaten dan provinsi" />
                            <p>Maksimal 500 karakter.</p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </section>
                )}

                {invitationType === "institution" && (
                  <div className="invitation-field invitation-field--notes">
                    <label htmlFor="registration-notes">Catatan untuk panitia</label>
                    <textarea id="registration-notes" rows={4} maxLength={1000} value={notes} onChange={(event) => { setNotes(event.target.value); setDraftSaved(false); }} placeholder="Estimasi kedatangan, kebutuhan aksesibilitas, atau informasi penting lainnya" />
                    <p>{notes.length}/1000 karakter</p>
                  </div>
                )}

                {formError && <div className="invitation-feedback is-error" role="alert">{formError}</div>}
                {draftSaved && <div className="invitation-feedback is-success" role="status">Draft tersimpan. Anda masih dapat mengubah data sebelum mengirim final.</div>}

                <footer className="invitation-registration__actions">
                  <p><Info aria-hidden="true" /> Konfirmasi final mengunci jawaban undangan. Perubahan berikutnya dilakukan melalui panitia.</p>
                  <div>
                    {invitationType === "institution" && (
                      <button type="button" onClick={() => void saveDraft()} disabled={isSaving || deadlineExpired}>
                        <Save aria-hidden="true" /><span>Simpan draft</span>
                      </button>
                    )}
                    <button className="invitation-primary-action" type="submit" disabled={isSaving || deadlineExpired}>
                      {isSaving ? <Loader2 className="invitation-spinner" aria-hidden="true" /> : <Send aria-hidden="true" />}
                      <span>{isSaving ? "Menyimpan…" : responseStatus === "ACCEPTED" ? "Kirim konfirmasi" : "Kirim jawaban"}</span>
                    </button>
                  </div>
                </footer>
              </form>
            )}

            {submission && (
              <section className="invitation-registration__success" aria-labelledby="success-title">
                <CheckCircle2 aria-hidden="true" />
                <h2 id="success-title">Konfirmasi telah diterima</h2>
                <p>{submission.message || "Panitia telah menerima jawaban undangan Anda."}</p>
                {submission.participants?.length > 0 && (
                  <div>
                    <strong>Kode peserta individual</strong>
                    <ul>{submission.participants.map((participant: any) => <li key={participant.id}>{participant.participantCode}</li>)}</ul>
                    <small>Simpan kode masing-masing. Setiap asatidz tetap check-in secara individu.</small>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </PublicLayout>
  );
};
