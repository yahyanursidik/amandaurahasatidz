import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { StatusBadge, StatusVariant } from "@/components/common/StatusBadge";
import { ENV } from "@/config/env";
import { AlertCircle, ArrowRight, CalendarDays, Clock3, ExternalLink, MapPin, MessageCircle, RefreshCw } from "lucide-react";
import { DEFAULT_EVENT_POSTER, posterObjectPosition } from "@/lib/eventPoster";
import { PublicEventRegistrationPage } from "./PublicEventRegistrationPage";
import { getRegularRegistrationState } from "@/lib/regularRegistration";
import { eventTimezoneLabel, formatEventDate, formatEventDateTime, formatEventTime } from "@/lib/eventDateTime";
import { buildEventWhatsAppUrl } from "@/lib/eventWhatsApp";

type EventDay = {
  id: string;
  dayNumber: number;
  date: string;
  title: string | null;
};

type EventSession = {
  id: string;
  eventDayId: string;
  title: string;
  sessionType: string;
  moderatorName: string | null;
  startAt: string;
  endAt: string;
  room: string | null;
  sortOrder: number;
};

type PublicEvent = {
  id: string;
  code: string;
  slug: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  posterUrl: string | null;
  posterAlt: string | null;
  posterFocalPoint: string | null;
  timezone: string;
  startDate: string;
  endDate: string;
  venueName: string | null;
  venueAddress: string | null;
  publicContactWhatsapp?: string | null;
  mapsUrl: string | null;
  status: string;
  audienceMode: string;
  capacity: number | null;
  regularQuota: number | null;
  invitationQuota: number | null;
  regularApproved: number;
  invitationApproved: number;
  registrationOpenAt: string | null;
  registrationCloseAt: string | null;
  days: EventDay[];
  sessions: EventSession[];
};

const previewEvent: PublicEvent = {
  id: "preview",
  code: "CONTOH-DAURAH",
  slug: "contoh-daurah-asatidz",
  name: "Contoh Halaman Daurah Asatidz",
  subtitle: "Pratinjau tampilan informasi event",
  description:
    "Data pada halaman ini hanya contoh karena API lokal belum tersambung. Informasi event sebenarnya akan mengikuti data yang dibuat oleh admin.",
  posterUrl: DEFAULT_EVENT_POSTER,
  posterAlt: "Interior perpustakaan sebagai poster contoh daurah",
  posterFocalPoint: "CENTER",
  timezone: "Asia/Jakarta",
  startDate: "2026-08-15",
  endDate: "2026-08-16",
  venueName: "Lokasi contoh",
  venueAddress: "Alamat akan mengikuti data event.",
  mapsUrl: null,
  status: "DRAFT",
  audienceMode: "MIXED",
  capacity: null,
  regularQuota: null,
  invitationQuota: null,
  regularApproved: 0,
  invitationApproved: 0,
  registrationOpenAt: null,
  registrationCloseAt: null,
  days: [
    { id: "preview-day", dayNumber: 1, date: "2026-08-15", title: "Hari pertama" },
  ],
  sessions: [
    {
      id: "preview-session",
      eventDayId: "preview-day",
      title: "Contoh sesi pembukaan",
      sessionType: "MATERIAL",
      moderatorName: null,
      startAt: "2026-08-15T08:00:00+07:00",
      endAt: "2026-08-15T10:00:00+07:00",
      room: "Ruang utama",
      sortOrder: 0,
    },
  ],
};

const statusVariant = (status: string): StatusVariant => {
  if (status === "ONGOING" || status === "COMPLETED") return "success";
  if (status === "PUBLISHED" || status === "REGISTRATION_OPEN") return "info";
  if (status === "CANCELLED") return "danger";
  if (status === "REGISTRATION_CLOSED") return "warning";
  return "neutral";
};

const statusLabel: Record<string, string> = {
  PUBLISHED: "Informasi tersedia",
  REGISTRATION_OPEN: "Pendaftaran dibuka",
  REGISTRATION_CLOSED: "Pendaftaran ditutup",
  ONGOING: "Sedang berlangsung",
  COMPLETED: "Telah dilaksanakan",
  CANCELLED: "Dibatalkan",
};

const eventDateRange = (startDate: string, endDate: string) =>
  startDate === endDate ? formatEventDate(startDate) : `${formatEventDate(startDate)} – ${formatEventDate(endDate)}`;

export const EventPublicPage: React.FC = () => {
  const { slug = "" } = useParams<{ slug: string }>();
  const location = useLocation();
  const [eventData, setEventData] = useState<PublicEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setPreviewMode(false);
    fetch(`${ENV.API_BASE_URL}/events/public/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(response.status >= 500 ? "Informasi daurah sedang tidak tersedia. Coba lagi sebentar atau hubungi panitia." : result.error?.message || "Informasi daurah tidak dapat dimuat.");
        return result.data as PublicEvent;
      })
      .then((data) => { if (!controller.signal.aborted) setEventData(data); })
      .catch((loadError) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "Informasi daurah tidak dapat dimuat.");
        if (import.meta.env.DEV && slug === "contoh-daurah-asatidz") {
          setEventData(previewEvent);
          setPreviewMode(true);
        } else setEventData(null);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [slug, refresh]);

  const schedule = useMemo(
    () =>
      [...(eventData?.days || [])].sort((a, b) => a.date.localeCompare(b.date) || a.dayNumber - b.dayNumber).map((day) => ({
        ...day,
        sessions: (eventData?.sessions || []).filter((session) => session.eventDayId === day.id)
          .sort((a, b) => a.startAt.localeCompare(b.startAt) || a.sortOrder - b.sortOrder),
      })),
    [eventData]
  );
  const regularEnabled = Boolean(eventData && ["PUBLIC_OPEN", "MIXED"].includes(eventData.audienceMode));
  const invitationEnabled = Boolean(eventData && ["INSTITUTION_INVITATION", "INDIVIDUAL_INVITATION", "MIXED"].includes(eventData.audienceMode));
  const registration = eventData ? getRegularRegistrationState(eventData) : null;
  const hasEventDetails = Boolean(eventData && (eventData.description || eventData.venueName || eventData.venueAddress || eventData.mapsUrl));
  const localNavSections = 1 + Number(hasEventDetails) + Number(regularEnabled && !previewMode);
  const timezone = eventData?.timezone || "Asia/Jakarta";
  const contactUrl = eventData?.publicContactWhatsapp
    ? buildEventWhatsAppUrl(`Assalamu’alaikum warahmatullahi wabarakatuh. Saya ingin bertanya tentang ${eventData.name}. Jazakumullahu khairan.`, eventData.publicContactWhatsapp)
    : null;

  useEffect(() => {
    if (loading || !eventData || !["#jadwal-kegiatan", "#formulir-reguler", "#informasi-acara"].includes(location.hash)) return;
    const frame = window.requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView());
    return () => window.cancelAnimationFrame(frame);
  }, [loading, eventData, location.hash]);

  return (
    <PublicLayout wide>
      <div className="event-public">
        {loading ? (
          <div className="event-public__loading" role="status" aria-label="Memuat informasi daurah"><div /><div /><span className="sr-only">Memuat informasi daurah…</span></div>
        ) : !eventData ? (
          <section className="event-public__unavailable" role="alert">
            <AlertCircle aria-hidden="true" />
            <h1>Daurah belum dapat ditampilkan</h1>
            <p>{error || "Tautan mungkin tidak valid atau layanan sedang tidak tersedia."}</p>
            <button type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw aria-hidden="true" /> Muat ulang</button>
          </section>
        ) : (
          <div className="event-public__content">
            {previewMode && <p className="event-public__preview" role="status">Pratinjau lokal — informasi dan formulir ini bukan data produksi.</p>}

            <header className="event-public-hero">
              <div className="event-public-hero__poster">
                <img src={eventData.posterUrl || DEFAULT_EVENT_POSTER} alt={eventData.posterAlt || `Poster ${eventData.name}`}
                  style={{ objectPosition: posterObjectPosition(eventData.posterFocalPoint) }} width="960" height="640" decoding="async"
                  onError={(image) => { if (!image.currentTarget.src.endsWith(DEFAULT_EVENT_POSTER)) image.currentTarget.src = DEFAULT_EVENT_POSTER; }} />
              </div>
              <div className="event-public-hero__identity">
                <div className="event-public-hero__meta"><span>{eventData.code}</span><StatusBadge label={statusLabel[eventData.status] || eventData.status} variant={statusVariant(eventData.status)} /></div>
                <h1>{eventData.name}</h1>
                {eventData.subtitle && <p className="event-public-hero__subtitle">{eventData.subtitle}</p>}
                <dl className="event-public-hero__facts">
                  <div><CalendarDays aria-hidden="true" /><dt>Tanggal</dt><dd>{eventDateRange(eventData.startDate, eventData.endDate)}</dd></div>
                  <div><MapPin aria-hidden="true" /><dt>Tempat</dt><dd>{eventData.venueName || "Akan diumumkan"}</dd></div>
                </dl>
                <div className="event-public-hero__actions">
                  {regularEnabled && registration?.open && !previewMode && <a href="#formulir-reguler" className="event-public__primary">Isi pendaftaran <ArrowRight aria-hidden="true" /></a>}
                  <a href="#jadwal-kegiatan" className="event-public__secondary">Lihat jadwal</a>
                </div>
                {regularEnabled && !registration?.open && !previewMode && <p className="event-public-hero__closed">{registration?.reason}</p>}
                {invitationEnabled && <p className="event-public-hero__closed">Penerima undangan memakai tautan khusus dari panitia.</p>}
              </div>
            </header>

            <nav className={`event-public__local-nav ${localNavSections === 1 ? "event-public__local-nav--one" : localNavSections === 2 ? "event-public__local-nav--two" : ""}`} aria-label="Bagian halaman daurah">
              {hasEventDetails && <a href="#informasi-acara">Informasi</a>}<a href="#jadwal-kegiatan">Rundown</a>
              {regularEnabled && !previewMode && <a href="#formulir-reguler">Pendaftaran</a>}
            </nav>

            {!eventData.venueName && <p className="event-public__pending" role="status">Tempat acara belum diumumkan panitia.</p>}

            {hasEventDetails && <section id="informasi-acara" className="event-public__information" aria-labelledby="event-information-title">
              <div><h2 id="event-information-title">Tentang daurah</h2><p>{eventData.description || "Rincian kegiatan akan diperbarui oleh panitia."}</p></div>
              <div className="event-public__venue"><MapPin aria-hidden="true" /><h3>{eventData.venueName || "Tempat menyusul"}</h3><p>{eventData.venueAddress || "Alamat lengkap akan diumumkan."}</p>
                {eventData.mapsUrl && <a href={eventData.mapsUrl} target="_blank" rel="noopener noreferrer">Petunjuk arah <ExternalLink aria-hidden="true" /></a>}
              </div>
            </section>}

            <section id="jadwal-kegiatan" className="event-public__schedule" aria-labelledby="event-schedule-title">
              <div className="event-public__section-head"><div><h2 id="event-schedule-title">Rundown acara</h2><p>Waktu setempat: {eventTimezoneLabel(timezone)}. Tanggal mengikuti hari kegiatan yang ditetapkan panitia.</p></div><Clock3 aria-hidden="true" /></div>
              {schedule.length === 0 ? <p className="event-public__schedule-empty">Rundown rinci belum dipublikasikan panitia.</p> : <div className="event-public__days">
                {schedule.map((day) => <article key={day.id} className="event-public__day">
                  <div className="event-public__day-head"><h3>Hari {day.dayNumber}{day.title ? ` · ${day.title}` : ""}</h3><time dateTime={day.date}>{formatEventDate(day.date)}</time></div>
                  {day.sessions.length === 0 ? <p className="event-public__schedule-empty">Sesi hari ini belum diumumkan.</p> : <ol className="event-public__sessions">
                    {day.sessions.map((session) => <li key={session.id}>
                      <time dateTime={session.startAt}>{formatEventTime(session.startAt, timezone)} – {formatEventTime(session.endAt, timezone)}</time>
                      <div><h4>{session.title}</h4><p>{[session.room, session.moderatorName && `Moderator: ${session.moderatorName}`].filter(Boolean).join(" · ") || "Ruang menyusul"}</p></div>
                    </li>)}
                  </ol>}
                </article>)}
              </div>}
            </section>

            {invitationEnabled && <section className="event-public__invitation" aria-labelledby="event-invitation-title"><h2 id="event-invitation-title">Jalur undangan</h2><p>Penerima undangan lembaga atau pribadi mendaftar melalui tautan khusus dari panitia, bukan formulir reguler di halaman ini.</p></section>}
            {regularEnabled && !previewMode && <section id="formulir-reguler" className="event-public__registration" aria-label="Pendaftaran reguler untuk daurah ini">
              {registration?.open && eventData.registrationCloseAt && <p className="event-public__deadline">Batas pendaftaran: {formatEventDateTime(eventData.registrationCloseAt, timezone)} {eventTimezoneLabel(timezone)}</p>}
              <PublicEventRegistrationPage embeddedEvent={eventData} />
            </section>}
            {regularEnabled && previewMode && <section className="event-public__registration-note"><h2>Pendaftaran reguler</h2><p>Formulir tersedia pada daurah yang sudah diterbitkan dan dibuka panitia.</p></section>}
            <footer className="event-public__next"><div><h2>Sudah mendaftar?</h2><p>Status, rundown, dan QR pribadi tersedia di Portal Asatidz.</p></div><div>
              <Link to="/login/ustadz">Masuk portal <ArrowRight aria-hidden="true" /></Link>
              {contactUrl && <a href={contactUrl} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" /> Hubungi panitia</a>}
            </div></footer>
          </div>
        )}
      </div>
    </PublicLayout>
  );
};
