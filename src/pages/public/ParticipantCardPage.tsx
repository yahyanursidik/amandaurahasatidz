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

type Card = { ustadzName: string; eventName: string; eventSlug?: string | null; participantCode: string; opaqueQrToken: string };

export function ParticipantCardPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${ENV.API_BASE_URL}/cards/public?token=${encodeURIComponent(token)}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message || "Kartu tidak tersedia.");
        setCard(result.data);
      })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Kartu tidak tersedia."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token]);

  return <PublicLayout><main className="participant-card-page">
    <h1>Kartu peserta</h1>
    {loading ? <p role="status">Memuat kartu peserta…</p> : error ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-900">{error}</p> : card &&
      <>
        <nav className="participant-card-page__links" aria-label="Informasi peserta">
          <Link to={card.eventSlug ? publicRundownPath(card.eventSlug) : "/programs"}>{card.eventSlug ? "Lihat rundown" : "Lihat program"}</Link>
          <Link to="/login/ustadz">Masuk Portal Asatidz</Link>
        </nav>
        <p className="participant-card-page__note">Untuk keamanan, password tidak ditampilkan di tautan kartu yang bisa dibagikan. Masuk dengan email pribadi; jika lupa sandi, buat sandi baru melalui email di halaman login.</p>
        <ParticipantQrCard eventName={card.eventName} person={{ fullName: card.ustadzName, participantCode: card.participantCode,
          qrToken: card.opaqueQrToken, cardUrl: `/card?token=${encodeURIComponent(token)}` }} />
      </>}
  </main></PublicLayout>;
}
