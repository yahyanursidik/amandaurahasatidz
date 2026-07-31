import React, { useRef } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  CalendarClock,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  UserRound,
  X,
} from "lucide-react";
import { StatusBadge } from "@/components/common/StatusBadge";

export type ParticipantProfileSummary = {
  id: string;
  ustadzId?: string | null;
  name: string;
  participantCode: string;
  institutionName?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  approvalStatus: string;
  confirmationStatus: string;
  registrationSource?: string | null;
  registeredAt?: string | null;
  eventName?: string | null;
};

const formatRegisteredAt = (value?: string | null) => {
  if (!value) return "Waktu pendaftaran belum tersedia";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Waktu pendaftaran belum tersedia";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
    timeZoneName: "short",
  }).format(date);
};

const sourceLabel = (source?: string | null) => {
  const labels: Record<string, string> = {
    INSTITUTION_INVITATION: "Undangan lembaga",
    INDIVIDUAL_INVITATION: "Undangan individu",
    PUBLIC_REGISTRATION: "Pendaftaran umum",
    ADMIN_ENTRY: "Input admin",
    REPLACEMENT: "Peserta pengganti",
  };
  return source ? labels[source] || source.replaceAll("_", " ") : "Sumber belum dicatat";
};

export const ParticipantProfileDialog: React.FC<{
  participant: ParticipantProfileSummary;
  masterProfileHref?: string;
}> = ({ participant, masterProfileHref }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
      >
        <UserRound className="h-4 w-4" />
        Lihat profil
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`participant-profile-${participant.id}`}
        className="m-auto max-h-[90dvh] w-[min(42rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/60"
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 p-5">
          <div className="min-w-0">
            <p className="font-mono text-xs font-black text-emerald-800">{participant.participantCode}</p>
            <h2 id={`participant-profile-${participant.id}`} className="mt-1 [overflow-wrap:anywhere] text-xl font-black text-slate-950">
              {participant.name}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{participant.eventName || "Peserta daurah"}</p>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Tutup profil peserta"
            className="grid min-h-[44px] min-w-[44px] place-items-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-5 p-5">
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              label={participant.approvalStatus.replaceAll("_", " ")}
              variant={participant.approvalStatus === "APPROVED" ? "success" : "warning"}
            />
            <StatusBadge
              label={participant.confirmationStatus.replaceAll("_", " ")}
              variant={participant.confirmationStatus === "CONFIRMED" ? "success" : "neutral"}
            />
          </div>

          <dl className="grid gap-px overflow-hidden border border-slate-200 bg-slate-200 sm:grid-cols-2">
            {[
              { label: "Lembaga", value: participant.institutionName || "Peserta individu", icon: Building2 },
              { label: "Email", value: participant.email || "Belum diisi", icon: Mail },
              { label: "Telepon / WhatsApp", value: participant.whatsapp || participant.phone || "Belum diisi", icon: Phone },
              { label: "Alamat", value: participant.address || "Belum diisi", icon: MapPin },
              { label: "Waktu pendaftaran", value: formatRegisteredAt(participant.registeredAt), icon: CalendarClock },
              { label: "Jalur pendaftaran", value: sourceLabel(participant.registrationSource), icon: UserRound },
            ].map((item) => (
              <div key={item.label} className="min-w-0 bg-white p-4">
                <dt className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                  <item.icon className="h-4 w-4 shrink-0 text-emerald-700" />
                  {item.label}
                </dt>
                <dd className="mt-2 break-words text-sm font-semibold leading-6 text-slate-800">{item.value}</dd>
              </div>
            ))}
          </dl>

          {masterProfileHref && (
            <Link
              to={masterProfileHref}
              onClick={() => dialogRef.current?.close()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-emerald-800 px-4 text-sm font-black text-white hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              Buka profil master asatidz
              <ExternalLink className="h-4 w-4" />
            </Link>
          )}
        </div>
      </dialog>
    </>
  );
};
