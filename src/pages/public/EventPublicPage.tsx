import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { StatusBadge, StatusVariant } from "@/components/common/StatusBadge";
import { ENV } from "@/config/env";
import { AlertCircle, Calendar, Clock, ExternalLink, MapPin, RefreshCw } from "lucide-react";

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
  timezone: string;
  startDate: string;
  endDate: string;
  venueName: string | null;
  venueAddress: string | null;
  mapsUrl: string | null;
  status: string;
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
  timezone: "Asia/Jakarta",
  startDate: "2026-08-15",
  endDate: "2026-08-16",
  venueName: "Lokasi contoh",
  venueAddress: "Alamat akan mengikuti data event.",
  mapsUrl: null,
  status: "DRAFT",
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

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${value}T00:00:00+07:00`));

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));

export const EventPublicPage: React.FC = () => {
  const { slug = "" } = useParams<{ slug: string }>();
  const [eventData, setEventData] = useState<PublicEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewMode, setPreviewMode] = useState(false);

  const loadEvent = async () => {
    setLoading(true);
    setError("");
    setPreviewMode(false);
    try {
      const response = await fetch(`${ENV.API_BASE_URL}/events/public/${encodeURIComponent(slug)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Informasi event tidak dapat dimuat.");
      setEventData(result.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Informasi event tidak dapat dimuat.");
      if (import.meta.env.DEV) {
        setEventData(previewEvent);
        setPreviewMode(true);
      } else {
        setEventData(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvent();
  }, [slug]);

  const schedule = useMemo(
    () =>
      (eventData?.days || []).map((day) => ({
        ...day,
        sessions: (eventData?.sessions || []).filter((session) => session.eventDayId === day.id),
      })),
    [eventData]
  );

  return (
    <PublicLayout>
      <main className="mx-auto max-w-4xl">
        {loading ? (
          <div className="space-y-4" aria-label="Memuat informasi event">
            <div className="h-72 animate-pulse rounded-2xl bg-slate-200" />
            <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : !eventData ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <AlertCircle className="h-10 w-10 text-rose-500" />
            <h1 className="mt-4 text-xl font-black text-slate-900">Event tidak dapat ditampilkan</h1>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
              Tautan mungkin tidak valid atau layanan sedang tidak tersedia.
            </p>
            <button
              type="button"
              onClick={() => void loadEvent()}
              className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white hover:bg-emerald-800"
            >
              <RefreshCw className="h-4 w-4" />
              Coba lagi
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {previewMode && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
                <p>API lokal belum tersambung. Halaman menampilkan data contoh untuk pratinjau UI.</p>
                <StatusBadge label="Bukan data produksi" variant="warning" />
              </div>
            )}

            <header className="overflow-hidden rounded-2xl bg-emerald-950 text-white shadow-lg">
              <div className="border-b border-emerald-800/70 p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-white/10 px-2.5 py-1 font-mono text-[10px] font-black tracking-wide text-emerald-100">
                    {eventData.code}
                  </span>
                  <StatusBadge
                    label={eventData.status.replaceAll("_", " ")}
                    variant={statusVariant(eventData.status)}
                    className="border-white/20"
                  />
                </div>
                <h1 className="mt-5 max-w-3xl text-2xl font-black leading-tight sm:text-4xl">{eventData.name}</h1>
                {eventData.subtitle && (
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-100/80">{eventData.subtitle}</p>
                )}
              </div>
              <dl className="grid gap-px bg-emerald-800/60 sm:grid-cols-2">
                <div className="flex gap-3 bg-emerald-950/80 p-5">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <div>
                    <dt className="text-[10px] font-black uppercase tracking-wider text-emerald-300">Tanggal</dt>
                    <dd className="mt-1 text-xs leading-5 text-emerald-50">
                      {formatDate(eventData.startDate)}–{formatDate(eventData.endDate)}
                    </dd>
                  </div>
                </div>
                <div className="flex gap-3 bg-emerald-950/80 p-5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <div>
                    <dt className="text-[10px] font-black uppercase tracking-wider text-emerald-300">Lokasi</dt>
                    <dd className="mt-1 text-xs leading-5 text-emerald-50">
                      {eventData.venueName || "Akan diumumkan"}
                    </dd>
                  </div>
                </div>
              </dl>
            </header>

            {(eventData.description || eventData.venueName || eventData.venueAddress) && (
              <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-sm font-black text-slate-900">Tentang kegiatan</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {eventData.description || "Deskripsi kegiatan akan diperbarui oleh penyelenggara."}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <MapPin className="h-5 w-5 text-emerald-700" />
                  <h2 className="mt-3 text-sm font-black text-slate-900">{eventData.venueName || "Lokasi acara"}</h2>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {eventData.venueAddress || "Alamat lengkap akan diumumkan."}
                  </p>
                  {eventData.mapsUrl && (
                    <a
                      href={eventData.mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex min-h-[44px] items-center gap-2 text-xs font-black text-emerald-700 hover:text-emerald-900"
                    >
                      Buka petunjuk arah
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </section>
            )}

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                <Clock className="h-5 w-5 text-emerald-700" />
                <div>
                  <h2 className="text-sm font-black text-slate-900">Jadwal kegiatan</h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">Waktu ditampilkan dalam WIB.</p>
                </div>
              </div>

              {schedule.length === 0 ? (
                <p className="py-10 text-center text-xs text-slate-500">Jadwal rinci belum dipublikasikan.</p>
              ) : (
                <div className="mt-5 space-y-5">
                  {schedule.map((day) => (
                    <article key={day.id}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-sm font-black text-slate-900">
                          Hari {day.dayNumber}
                          {day.title ? ` · ${day.title}` : ""}
                        </h3>
                        <time className="text-[11px] font-bold text-slate-500">{formatDate(day.date)}</time>
                      </div>
                      {day.sessions.length === 0 ? (
                        <p className="mt-3 rounded-lg bg-slate-50 p-4 text-xs text-slate-500">
                          Sesi untuk hari ini belum tersedia.
                        </p>
                      ) : (
                        <ol className="mt-3 divide-y divide-slate-100 border-l-2 border-emerald-600">
                          {day.sessions.map((session) => (
                            <li key={session.id} className="grid gap-2 py-4 pl-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
                              <time className="font-mono text-xs font-black text-emerald-800">
                                {formatTime(session.startAt)}–{formatTime(session.endAt)}
                              </time>
                              <div>
                                <h4 className="text-xs font-black text-slate-900">{session.title}</h4>
                                <p className="mt-1 text-[11px] text-slate-500">
                                  {[session.room, session.moderatorName && `Moderator: ${session.moderatorName}`]
                                    .filter(Boolean)
                                    .join(" · ") || "Detail ruang akan diumumkan"}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <footer className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Pendaftaran hanya melalui tautan undangan resmi lembaga atau individu.</p>
              <Link to="/login/ustadz" className="text-xs font-black text-emerald-700 hover:text-emerald-900">
                Masuk Portal Ustadz
              </Link>
            </footer>
          </div>
        )}
      </main>
    </PublicLayout>
  );
};
