/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V4
 * genre: modern-minimal · tone: calm-warm · macrostructure: Narrative Workflow · design-system: design.md
 * Public QR links to event details and private portal without revealing credentials on a shareable card.
 */
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { ParticipantQrCard } from "@/components/public/ParticipantQrCard";
import { ENV } from "@/config/env";
import { publicRundownPath } from "@/lib/publicRegistrationReceipt";
import { isAttendanceQrEligible } from "@/lib/registrationStatus";

type Card = { ustadzName: string; eventName: string; eventSlug?: string | null; participantCode: string;
  opaqueQrToken: string | null; approvalStatus: string; confirmationStatus: string; attendanceConfirmationRequired: boolean; eventOpen: boolean };

export function ParticipantCardPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setCard(null); setError(""); setLoading(true);
    fetch(`${ENV.API_BASE_URL}/cards/public?token=${encodeURIComponent(token)}`, {
      signal: controller.signal, cache: "no-store", referrerPolicy: "no-referrer",
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message || "Kartu tidak tersedia.");
        if (!controller.signal.aborted) setCard(result.data);
      })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Kartu tidak tersedia."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token]);

  const qrToken = card?.eventOpen && isAttendanceQrEligible(card) && card.opaqueQrToken?.startsWith("pqr_") ? card.opaqueQrToken : null;
  return <PublicLayout><main className="participant-card-page">
    <h1>{qrToken ? "Kartu presensi" : "Bukti pendaftaran"}</h1>
    {loading ? <p role="status">Memuat status pendaftaran…</p> : error ?
      <div className="rounded-xl bg-rose-50 p-4 text-rose-900"><p role="alert">{error}</p>
        <Link className="mt-2 inline-flex min-h-11 items-center font-bold underline" to="/login/ustadz">Masuk Portal Asatidz</Link>
      </div> : card &&
      <>
        <nav className="participant-card-page__links" aria-label="Informasi peserta">
          <Link to={card.eventSlug ? publicRundownPath(card.eventSlug) : "/programs"}>{card.eventSlug ? "Lihat rundown" : "Lihat program"}</Link>
          <Link to="/login/ustadz">Masuk Portal Asatidz</Link>
        </nav>
        {!qrToken && <p className="participant-card-page__note">Ini tautan bukti lama, bukan kartu presensi. Untuk status terbaru, buka tautan pribadi terbaru dari panitia atau masuk ke Portal Asatidz.</p>}
        <ParticipantQrCard eventName={card.eventName} person={{ fullName: card.ustadzName, participantCode: card.participantCode,
          qrToken }} approvalStatus={card.approvalStatus}
          confirmationStatus={card.confirmationStatus} confirmationRequired={card.attendanceConfirmationRequired} eventOpen={card.eventOpen} />
      </>}
  </main></PublicLayout>;
}
