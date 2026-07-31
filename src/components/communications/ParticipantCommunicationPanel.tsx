/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V4
 * Component-scope · role-aware participant communication workbench
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  X,
} from "lucide-react";
import {
  buildParticipantEmailUrl,
  buildParticipantMessage,
  buildWhatsAppUrl,
  CommunicationSenderRole,
  CommunicationTemplateId,
  getParticipantWhatsAppNumber,
  PARTICIPANT_COMMUNICATION_TEMPLATES,
  ParticipantContact,
  ParticipantEventContext,
} from "@/lib/participantCommunication";

type ParticipantCommunicationPanelProps = {
  participant: ParticipantContact;
  senderRole: CommunicationSenderRole;
  event?: ParticipantEventContext;
  senderName?: string;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
};

const templateSubject: Record<CommunicationTemplateId, string> = {
  REGISTRATION_CONFIRMATION: "Konfirmasi pendaftaran peserta",
  COMPLETE_DATA: "Permintaan kelengkapan data peserta",
  ATTENDANCE_CONFIRMATION: "Konfirmasi kehadiran peserta",
  EVENT_REMINDER: "Pengingat pelaksanaan event",
  SCHEDULE_CHANGE: "Pembaruan jadwal atau lokasi event",
  CHECKIN_INFO: "Informasi check-in peserta",
  APPROVAL_STATUS: "Pembaruan status pendaftaran",
  POST_EVENT: "Informasi tindak lanjut event",
  CUSTOM: "Informasi dari panitia",
};

export const ParticipantCommunicationPanel: React.FC<ParticipantCommunicationPanelProps> = ({
  participant,
  senderRole,
  event,
  senderName,
  disabled = false,
  loading = false,
  compact = false,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const templateSelectRef = useRef<HTMLSelectElement>(null);
  const [templateId, setTemplateId] = useState<CommunicationTemplateId>("REGISTRATION_CONFIRMATION");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState("");
  const whatsappNumber = getParticipantWhatsAppNumber(participant);
  const hasEmail = Boolean(participant.email?.trim());
  const hasAnyContact = Boolean(whatsappNumber || hasEmail);
  const eventName = event?.name || "event daurah";

  const generatedMessage = useMemo(
    () => buildParticipantMessage(templateId, { participant, senderRole, senderName, event }),
    [event, participant, senderName, senderRole, templateId],
  );

  useEffect(() => {
    setMessage(generatedMessage);
    setCopied(false);
    setActionError("");
  }, [generatedMessage]);

  const openDialog = () => {
    setActionError("");
    dialogRef.current?.showModal();
    window.setTimeout(() => templateSelectRef.current?.focus(), 0);
  };

  const closeDialog = () => {
    dialogRef.current?.close();
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setActionError("");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setActionError("Pesan belum dapat disalin. Pilih teks pesan lalu salin secara manual.");
    }
  };

  const openWhatsApp = () => {
    const url = buildWhatsAppUrl(participant.whatsapp || participant.phone || "", message);
    if (!url) {
      setActionError("Nomor WhatsApp belum tersedia atau formatnya belum valid. Perbarui data peserta terlebih dahulu.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const openEmail = () => {
    const url = buildParticipantEmailUrl(
      participant.email || "",
      `${templateSubject[templateId]} — ${eventName}`,
      message,
    );
    if (!url) {
      setActionError("Alamat email peserta belum tersedia atau formatnya belum valid.");
      return;
    }
    window.location.href = url;
  };

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        disabled={disabled || loading}
        aria-label={`Hubungi ${participant.name}`}
        className={[
          "participant-contact-trigger inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3 text-sm font-bold",
          senderRole === "committee"
            ? "border-teal-200 bg-teal-50 text-teal-900"
            : "border-emerald-200 bg-emerald-50 text-emerald-900",
          "transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900",
          "disabled:cursor-not-allowed disabled:opacity-50",
          compact ? "min-w-[44px] px-2.5" : "",
        ].join(" ")}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
        {!compact && <span>{loading ? "Memuat…" : "Hubungi"}</span>}
      </button>

      <dialog
        ref={dialogRef}
        className="participant-communication-dialog m-auto max-h-[90dvh] w-[min(44rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl"
        onClick={(eventTarget) => {
          if (eventTarget.target === dialogRef.current) closeDialog();
        }}
        onClose={() => {
          setActionError("");
          setCopied(false);
        }}
      >
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-bold text-emerald-800">
                {senderRole === "committee" ? "Komunikasi Panitia" : "Komunikasi Admin"}
              </p>
              <h2 className="mt-1 min-w-0 [overflow-wrap:anywhere] text-xl font-black text-slate-950">Hubungi {participant.name}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Tinjau dan sunting pesan. Sistem hanya membuka aplikasi tujuan—pesan tidak dikirim otomatis.
              </p>
            </div>
            <button
              type="button"
              onClick={closeDialog}
              aria-label="Tutup panel komunikasi"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 active:bg-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid gap-6 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
          <div className="min-w-0 space-y-5">
            <div>
              <label htmlFor={`communication-template-${participant.id}`} className="mb-2 block text-sm font-bold text-slate-800">
                Tujuan komunikasi
              </label>
              <select
                ref={templateSelectRef}
                id={`communication-template-${participant.id}`}
                value={templateId}
                onChange={(eventTarget) => setTemplateId(eventTarget.target.value as CommunicationTemplateId)}
                className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline outline-2 outline-transparent focus-visible:outline-emerald-700"
              >
                {PARTICIPANT_COMMUNICATION_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>{template.label}</option>
                ))}
              </select>
              <p className="mt-2 min-h-[1.5rem] text-sm leading-5 text-slate-600">
                {PARTICIPANT_COMMUNICATION_TEMPLATES.find((item) => item.id === templateId)?.description}
              </p>
            </div>

            <div>
              <label htmlFor={`communication-message-${participant.id}`} className="mb-2 block text-sm font-bold text-slate-800">
                Isi pesan
              </label>
              <textarea
                id={`communication-message-${participant.id}`}
                value={message}
                onChange={(eventTarget) => {
                  setMessage(eventTarget.target.value);
                  setCopied(false);
                }}
                rows={14}
                aria-describedby={`communication-helper-${participant.id}`}
                className="min-h-64 w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-sm leading-6 text-slate-900 outline outline-2 outline-transparent focus-visible:outline-emerald-700"
              />
              <div id={`communication-helper-${participant.id}`} className="mt-2 flex min-h-[1.5rem] items-center justify-between gap-3 text-sm text-slate-600">
                <span>{message.length.toLocaleString("id-ID")} karakter</span>
                <button
                  type="button"
                  onClick={() => setMessage(generatedMessage)}
                  className="min-h-[44px] whitespace-nowrap rounded-md px-2 font-bold text-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                >
                  Pulihkan template
                </button>
              </div>
            </div>

            {actionError && (
              <div role="alert" className="flex items-start gap-2 border-l-4 border-rose-600 bg-rose-50 p-3 text-sm leading-5 text-rose-950">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}
          </div>

          <aside className="space-y-4 border-t border-slate-200 pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <div>
              <h3 className="text-sm font-black text-slate-950">Data kontak</h3>
              <dl className="mt-3 space-y-3 text-sm">
                <div>
                  <dt className="flex items-center gap-2 font-bold text-slate-700"><Phone className="h-4 w-4" /> WhatsApp</dt>
                  <dd className="mt-1 break-all text-slate-600">{participant.whatsapp || participant.phone || "Belum diisi"}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-2 font-bold text-slate-700"><Mail className="h-4 w-4" /> Email</dt>
                  <dd className="mt-1 break-all text-slate-600">{participant.email || "Belum diisi"}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-2 font-bold text-slate-700"><MapPin className="h-4 w-4" /> Alamat</dt>
                  <dd className="mt-1 text-slate-600">{participant.address || "Belum diisi"}</dd>
                </div>
              </dl>
            </div>

            {!hasAnyContact && (
              <div className="border-l-4 border-amber-500 bg-amber-50 p-3 text-sm leading-5 text-amber-950">
                Lengkapi WhatsApp atau email peserta sebelum membuka kanal komunikasi.
              </div>
            )}
          </aside>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <button
            type="button"
            onClick={() => void copyMessage()}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 active:bg-slate-200"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-700" /> : <Copy className="h-4 w-4" />}
            {copied ? "Pesan disalin" : "Salin pesan"}
          </button>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={openEmail}
              disabled={!hasEmail}
              title={!hasEmail ? "Email peserta belum diisi" : undefined}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 active:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Mail className="h-4 w-4" />
              Buka email
            </button>
            <button
              type="button"
              onClick={openWhatsApp}
              disabled={!whatsappNumber}
              title={!whatsappNumber ? "Nomor WhatsApp peserta belum valid" : undefined}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white transition-colors hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 active:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ExternalLink className="h-4 w-4" />
              Buka WhatsApp
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
};
