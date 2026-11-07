/* Hallmark · pre-emit critique: P5 H4 E5 S5 R4 V4
 * Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app
 * audience: super admin operasional · primary use: event terpilih dan pekerjaan mendesak
 * nav: N13 command search inside persistent rail · footer: Ft2 · enrichment: none
 * contrast: pass (40–41) · slop: pass (42–49) · mobile: pass (34, 49–57)
 */
import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileClock,
  ListChecks,
  Mail,
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  MapPinned,
  HeartHandshake,
  Users,
  UsersRound,
} from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge, StatusVariant } from "@/components/common/StatusBadge";
import { ENV } from "@/config/env";

type RecentEvent = {
  id: string;
  code: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
};

type Metrics = {
  activeEventsCount: number;
  invitedInstitutionsCount: number;
  totalResponsesCount: number;
  approvedParticipantsCount: number;
  pendingParticipantsCount: number;
  totalAttendedCount: number;
  failedEmailsCount: number;
  asatidzProfilesCount?: number;
  archivedProfilesCount?: number;
  openRegistrationsCount?: number;
  queuedEmailsCount?: number;
  recentEvents: RecentEvent[];
  pendingEvent?: { id: string; name: string } | null;
};

type ActionItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type ActionGroup = {
  title: string;
  items: ActionItem[];
};

const statusVariant = (status: string): StatusVariant => {
  if (status === "ONGOING") return "success";
  if (status === "REGISTRATION_OPEN" || status === "PUBLISHED") return "info";
  if (status === "REGISTRATION_CLOSED") return "warning";
  return "neutral";
};

const statusLabel: Record<string, string> = {
  DRAFT: "Draf",
  PUBLISHED: "Terbit",
  REGISTRATION_OPEN: "Pendaftaran dibuka",
  REGISTRATION_CLOSED: "Pendaftaran ditutup",
  ONGOING: "Berlangsung",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

const formatShortDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(parsed);
};

const formatDateRange = (event: RecentEvent) => {
  if (event.startDate === event.endDate) return formatShortDate(event.startDate);
  return `${formatShortDate(event.startDate)} – ${formatShortDate(event.endDate)}`;
};

export const getPendingReviewHref = (eventId?: string | null) => eventId
  ? `/admin/events/${eventId}/registrations?view=participants&status=PENDING_REVIEW`
  : "/admin/events";

const AdminAction: React.FC<{ item: ActionItem }> = ({ item }) => {
  const content = (
    <>
      <span className="admin-action__icon" aria-hidden="true"><item.icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <strong>{item.title}</strong>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
    </>
  );

  return <Link to={item.href} className="admin-action">{content}</Link>;
};

export const AdminDashboardPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMetrics = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${ENV.API_BASE_URL}/dashboard/admin`, {
        credentials: "include",
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Ringkasan sistem gagal dimuat.");
      setMetrics(result.data);
    } catch (loadError) {
      setMetrics(null);
      setError(loadError instanceof Error ? loadError.message : "Ringkasan sistem gagal dimuat.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMetrics();
  }, []);

  const selectedEventId = searchParams.get("event");
  const primaryEvent = metrics?.recentEvents?.find((event) => event.id === selectedEventId) || metrics?.recentEvents?.[0] || null;
  const eventBase = primaryEvent ? `/admin/events/${primaryEvent.id}` : null;
  const chooseEvent = (eventId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("event", eventId);
    setSearchParams(next);
  };

  const priorities = useMemo(() => {
    if (!metrics) return [];
    return [
      metrics.pendingParticipantsCount > 0
        ? {
            label: `${metrics.pendingParticipantsCount} peserta menunggu tinjauan`,
            description: metrics.pendingEvent ? `Mulai dari ${metrics.pendingEvent.name}.` : "Pilih event untuk meninjau peserta.",
            href: getPendingReviewHref(metrics.pendingEvent?.id),
            tone: "warning" as StatusVariant,
          }
        : null,
      metrics.failedEmailsCount > 0
        ? {
            label: `${metrics.failedEmailsCount} email gagal dikirim`,
            description: "Tinjau antrean dan penyebab kegagalan pengiriman.",
            href: "/admin/email-jobs",
            tone: "danger" as StatusVariant,
          }
        : null,
      metrics.activeEventsCount === 0
        ? {
            label: "Belum ada event aktif",
            description: metrics.recentEvents.some((event) => event.status === "DRAFT")
              ? "Tinjau draf sebelum diterbitkan."
              : "Buat event daurah pertama.",
            href: metrics.recentEvents.some((event) => event.status === "DRAFT")
              ? "/admin/events?status=DRAFT"
              : "/admin/events/create",
            tone: "neutral" as StatusVariant,
          }
        : null,
    ].filter(Boolean) as Array<{ label: string; description: string; href: string; tone: StatusVariant }>;
  }, [metrics]);

  const summaryItems = [
    { label: "Event aktif", value: metrics?.activeEventsCount, href: "/admin/events" },
    { label: "Pendaftaran dibuka", value: metrics?.openRegistrationsCount, href: "/admin/events?status=REGISTRATION_OPEN" },
    { label: "Respons undangan", value: metrics?.totalResponsesCount, href: "/admin/events" },
    { label: "Peserta disetujui", value: metrics?.approvedParticipantsCount, href: "/admin/events" },
    { label: "Menunggu persetujuan", value: metrics?.pendingParticipantsCount, href: getPendingReviewHref(metrics?.pendingEvent?.id) },
    { label: "Catatan hadir semua event", value: metrics?.totalAttendedCount, href: "/admin/events" },
    { label: "Data lembaga", value: metrics?.invitedInstitutionsCount, href: "/admin/institutions" },
    { label: "Profil asatidz", value: metrics?.asatidzProfilesCount, href: "/admin/ustadz" },
  ];

  const actionGroups: ActionGroup[] = [
    {
      title: "Program & event",
      items: [
        { title: "Semua event", href: "/admin/events", icon: CalendarDays },
        { title: "Buat event", href: "/admin/events/create", icon: CalendarPlus },
      ],
    },
    {
      title: "Data & akses",
      items: [
        { title: "Lembaga", href: "/admin/institutions", icon: Building2 },
        { title: "Asatidz & riwayat", href: "/admin/ustadz", icon: Users },
        { title: "Panitia & akses", href: "/admin/committee", icon: UsersRound },
      ],
    },
    {
      title: "Komunikasi & relasi",
      items: [
        { title: "BC & template email", href: "/admin/broadcast", icon: Megaphone },
        { title: "Antrean email", href: "/admin/email-jobs", icon: Mail },
        { title: "Ruang Asatidz", href: "/admin/ruang-asatidz", icon: HeartHandshake },
        { title: "Peta Ukhuwah", href: "/admin/peta-ukhuwah", icon: MapPinned },
      ],
    },
    {
      title: "Mutu & pengawasan",
      items: [
        { title: "Audit aktivitas", href: "/admin/audit-logs", icon: ShieldCheck },
        { title: "Profil diarsipkan", href: "/admin/ustadz?profileStatus=ARCHIVED", icon: FileClock },
      ],
    },
  ];

  return (
    <AdminLayout>
      <div className="admin-dashboard">
        <PageHeader
          title="Dashboard Admin"
          description="Pekerjaan penting, event, dan data daurah dalam satu ruang kerja."
          actions={
            <>
              <button
                type="button"
                className="admin-button admin-button--quiet"
                onClick={() => window.dispatchEvent(new Event("open-admin-command-menu"))}
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                Cari fitur
                <kbd>Ctrl K</kbd>
              </button>
              <Link to="/admin/events/create" className="admin-button admin-button--primary">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Buat event
              </Link>
              <button type="button" onClick={() => void loadMetrics()} disabled={loading} className="admin-button admin-button--quiet">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
                {loading ? "Memuat" : "Segarkan"}
              </button>
            </>
          }
        />

        {error && (
          <section className="admin-notice" role="alert">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <strong>Ringkasan database belum dapat dimuat</strong>
              <p>{error} Menu dan navigasi tetap dapat digunakan; coba muat ulang setelah API tersambung.</p>
            </div>
            <button type="button" onClick={() => void loadMetrics()} className="admin-button admin-button--quiet">Coba lagi</button>
          </section>
        )}

        <section className="admin-metric-strip" aria-label="Ringkasan seluruh event" aria-live="polite">
          {summaryItems.map((summary) => (
            <Link key={summary.label} to={summary.href} className="admin-metric">
              {loading ? <span className="admin-metric__skeleton" aria-label="Memuat data" /> : <strong>{summary.value ?? "—"}</strong>}
              <span>{summary.label}</span>
            </Link>
          ))}
        </section>

        <div className="admin-dashboard__layout">
          <div className="min-w-0 space-y-6">
            <section className="admin-current-event" aria-labelledby="current-event-heading">
              <header>
                <div className="min-w-0">
                  <h2 id="current-event-heading">Workspace event</h2>
                  <p>Pilih event untuk membuka pekerjaan di bawah.</p>
                </div>
                <div className="admin-event-picker">
                  {metrics?.recentEvents?.length ? (
                    <label>
                      <span className="sr-only">Pilih event</span>
                      <select value={primaryEvent?.id || ""} onChange={(event) => chooseEvent(event.target.value)}>
                        {metrics.recentEvents.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
                      </select>
                    </label>
                  ) : null}
                  <Link to="/admin/events" className="admin-text-link">Semua event <ArrowRight className="h-4 w-4" /></Link>
                </div>
              </header>

              {loading ? (
                <div className="admin-event-skeleton" aria-label="Memuat event terbaru" />
              ) : primaryEvent ? (
                <>
                  <div className="admin-current-event__identity">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge label={statusLabel[primaryEvent.status] || primaryEvent.status.replaceAll("_", " ")} variant={statusVariant(primaryEvent.status)} />
                        <span className="admin-event-code">{primaryEvent.code}</span>
                      </div>
                      <h3>{primaryEvent.name}</h3>
                      <p>{formatDateRange(primaryEvent)}</p>
                    </div>
                    <Link to={`/admin/events/${primaryEvent.id}`} className="admin-button admin-button--primary">Buka workspace</Link>
                  </div>

                  <div className="admin-event-tools" aria-label="Pintasan event aktif">
                    {[
                      ["Pendaftaran", "Undangan dan peserta", `${eventBase}/registrations`, ClipboardCheck],
                      ["Jadwal", "Hari dan sesi", `${eventBase}/schedule`, Clock3],
                      ["Panitia", "Tim pelaksana", `${eventBase}/team`, UsersRound],
                      ["Absensi", "Kehadiran harian", `${eventBase}/attendance`, ListChecks],
                      ["Komunikasi", "WA dan email", `${eventBase}/communications`, Mail],
                      ["Laporan", "Rekap dan ekspor", `${eventBase}/reports`, BarChart3],
                    ].map(([label, description, href, Icon]) => {
                      const ToolIcon = Icon as React.ComponentType<{ className?: string }>;
                      return (
                        <Link key={label as string} to={href as string}>
                          <ToolIcon className="h-5 w-5" aria-hidden="true" />
                          <span><strong>{label as string}</strong><small>{description as string}</small></span>
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="admin-empty-state">
                  <CalendarPlus className="h-6 w-6" aria-hidden="true" />
                  <div><strong>Belum ada event untuk dikendalikan</strong><p>Buat event pertama agar pintasan jadwal, undangan, absensi, dan laporan aktif.</p></div>
                  <Link to="/admin/events/create" className="admin-button admin-button--primary">Buat event</Link>
                </div>
              )}
            </section>

            <section aria-labelledby="module-index-heading">
              <div className="admin-section-heading">
                <div>
                  <h2 id="module-index-heading">Indeks modul admin</h2>
                  <p>Jalur cepat ke pengelolaan lintas event.</p>
                </div>
              </div>

              <div className="admin-module-index">
                {actionGroups.map((group) => (
                  <section key={group.title} className="admin-module-group">
                    <header><h3>{group.title}</h3></header>
                    <div>{group.items.map((item) => <AdminAction key={item.title} item={item} />)}</div>
                  </section>
                ))}
              </div>
            </section>
          </div>

          <aside className="admin-dashboard__aside" aria-label="Informasi pendamping">
            <section className="admin-priority">
              <header><div><h2>Perlu perhatian</h2><p>Urutkan pekerjaan sebelum membuka modul lain.</p></div><Activity className="h-5 w-5" aria-hidden="true" /></header>
              {loading ? (
                <div className="space-y-3">{[1, 2].map((item) => <div key={item} className="admin-priority__skeleton" />)}</div>
              ) : priorities.length > 0 ? (
                <ul>
                  {priorities.map((priority) => (
                    <li key={priority.label}>
                      <Link to={priority.href}>
                        <div><StatusBadge label={priority.label} variant={priority.tone} /><p>{priority.description}</p></div>
                        <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : metrics ? (
                <div className="admin-priority__clear"><CheckCircle2 className="h-5 w-5" aria-hidden="true" /><div><strong>Tidak ada antrean prioritas</strong><p>Ringkasan saat ini tidak menemukan peserta tertunda atau email gagal.</p></div></div>
              ) : (
                <p>Prioritas tampil setelah ringkasan database tersambung.</p>
              )}
            </section>

            <section className="admin-recent-events">
              <header><h2>Event terbaru</h2><Link to="/admin/events" className="admin-text-link">Lihat semua</Link></header>
              {loading ? (
                <div className="space-y-2">{[1, 2, 3].map((item) => <div key={item} className="admin-recent-events__skeleton" />)}</div>
              ) : metrics?.recentEvents?.length ? (
                <ol>
                  {metrics.recentEvents.map((event, index) => (
                    <li key={event.id}>
                      <Link to={`/admin/events/${event.id}`}>
                        <span className="admin-recent-events__number">{String(index + 1).padStart(2, "0")}</span>
                        <span className="min-w-0 flex-1"><strong>{event.name}</strong><small>{formatShortDate(event.startDate)} · {event.code}</small></span>
                        <StatusBadge
                          label={statusLabel[event.status] || event.status.replaceAll("_", " ")}
                          variant={statusVariant(event.status)}
                          className="admin-recent-events__status"
                        />
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="admin-empty-state admin-empty-state--compact"><FileClock className="h-5 w-5" aria-hidden="true" /><div><strong>Belum ada event</strong><p>Event yang dibuat akan tampil di sini.</p></div></div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </AdminLayout>
  );
};
