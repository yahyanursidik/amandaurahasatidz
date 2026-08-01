/* Hallmark · component: share actions · genre: modern-minimal · theme: existing emerald-slate
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46–50)
 */
import React from "react";
import { CheckCircle2, Loader2, Mail, MessageCircle } from "lucide-react";
import {
  buildEmailShareUrl,
  buildWhatsAppShareUrl,
  type InvitationShareContext,
} from "@/lib/invitationShare";

type VisualState = "default" | "hover" | "focus" | "active" | "disabled" | "loading" | "error" | "success";

interface InvitationShareActionsProps {
  context: InvitationShareContext;
  recipientWhatsapp?: string | null;
  recipientEmail?: string | null;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  previewState?: VisualState;
}

export const InvitationShareActions: React.FC<InvitationShareActionsProps> = ({
  context,
  recipientWhatsapp,
  recipientEmail,
  disabled = false,
  loading = false,
  error,
  previewState,
}) => {
  const isDisabled = disabled || previewState === "disabled";
  const isLoading = loading || previewState === "loading";
  const stateClass = previewState ? `is-${previewState}` : "";
  const statusError = error || (previewState === "error" ? "Tautan belum dapat dibagikan. Coba buat ulang tautan." : "");

  return (
    <section className={`invitation-share ${stateClass}`} aria-label="Bagikan undangan">
      <div className="invitation-share__heading">
        {isLoading ? <Loader2 aria-hidden="true" className="invitation-share__spinner" /> : <CheckCircle2 aria-hidden="true" />}
        <div>
          <strong>{isLoading ? "Menyiapkan tautan…" : "Tautan siap dibagikan"}</strong>
          <span>Pilih jalur komunikasi lembaga. Pengiriman tetap dilakukan dari aplikasi Anda.</span>
        </div>
      </div>

      {statusError ? <p className="invitation-share__feedback is-error" role="alert">{statusError}</p> : null}
      {previewState === "success" ? <p className="invitation-share__feedback is-success" role="status">Pesan undangan siap dikirim.</p> : null}

      <div className="invitation-share__actions">
        {isDisabled || isLoading ? (
          <>
            <button type="button" className="invitation-share__action invitation-share__action--whatsapp" disabled>
              <MessageCircle aria-hidden="true" /> WhatsApp
            </button>
            <button type="button" className="invitation-share__action invitation-share__action--email" disabled>
              <Mail aria-hidden="true" /> Email
            </button>
          </>
        ) : (
          <>
            <a
              className="invitation-share__action invitation-share__action--whatsapp"
              href={buildWhatsAppShareUrl(context, recipientWhatsapp)}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle aria-hidden="true" /> WhatsApp
            </a>
            <a className="invitation-share__action invitation-share__action--email" href={buildEmailShareUrl(context, recipientEmail)}>
              <Mail aria-hidden="true" /> Email
            </a>
          </>
        )}
      </div>

      <p className="invitation-share__recipient">
        WhatsApp: {recipientWhatsapp || "pilih kontak saat WhatsApp terbuka"} · Email: {recipientEmail || "isi penerima di aplikasi email"}
      </p>
    </section>
  );
};
