import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { ParticipantQrCard } from "@/components/public/ParticipantQrCard";
import { ENV } from "@/config/env";

type Card = { ustadzName: string; eventName: string; participantCode: string; opaqueQrToken: string };

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

  return <PublicLayout><main className="mx-auto max-w-xl space-y-5 py-8">
    <h1 className="text-2xl font-black text-emerald-950">Kartu peserta</h1>
    {loading ? <p role="status">Memuat kartu peserta…</p> : error ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-900">{error}</p> : card &&
      <ParticipantQrCard eventName={card.eventName} person={{ fullName: card.ustadzName, participantCode: card.participantCode,
        qrToken: card.opaqueQrToken, cardUrl: `/card?token=${encodeURIComponent(token)}` }} />}
    <Link to="/programs" className="inline-block text-sm font-bold text-emerald-800 underline">Lihat program</Link>
  </main></PublicLayout>;
}
