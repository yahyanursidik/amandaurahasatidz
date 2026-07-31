import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge, StatusVariant } from "@/components/common/StatusBadge";
import { Calendar, Plus, Search, MapPin, Eye, Edit, ExternalLink, RefreshCw, ClipboardList, UserRoundCheck } from "lucide-react";
import { eventApi } from "@/lib/eventApi";
import { DEFAULT_EVENT_POSTER, posterObjectPosition } from "@/lib/eventPoster";

type EventSummary = {
  id: string;
  code: string;
  slug: string;
  name: string;
  timezone: string;
  startDate: string;
  endDate: string;
  venueName: string | null;
  venueAddress: string | null;
  mapsUrl: string | null;
  posterUrl: string | null;
  posterAlt: string | null;
  posterFocalPoint: string | null;
  status: string;
};

const previewEvents: EventSummary[] = [
  {
    id: "event-preview-1",
    code: "CONTOH-DAURAH",
    slug: "contoh-daurah-asatidz",
    name: "Contoh Daurah Asatidz",
    timezone: "Asia/Jakarta",
    startDate: "2026-08-15",
    endDate: "2026-08-18",
    venueName: "Lokasi contoh",
    venueAddress: "Alamat akan mengikuti data event.",
    mapsUrl: null,
    posterUrl: DEFAULT_EVENT_POSTER,
    posterAlt: "Interior perpustakaan sebagai poster event contoh",
    posterFocalPoint: "CENTER",
    status: "DRAFT",
  },
];

const statusVariant = (status: string): StatusVariant => {
  if (status === "ONGOING" || status === "COMPLETED") return "success";
  if (status === "REGISTRATION_OPEN" || status === "PUBLISHED") return "info";
  if (status === "CANCELLED") return "danger";
  if (status === "REGISTRATION_CLOSED") return "warning";
  return "neutral";
};

const formatDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

export const EventListPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewMode, setPreviewMode] = useState(false);

  const loadEvents = async () => {
    setLoading(true);
    setError("");
    setPreviewMode(false);
    try {
      const result = await eventApi<EventSummary[]>("/events");
      setEvents(Array.isArray(result) ? result : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Daftar event gagal dimuat.");
      if (import.meta.env.DEV) {
        setEvents(previewEvents);
        setPreviewMode(true);
      } else {
        setEvents([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvents();
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("id-ID");
    return events.filter((item) =>
      (statusFilter === "ALL" || item.status === statusFilter) &&
      (!keyword || [item.name, item.code, item.venueName, item.status]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("id-ID").includes(keyword)))
    );
  }, [events, search, statusFilter]);

  return (
    <AdminLayout>
      <PageHeader
        title="Kelola Event Daurah"
        description="Kelola jadwal kegiatan, hari dan sesi, penugasan panitia, serta status event."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Event Daurah" }]}
        actions={
          <Link
              to="/admin/events/create"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              <Plus className="h-4 w-4" />
              <span>Buat Event</span>
            </Link>
        }
      />

      <section aria-label="Ringkasan status event" className="mb-5 grid grid-cols-2 border-y border-slate-200 bg-white sm:grid-cols-4">
        {[
          ["Total event", events.length, "ALL"],
          ["Draft", events.filter((item) => item.status === "DRAFT").length, "DRAFT"],
          ["Pendaftaran", events.filter((item) => item.status === "REGISTRATION_OPEN").length, "REGISTRATION_OPEN"],
          ["Berlangsung", events.filter((item) => item.status === "ONGOING").length, "ONGOING"],
        ].map(([label, value, filter]) => (
          <button key={String(label)} type="button" onClick={() => setStatusFilter(String(filter))} className="border-b border-r border-slate-200 p-4 text-left hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-emerald-700">
            <p className="text-2xl font-black tabular-nums text-slate-950">{loading ? "—" : value}</p>
            <p className="mt-1 truncate text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
          </button>
        ))}
      </section>

      <div className="mb-5 grid gap-3 border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[minmax(0,1fr)_13rem_auto]">
        <label className="relative block">
          <span className="sr-only">Cari event</span>
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nama, kode, lokasi, atau status event"
            className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 text-xs text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700">
          <option value="ALL">Semua status</option>
          {["DRAFT", "PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING", "COMPLETED", "ARCHIVED", "CANCELLED"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
        </select>
        <button
          type="button"
          onClick={() => void loadEvents()}
          disabled={loading}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Segarkan
        </button>
      </div>

      {error && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
          <p>
            {previewMode
              ? "API lokal belum tersambung. Satu kartu contoh ditampilkan untuk pratinjau antarmuka."
              : "Data event tidak dapat dimuat. Coba segarkan setelah koneksi API tersedia."}
          </p>
          <StatusBadge label={previewMode ? "Mode pratinjau" : "Tidak tersambung"} variant="warning" />
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2" aria-label="Memuat daftar event">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-60 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <Calendar className="h-10 w-10 text-slate-300" />
          <h2 className="mt-3 text-sm font-black text-slate-800">
            {search ? "Event tidak ditemukan" : "Belum ada event"}
          </h2>
          <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
            {search
              ? "Ubah kata kunci pencarian untuk melihat hasil lain."
              : "Buat event pertama untuk mulai menyusun jadwal, undangan, dan panitia."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="event-list-card"
            >
              <div className="event-list-card__poster">
                <img
                  src={item.posterUrl || DEFAULT_EVENT_POSTER}
                  alt={item.posterAlt || `Poster ${item.name}`}
                  style={{ objectPosition: posterObjectPosition(item.posterFocalPoint) }}
                />
              </div>
              <div className="flex flex-1 flex-col justify-between p-5">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="block truncate font-mono text-[10px] font-bold text-emerald-700">
                      {item.code}
                    </span>
                    <h2 className="mt-1 text-base font-black leading-snug text-slate-900">{item.name}</h2>
                  </div>
                  <StatusBadge label={item.status.replaceAll("_", " ")} variant={statusVariant(item.status)} />
                </div>

                <dl className="mt-4 space-y-3 border-t border-slate-100 pt-4 text-xs text-slate-600">
                  <div className="flex items-start gap-2">
                    <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div>
                      <dt className="sr-only">Tanggal</dt>
                      <dd>
                        {formatDate(item.startDate)}–{formatDate(item.endDate)}
                        <span className="ml-1 text-slate-400">({item.timezone})</span>
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <dt className="sr-only">Lokasi</dt>
                      <dd className="font-bold text-slate-800">{item.venueName || "Lokasi belum ditentukan"}</dd>
                      {item.venueAddress && <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{item.venueAddress}</p>}
                    </div>
                  </div>
                </dl>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                {!previewMode && (
                  <Link
                    to={`/events/${item.slug}`}
                    target="_blank"
                    className="inline-flex min-h-[44px] items-center gap-1.5 px-2 text-xs font-bold text-emerald-700 hover:text-emerald-900"
                  >
                    Halaman publik
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                )}
                <div className="ml-auto flex flex-wrap gap-2">
                  <Link
                    to={`/admin/events/${item.id}`}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-emerald-800 px-3 text-sm font-bold text-white hover:bg-emerald-900"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Workspace
                  </Link>
                  <Link
                    to={`/admin/events/${item.id}/registrations?view=invitations`}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-emerald-50 px-3 text-sm font-bold text-emerald-900 hover:bg-emerald-100"
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    Undangan
                  </Link>
                  <Link
                    to={`/admin/events/${item.id}/registrations?view=participants`}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-sm font-bold text-slate-700 hover:bg-slate-200"
                  >
                    <UserRoundCheck className="h-3.5 w-3.5" />
                    Peserta
                  </Link>
                  <Link
                    to={`/admin/events/${item.id}/edit`}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-bold text-slate-700 hover:bg-slate-200"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                </div>
              </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </AdminLayout>
  );
};
