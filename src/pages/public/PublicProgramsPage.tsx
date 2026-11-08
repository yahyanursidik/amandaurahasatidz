import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, CalendarDays, ExternalLink, MapPin, QrCode, RefreshCw, Search, Users } from "lucide-react";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { ENV } from "@/config/env";
import { DEFAULT_EVENT_POSTER } from "@/lib/eventPoster";

export type Program = {
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
  regularQuota?: number | null;
  registrationOpenAt: string | null;
  registrationCloseAt: string | null;
};

const formatDate = (value: string) => {
  const date = new Date(`${value}T00:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? "Tanggal menyusul" : new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta",
  }).format(date);
};

const statusText: Record<string, string> = {
  REGISTRATION_OPEN: "Pendaftaran dibuka", PUBLISHED: "Informasi tersedia",
  REGISTRATION_CLOSED: "Pendaftaran ditutup", ONGOING: "Sedang berlangsung", COMPLETED: "Selesai",
};

type ProgramFilter = "ALL" | "REGULAR" | "INVITATION";

const hasRegularPath = (program: Program) => ["PUBLIC_OPEN", "MIXED"].includes(program.audienceMode);
const hasInvitationPath = (program: Program) => ["INSTITUTION_INVITATION", "INDIVIDUAL_INVITATION", "MIXED"].includes(program.audienceMode);

const registrationWindow = (program: Program, now = new Date()) => {
  const opens = program.registrationOpenAt ? new Date(program.registrationOpenAt).getTime() : null;
  const closes = program.registrationCloseAt ? new Date(program.registrationCloseAt).getTime() : null;
  if ((opens !== null && !Number.isFinite(opens)) || (closes !== null && !Number.isFinite(closes))) return "INVALID";
  if (opens !== null && opens > now.getTime()) return "UPCOMING";
  if (closes !== null && closes < now.getTime()) return "ENDED";
  return "OPEN";
};

export const getPublicProgramAction = (program: Program, now = new Date()) => {
  if (program.status === "REGISTRATION_OPEN" && hasRegularPath(program) && program.regularQuota !== 0 && registrationWindow(program, now) === "OPEN") return { label: "Daftar reguler", to: `/events/${program.slug}/register` };
  if (program.status === "ONGOING") return { label: "Lihat jadwal", to: `/events/${program.slug}#jadwal-kegiatan` };
  return { label: "Lihat rincian", to: `/events/${program.slug}` };
};

export const getPublicProgramStatus = (program: Program, now = new Date()) => {
  if (program.status !== "REGISTRATION_OPEN") return statusText[program.status] || "Informasi program";
  if (!hasRegularPath(program)) return "Melalui undangan";
  if (program.regularQuota === 0) return "Kuota reguler tidak tersedia";
  const window = registrationWindow(program, now);
  if (window === "UPCOMING") return "Pendaftaran segera dibuka";
  if (window === "ENDED") return "Batas daftar lewat";
  if (window === "INVALID") return "Periksa informasi program";
  return statusText[program.status];
};

const audienceText: Record<string, string> = {
  PUBLIC_OPEN: "Reguler", MIXED: "Reguler & undangan",
  INSTITUTION_INVITATION: "Undangan lembaga", INDIVIDUAL_INVITATION: "Undangan pribadi",
};

export const sortPublicPrograms = (programs: Program[], now = new Date()) => [...programs].sort((a, b) => {
  const priority = (program: Program) => {
    if (program.status === "REGISTRATION_OPEN" && registrationWindow(program, now) === "OPEN") return hasRegularPath(program) && program.regularQuota !== 0 ? 0 : 1;
    if (program.status === "PUBLISHED" || registrationWindow(program, now) === "UPCOMING" && program.status === "REGISTRATION_OPEN") return 2;
    if (program.status === "ONGOING") return 3;
    if (program.status === "COMPLETED") return 5;
    return 4;
  };
  const order = priority(a) - priority(b);
  if (order) return order;
  return a.status === "COMPLETED" && b.status === "COMPLETED"
    ? b.startDate.localeCompare(a.startDate) : a.startDate.localeCompare(b.startDate);
});

export const PublicProgramsPage: React.FC = () => {
  const location = useLocation();
  const isCatalog = location.pathname === "/programs";
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProgramFilter>("ALL");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`${ENV.API_BASE_URL}/events/public`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(response.status >= 500
          ? "Daftar program sedang tidak tersedia. Coba lagi sebentar atau hubungi panitia."
          : payload?.error?.message || "Daftar program tidak dapat dimuat.");
        if (!Array.isArray(payload?.data) || !payload.data.every((program: Program) =>
          typeof program?.slug === "string" && typeof program?.name === "string" && typeof program?.startDate === "string" && typeof program?.endDate === "string")) {
          throw new Error("Format daftar program tidak sesuai. Muat ulang halaman.");
        }
        setPrograms(payload.data);
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "Daftar program tidak dapat dimuat.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);

  useEffect(() => {
    if (!location.hash) {
      const frame = window.requestAnimationFrame(() => window.scrollTo(0, 0));
      return () => window.cancelAnimationFrame(frame);
    }
    const targetId = location.hash === "#tentang-yts" ? "tentang-yts"
      : location.hash === "#program-terbaru" ? "program-terbaru" : null;
    if (!targetId) return;
    const frame = window.requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView());
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname, location.hash]);

  const ordered = useMemo(() => sortPublicPrograms(programs), [programs]);
  const visible = useMemo(() => (isCatalog ? ordered : ordered.slice(0, 3)).filter((program) => {
    if (!isCatalog) return true;
    if (filter === "REGULAR" && !hasRegularPath(program)) return false;
    if (filter === "INVITATION" && !hasInvitationPath(program)) return false;
    return `${program.name} ${program.code} ${program.venueName || ""}`.toLocaleLowerCase("id-ID")
      .includes(query.trim().toLocaleLowerCase("id-ID"));
  }), [ordered, isCatalog, query, filter]);

  return <PublicLayout wide>
    <div className={`public-home ${isCatalog ? "public-home--catalog" : ""}`}>
      {isCatalog ? <header className="public-home__catalog-intro" aria-labelledby="catalog-title">
        <div><p className="public-home__identity">Program · Aman Daurah Asatidz</p><h1 id="catalog-title">Temukan daurah yang sesuai</h1><p>Periksa jadwal dan jalur pendaftaran. Pendaftaran reguler tersedia melalui formulir; undangan memakai tautan khusus dari panitia.</p></div>
        <Link to="/login/ustadz" className="public-home__catalog-portal">Sudah mendaftar? Lihat status &amp; QR <ArrowRight aria-hidden="true" /></Link>
      </header> : <>
      <header className="public-home__hero" aria-labelledby="public-home-title">
        <div className="public-home__hero-copy">
          <p className="public-home__identity">Aman Daurah Asatidz · Yayasan Tarbiyah Sunnah</p>
          <h1 id="public-home-title">Yayasan Tarbiyah Sunnah</h1>
          <p className="public-home__lead">Pendidikan, dakwah, dan kepedulian sosial. Melalui Aman Daurah Asatidz, kami membantu para asatidz menemukan program, mendaftar, dan mengikuti kegiatan dengan jelas.</p>
          <div className="public-home__hero-actions">
            <a href="#tentang-yts" className="public-home__button public-home__button--primary">Kenali yayasan <ArrowRight aria-hidden="true" /></a>
            <Link to="/programs" className="public-home__button public-home__button--quiet">Lihat program daurah</Link>
          </div>
          <Link to="/login/ustadz" className="public-home__hero-login">Sudah punya akun? Masuk portal</Link>
        </div>
        <div className="public-home__hero-image"><img src={DEFAULT_EVENT_POSTER} alt="" width="1600" height="900" loading="eager" /></div>
      </header>

      <section id="tentang-yts" className="public-home__about" aria-labelledby="about-yts-title">
        <div className="public-home__about-intro">
          <div>
            <h2 id="about-yts-title">Mengenal YTS</h2>
            <p>Yayasan Tarbiyah Sunnah adalah lembaga nirlaba di Bandung yang bergerak dalam pendidikan, sosial, dan dakwah. Daurah asatidz merupakan salah satu cara mendukung pembelajaran dan hubungan antarlembaga.</p>
            <a href="https://tarbiyahsunnah.com/tentang-kami/" target="_blank" rel="noopener noreferrer" className="public-home__text-link">Baca profil resmi YTS <ExternalLink aria-hidden="true" /></a>
          </div>
          <div className="public-home__focus-list" aria-label="Bidang kegiatan yayasan">
            <div><strong>Pendidikan</strong><span>Pembelajaran agama Islam yang berkelanjutan.</span></div>
            <div><strong>Dakwah</strong><span>Kajian ilmiah dan pelatihan untuk masyarakat.</span></div>
            <div><strong>Sosial</strong><span>Kepedulian dan dukungan bagi yang membutuhkan.</span></div>
          </div>
        </div>
      </section>
      </>}

      <section id="program-terbaru" aria-labelledby="program-list-title" className="public-home__programs">
        <div className="public-home__section-head">
          <div><h2 id="program-list-title">{isCatalog ? "Daftar program" : "Program terkini"}</h2><p>{isCatalog ? "Program yang diterbitkan panitia, termasuk kegiatan yang sudah selesai." : "Pilihan daurah terbaru dari yayasan."}</p></div>
          {isCatalog ? !loading && !error && <span className="public-home__result-count" aria-live="polite">{visible.length} program</span> : <Link to="/programs" className="public-home__text-link">Semua program <ArrowRight aria-hidden="true" /></Link>}
        </div>
        {isCatalog && !loading && !error && programs.length > 0 && <div className="public-home__tools">
          <div className="public-home__filters" role="group" aria-label="Saring jalur program">
            {([ ["ALL", "Semua"], ["REGULAR", "Reguler"], ["INVITATION", "Undangan"] ] as const).map(([value, label]) =>
              <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
          </div>
          <label className="public-home__search" htmlFor="program-search"><span>Cari program</span><span className="public-home__search-field"><Search aria-hidden="true" /><input id="program-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nama atau lokasi" /></span></label>
        </div>}
        {loading ? <div role="status" className="public-home__loading"><span className="sr-only">Memuat daftar program…</span><div /><div /></div>
          : error ? <div role="alert" className="public-home__empty"><strong>Program belum dapat dimuat.</strong><p>{error}</p><button type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw aria-hidden="true" /> Muat ulang</button></div>
            : visible.length === 0 ? <div className="public-home__empty"><CalendarDays aria-hidden="true" /><strong>{isCatalog && (query || filter !== "ALL") ? "Program tidak ditemukan." : "Belum ada program yang diterbitkan."}</strong><p>{isCatalog && (query || filter !== "ALL") ? "Coba kata kunci atau jalur lain." : "Agenda baru akan tampil di sini setelah diterbitkan panitia."}</p>{isCatalog && (query || filter !== "ALL") && <button type="button" onClick={() => { setQuery(""); setFilter("ALL"); }}>Tampilkan semua program</button>}</div>
              : <div className="public-home__program-grid">{visible.map((program) => {
                const action = getPublicProgramAction(program);
                const detailPath = `/events/${program.slug}`;
                const invitationOnly = hasInvitationPath(program) && (!hasRegularPath(program) || program.regularQuota === 0);
                return <article key={program.slug} className="public-home__program-card">
                  <div className="public-home__program-poster"><img src={program.posterUrl || DEFAULT_EVENT_POSTER} alt={program.posterAlt || `Poster ${program.name}`} width="640" height="360" loading="lazy" decoding="async" onError={(event) => { if (!event.currentTarget.src.endsWith(DEFAULT_EVENT_POSTER)) event.currentTarget.src = DEFAULT_EVENT_POSTER; }} /><span>{getPublicProgramStatus(program)}</span></div>
                  <div className="public-home__program-body">
                    <p className="public-home__program-kind">{audienceText[program.audienceMode] || "Program daurah"}</p>
                    <h3>{program.name}</h3>
                    {program.subtitle && <p className="public-home__program-subtitle">{program.subtitle}</p>}
                    <div className="public-home__program-facts"><p><CalendarDays aria-hidden="true" /><span>{formatDate(program.startDate)}{program.endDate !== program.startDate ? ` – ${formatDate(program.endDate)}` : ""}</span></p><p><MapPin aria-hidden="true" /><span>{program.venueName || "Lokasi menyusul"}</span></p></div>
                    <div className="public-home__program-actions"><Link to={action.to} className="public-home__program-action">{action.label} <ArrowRight aria-hidden="true" /></Link>{action.to !== detailPath && <Link to={detailPath} className="public-home__program-detail">Rincian program</Link>}</div>
                    {invitationOnly && <p className="public-home__invitation-note">Tautan pendaftaran khusus dikirim panitia kepada penerima undangan.</p>}
                  </div>
                </article>;
              })}</div>}
      </section>

      <section className="public-home__journey" aria-labelledby="journey-title">
        <div><h2 id="journey-title">Dari daftar hingga hadir</h2><p>Satu orang dapat mendaftarkan diri atau rombongan. Setiap asatidz tetap memperoleh QR dan akses portal pribadi.</p></div>
        <ol>
          <li><span>01</span><CalendarDays aria-hidden="true" /><div><h3>Pilih program</h3><p>Periksa jadwal, lokasi, dan jalurnya.</p></div></li>
          <li><span>02</span><Users aria-hidden="true" /><div><h3>Isi pendaftaran</h3><p>Form reguler bisa memuat rombongan. Undangan lembaga memakai tautan khusus dari panitia.</p></div></li>
          <li><span>03</span><QrCode aria-hidden="true" /><div><h3>Simpan QR pribadi</h3><p>Simpan bukti tiap peserta untuk kehadiran saat acara.</p></div></li>
        </ol>
      </section>

      <section className="public-home__next" aria-label="Layanan setelah mendaftar">
        <div><h2>Sudah mendaftar?</h2><p>Masuk untuk melihat status, jadwal, dan QR pribadi.</p><Link to="/login/ustadz" className="public-home__text-link">Masuk Portal Asatidz <ArrowRight aria-hidden="true" /></Link></div>
        <div><h2>Tetap terhubung</h2><p>Ruang Asatidz menerima saran, pengalaman, dan kebutuhan melalui akun pribadi.</p><Link to="/ruang-asatidz" className="public-home__text-link">Kenali Ruang Asatidz <ArrowRight aria-hidden="true" /></Link></div>
      </section>
    </div>
  </PublicLayout>;
};
