import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, CalendarDays, ExternalLink, MapPin, QrCode, RefreshCw, Search, Users } from "lucide-react";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { ENV } from "@/config/env";
import { DEFAULT_EVENT_POSTER, DEFAULT_EVENT_POSTER_SRCSET } from "@/lib/eventPoster";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

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
  REGISTRATION_CLOSED: "Pendaftaran ditutup", ONGOING: "Sedang berlangsung", COMPLETED: "Telah dilaksanakan",
};

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

export const groupPublicPrograms = (programs: Program[], query = "") => {
  const term = query.trim().toLocaleLowerCase("id-ID");
  const matching = programs.filter((program) => `${program.name} ${program.code} ${program.venueName || ""} ${program.startDate.slice(0, 4)}`
    .toLocaleLowerCase("id-ID").includes(term));
  return {
    history: matching.filter((program) => program.status === "COMPLETED")
      .sort((a, b) => b.endDate.localeCompare(a.endDate) || b.startDate.localeCompare(a.startDate)),
    agenda: sortPublicPrograms(matching.filter((program) => program.status !== "COMPLETED")),
  };
};

export const PublicProgramsPage: React.FC = () => {
  const location = useLocation();
  const isCatalog = location.pathname === "/programs";
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState("");
  const committedQuery = useDebouncedValue(query.trim());
  const filterKey = `${isCatalog}:${committedQuery}`;
  const [pagination, setPagination] = useState({ key: filterKey, page: 1, agendaPage: 1 });
  const page = pagination.key === filterKey ? pagination.page : 1;
  const agendaPage = pagination.key === filterKey ? pagination.agendaPage : 1;
  const [meta, setMeta] = useState({ total: 0, pageCount: 1 });
  const [agenda, setAgenda] = useState<Program[]>([]);
  const [agendaMeta, setAgendaMeta] = useState({ total: 0, pageCount: 1 });
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [agendaError, setAgendaError] = useState("");

  const readPage = async (response: Response) => {
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(response.status >= 500
      ? "Daftar program sedang tidak tersedia. Coba lagi sebentar atau hubungi panitia."
      : payload?.error?.message || "Daftar program tidak dapat dimuat.");
    if (!Array.isArray(payload?.data) || !payload.data.every((program: Program) =>
      typeof program?.slug === "string" && typeof program?.name === "string" && typeof program?.startDate === "string" && typeof program?.endDate === "string")) {
      throw new Error("Format daftar program tidak sesuai. Muat ulang halaman.");
    }
    return { data: payload.data as Program[], meta: payload.meta as { total: number; pageCount: number } | undefined };
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ view: isCatalog ? "history" : "featured", page: String(page), pageSize: isCatalog ? "12" : "3", search: isCatalog ? committedQuery : "" });
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return null;
      return fetch(`${ENV.API_BASE_URL}/events/public?${params}`, { signal: controller.signal }).then(readPage);
    }).then((result) => {
      if (!result || controller.signal.aborted) return;
      setPrograms(result.data);
      setMeta(result.meta || { total: result.data.filter((item) => !isCatalog || item.status === "COMPLETED").length, pageCount: 1 });
    })
      .catch((loadError) => {
        if (!controller.signal.aborted) { setPrograms([]); setError(loadError instanceof Error ? loadError.message : "Daftar program tidak dapat dimuat."); }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh, isCatalog, isCatalog ? committedQuery : "", page]);

  useEffect(() => {
    if (!isCatalog) { setAgenda([]); return; }
    const controller = new AbortController();
    setAgendaLoading(true); setAgendaError("");
    if (agendaPage === 1) setAgenda([]);
    const params = new URLSearchParams({ view: "agenda", page: String(agendaPage), pageSize: "6", search: committedQuery });
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return null;
      return fetch(`${ENV.API_BASE_URL}/events/public?${params}`, { signal: controller.signal }).then(readPage);
    }).then((result) => {
      if (!result || controller.signal.aborted) return;
      const items = result.data.filter((item) => item.status !== "COMPLETED");
      setAgenda((current) => agendaPage === 1 ? items : [...new Map([...current, ...items].map((item) => [item.slug, item])).values()]);
      setAgendaMeta(result.meta || { total: items.length, pageCount: 1 });
    }).catch((cause) => { if (!controller.signal.aborted) setAgendaError(cause instanceof Error ? cause.message : "Agenda gagal dimuat."); })
      .finally(() => { if (!controller.signal.aborted) setAgendaLoading(false); });
    return () => controller.abort();
  }, [isCatalog, committedQuery, agendaPage, refresh]);

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
  const featured = useMemo(() => ordered.slice(0, 3), [ordered]);
  const grouped = useMemo(() => groupPublicPrograms(programs), [programs]);

  const renderCards = (items: Program[]) => <div className="public-home__program-grid">{items.map((program) => {
    const action = getPublicProgramAction(program);
    const detailPath = `/events/${program.slug}`;
    const invitationOnly = program.status !== "COMPLETED" && hasInvitationPath(program) && (!hasRegularPath(program) || program.regularQuota === 0);
    return <article key={program.slug} className="public-home__program-card">
      <div className="public-home__program-poster"><img src={program.posterUrl || DEFAULT_EVENT_POSTER} alt={program.posterAlt || `Poster ${program.name}`} width="640" height="360" loading="lazy" decoding="async" onError={(event) => { if (!event.currentTarget.src.endsWith(DEFAULT_EVENT_POSTER)) event.currentTarget.src = DEFAULT_EVENT_POSTER; }} /><span>{getPublicProgramStatus(program)}</span></div>
      <div className="public-home__program-body">
        <p className="public-home__program-kind">{program.status === "COMPLETED" ? "Daurah Asatidz" : audienceText[program.audienceMode] || "Program daurah"}</p>
        <h3>{program.name}</h3>
        {program.subtitle && <p className="public-home__program-subtitle">{program.subtitle}</p>}
        <div className="public-home__program-facts"><p><CalendarDays aria-hidden="true" /><span>{formatDate(program.startDate)}{program.endDate !== program.startDate ? ` – ${formatDate(program.endDate)}` : ""}</span></p><p><MapPin aria-hidden="true" /><span>{program.venueName || "Lokasi menyusul"}</span></p></div>
        <div className="public-home__program-actions"><Link to={action.to} className="public-home__program-action">{action.label} <ArrowRight aria-hidden="true" /></Link>{action.to !== detailPath && <Link to={detailPath} className="public-home__program-detail">Rincian kegiatan</Link>}</div>
        {invitationOnly && <p className="public-home__invitation-note">Tautan pendaftaran khusus dikirim panitia kepada penerima undangan.</p>}
      </div>
    </article>;
  })}</div>;

  const renderHistory = (items: Program[]) => <div className="public-home__history-list">{items.map((program) => <article key={program.slug} className="public-home__history-row">
    <div className="public-home__history-poster"><img src={program.posterUrl || DEFAULT_EVENT_POSTER} alt={program.posterAlt || `Poster ${program.name}`} width="320" height="320" loading="lazy" decoding="async" onError={(event) => { if (!event.currentTarget.src.endsWith(DEFAULT_EVENT_POSTER)) event.currentTarget.src = DEFAULT_EVENT_POSTER; }} /></div>
    <div className="public-home__history-body"><p className="public-home__program-kind">Telah dilaksanakan</p><h3>{program.name}</h3><p>{formatDate(program.startDate)}{program.endDate !== program.startDate ? ` – ${formatDate(program.endDate)}` : ""} · {program.venueName || "Lokasi tidak dicantumkan"}</p></div>
    <Link to={`/events/${program.slug}`} className="public-home__history-link">Lihat rincian <ArrowRight aria-hidden="true" /></Link>
  </article>)}</div>;

  return <PublicLayout wide>
    <div className={`public-home ${isCatalog ? "public-home--catalog" : ""}`}>
      {isCatalog ? <header className="public-home__catalog-intro" aria-labelledby="catalog-title">
        <div><p className="public-home__identity">Yayasan Tarbiyah Sunnah · Aman Daurah Asatidz</p><h1 id="catalog-title">Riwayat Daurah Asatidz</h1><p>Catatan daurah yang telah diselenggarakan YTS. Jika ada kegiatan yang masih berjalan atau akan datang, informasinya tampil terpisah di bawah.</p></div>
        <Link to="/login/ustadz" className="public-home__catalog-portal">Sudah mendaftar? Lihat status &amp; QR <ArrowRight aria-hidden="true" /></Link>
      </header> : <>
      <header className="public-home__hero" aria-labelledby="public-home-title">
        <div className="public-home__hero-copy">
          <p className="public-home__identity">Aman Daurah Asatidz · Yayasan Tarbiyah Sunnah</p>
          <h1 id="public-home-title">Yayasan Tarbiyah Sunnah</h1>
          <p className="public-home__lead">Pendidikan, dakwah, dan kepedulian sosial. Melalui Aman Daurah Asatidz, kami menyajikan informasi kegiatan, pendaftaran, dan kehadiran para asatidz dengan jelas.</p>
          <div className="public-home__hero-actions">
            <a href="#tentang-yts" className="public-home__button public-home__button--primary">Kenali yayasan <ArrowRight aria-hidden="true" /></a>
            <Link to="/programs" className="public-home__button public-home__button--quiet">Lihat riwayat daurah</Link>
          </div>
          <Link to="/login/ustadz" className="public-home__hero-login">Sudah punya akun? Masuk portal</Link>
        </div>
        <div className="public-home__hero-image"><img src={DEFAULT_EVENT_POSTER} srcSet={DEFAULT_EVENT_POSTER_SRCSET} sizes="(max-width: 800px) 100vw, 60vw" alt="" width="1600" height="900" loading="eager" {...{ fetchpriority: "high" }} decoding="async" /></div>
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
          <div><h2 id="program-list-title">{isCatalog ? "Telah dilaksanakan" : "Kegiatan daurah"}</h2><p>{isCatalog ? "Riwayat kegiatan yang telah ditandai selesai oleh panitia, terbaru lebih dahulu." : "Informasi daurah terbaru dari yayasan."}</p></div>
          {isCatalog ? !loading && !error && <span className="public-home__result-count" aria-live="polite">{meta.total} kegiatan selesai</span> : <Link to="/programs" className="public-home__text-link">Lihat riwayat <ArrowRight aria-hidden="true" /></Link>}
        </div>
        {isCatalog && <div className="public-home__tools">
          <label className="public-home__search" htmlFor="program-search"><span>Cari kegiatan</span><span className="public-home__search-field"><Search aria-hidden="true" /><input id="program-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nama, lokasi, atau tahun" /></span></label>
        </div>}
        {loading ? <div role="status" className="public-home__loading"><span className="sr-only">Memuat daftar program…</span><div /><div /></div>
          : error ? <div role="alert" className="public-home__empty"><strong>Informasi daurah belum dapat dimuat.</strong><p>{error}</p><button type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw aria-hidden="true" /> Muat ulang</button></div>
            : isCatalog ? grouped.history.length > 0 ? renderHistory(grouped.history)
              : <div className="public-home__empty"><CalendarDays aria-hidden="true" /><strong>{query ? "Riwayat tidak ditemukan." : "Belum ada riwayat yang diterbitkan."}</strong><p>{query ? "Coba nama kegiatan, lokasi, atau tahun lain." : "Riwayat akan tampil setelah panitia menandai kegiatan selesai."}</p>{query && <button type="button" onClick={() => setQuery("")}>Tampilkan semua kegiatan</button>}</div>
              : featured.length > 0 ? renderCards(featured)
                : <div className="public-home__empty"><CalendarDays aria-hidden="true" /><strong>Belum ada kegiatan yang diterbitkan.</strong><p>Informasi daurah akan tampil di sini setelah diterbitkan panitia.</p></div>}
      </section>

      {isCatalog && !error && meta.pageCount > 1 && <nav aria-label="Halaman riwayat daurah" className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm"><button type="button" disabled={loading || page <= 1} onClick={() => setPagination({ key: filterKey, page: page - 1, agendaPage })} className="min-h-11 rounded-lg border px-4 disabled:opacity-50">Sebelumnya</button><span>Halaman {page}/{meta.pageCount}</span><button type="button" disabled={loading || page >= meta.pageCount} onClick={() => setPagination({ key: filterKey, page: page + 1, agendaPage })} className="min-h-11 rounded-lg border px-4 disabled:opacity-50">Berikutnya</button></nav>}

      {isCatalog && (agenda.length > 0 || agendaLoading || agendaError) && <section id="agenda-daurah" className="public-home__programs public-home__agenda" aria-labelledby="agenda-title">
        <div className="public-home__section-head"><div><h2 id="agenda-title">Agenda dan pendaftaran</h2><p>Kegiatan lain yang diterbitkan panitia. Formulir hanya tersedia bila pendaftaran dibuka.</p></div><span className="public-home__result-count">{agendaMeta.total} kegiatan</span></div>
        {renderCards(agenda)}
        {agendaLoading && <p role="status">Memuat agenda…</p>}
        {agendaError && <p role="alert">{agendaError}</p>}
        {agendaPage < agendaMeta.pageCount && <button type="button" disabled={agendaLoading} onClick={() => setPagination({ key: filterKey, page, agendaPage: agendaPage + 1 })} className="mt-4 min-h-11 rounded-lg border px-4 disabled:opacity-50">Lihat agenda berikutnya</button>}
        {agendaError && <button type="button" onClick={() => setRefresh((value) => value + 1)} className="min-h-11 rounded-lg border px-4">Muat ulang agenda</button>}
      </section>}

      {!isCatalog && <section className="public-home__journey" aria-labelledby="journey-title">
        <div><h2 id="journey-title">Dari daftar hingga hadir</h2><p>Satu orang dapat mendaftarkan diri atau rombongan. Setiap asatidz tetap memperoleh QR dan akses portal pribadi.</p></div>
        <ol>
          <li><span>01</span><CalendarDays aria-hidden="true" /><div><h3>Lihat informasi kegiatan</h3><p>Periksa jadwal, lokasi, dan jalur pendaftaran bila tersedia.</p></div></li>
          <li><span>02</span><Users aria-hidden="true" /><div><h3>Isi pendaftaran</h3><p>Form reguler bisa memuat rombongan. Undangan lembaga memakai tautan khusus dari panitia.</p></div></li>
          <li><span>03</span><QrCode aria-hidden="true" /><div><h3>Simpan QR pribadi</h3><p>Simpan bukti tiap peserta untuk kehadiran saat acara.</p></div></li>
        </ol>
      </section>}

      <section className="public-home__next" aria-label="Layanan setelah mendaftar">
        <div><h2>Sudah mendaftar?</h2><p>Masuk untuk melihat status, jadwal, dan QR pribadi.</p><Link to="/login/ustadz" className="public-home__text-link">Masuk Portal Asatidz <ArrowRight aria-hidden="true" /></Link></div>
        <div><h2>Tetap terhubung</h2><p>Ruang Asatidz menerima saran, pengalaman, dan kebutuhan melalui akun pribadi.</p><Link to="/ruang-asatidz" className="public-home__text-link">Kenali Ruang Asatidz <ArrowRight aria-hidden="true" /></Link></div>
      </section>
    </div>
  </PublicLayout>;
};
