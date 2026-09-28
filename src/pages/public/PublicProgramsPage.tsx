/* Hallmark · genre: modern-minimal · macrostructure: Index-First · design-system: design.md · designed-as-app */
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, MapPin, RefreshCw } from "lucide-react";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { ENV } from "@/config/env";
import { DEFAULT_EVENT_POSTER } from "@/lib/eventPoster";

type Program = {
  slug: string;
  code: string;
  name: string;
  subtitle: string | null;
  posterUrl: string | null;
  posterAlt: string | null;
  startDate: string;
  endDate: string;
  venueName: string | null;
  audienceMode: string;
  status: string;
};

export const PublicProgramsPage: React.FC = () => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`${ENV.API_BASE_URL}/events/public`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(response.status >= 500 ? "Daftar program sedang tidak tersedia. Coba lagi sebentar atau hubungi panitia." : payload.error?.message || "Daftar program tidak dapat dimuat.");
        setPrograms(payload.data || []);
      })
      .catch((loadError) => { if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "Daftar program tidak dapat dimuat."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);
  return <PublicLayout>
    <div className="public-programs">
      <header className="public-programs__header">
        <p>Aman Daurah Asatidz</p>
        <h1>Program daurah</h1>
        <span>Lihat informasi resmi setiap program, pilih jalur pendaftaran yang sesuai, lalu pantau kepesertaan Anda di portal pribadi.</span>
        <Link to="/login/ustadz">Masuk Portal Asatidz <ArrowRight aria-hidden="true" /></Link>
      </header>
      <section aria-labelledby="program-list-title">
        <h2 id="program-list-title">Program yang dipublikasikan</h2>
        {loading ? <p role="status">Memuat program…</p> : error ? <div role="alert" className="public-programs__empty"><p>{error}</p><button type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw aria-hidden="true" /> Coba lagi</button></div> : programs.length === 0 ? <div className="public-programs__empty"><p>Belum ada program yang dipublikasikan.</p><span>Panitia akan menampilkan program di sini setelah informasinya siap.</span></div> : <div className="public-programs__list">
          {programs.map((program) => <article key={program.slug} className="public-programs__item">
            <img src={program.posterUrl || DEFAULT_EVENT_POSTER} alt={program.posterAlt || `Poster ${program.name}`} width="240" height="160" loading="lazy" />
            <div>
              <p>{program.code}</p>
              <h3>{program.name}</h3>
              {program.subtitle && <span>{program.subtitle}</span>}
              <div className="public-programs__facts"><span><CalendarDays aria-hidden="true" /> {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(`${program.startDate}T00:00:00+07:00`))}</span><span><MapPin aria-hidden="true" /> {program.venueName || "Lokasi menyusul"}</span></div>
            </div>
            <Link to={`/events/${program.slug}`}>Lihat program <ArrowRight aria-hidden="true" /></Link>
          </article>)}
        </div>}
      </section>
    </div>
  </PublicLayout>;
};
