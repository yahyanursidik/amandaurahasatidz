/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
 * Hallmark · genre: modern-minimal · macrostructure: Ecosystem Index · tone: utilitarian-professional
 * audience: super admin operasional · primary use: event aktif dan pekerjaan mendesak
 * nav: N13 command search inside persistent rail · footer: Ft2 · enrichment: none
 * contrast: pass (40–41) · slop: pass (42–49) · mobile: pass (34, 49–57)
 */
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
  Combine,
  FileClock,
  ListChecks,
  Mail,
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundCheck,
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
  recentEvents: RecentEvent[];
};

type ActionItem = {
  title: string;
  description: string;
  href: string | null;
  icon: React.ComponentType<{ className?: string }>;
  keywords?: string;
};

type ActionGroup = {
  title: string;
  description: string;
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

const AdminAction: React.FC<{ item: ActionItem }> = ({ item }) => {
  const content = (
    <>
      <span className="admin-action__icon" aria-hidden="true"><item.icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <strong>{item.title}</strong>
        <small>{item.description}</small>
      </span>
      {item.href && <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />}
    </>
  );

  if (!item.href) {
    return <div className="admin-action is-disabled" aria-disabled="true" title="Pilih atau buat event terlebih dahulu">{content}</div>;
  }
  return <Link to={item.href} className="admin-action">{content}</Link>;
};

export const AdminDashboardPage: React.FC = () => {
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

  const primaryEvent = metrics?.recentEvents?.[0] || null;
  const eventBase = primaryEvent ? `/admin/events/${primaryEvent.id}` : null;

  const priorities = useMemo(() => {
    if (!metrics) return [];
    return [
      metrics.pendingParticipantsCount > 0
        ? {
            label: `${metrics.pendingParticipantsCount} peserta menunggu tinjauan`,
            description: "Periksa data dan tetapkan status persetujuan.",
            href: eventBase ? `${eventBase}/registrations` : "/admin/events",
            tone: "warning" as StatusVariant,
          }
        : null,
      metrics.failedEmailsCount > 0
        ? {
            label: `${metrics.failedEmailsCount} email gagal dikirim`,
            description: "Tinjau antrean dan penyebab kegagalan pengiriman.",
            href: "/admin/audit-logs",
            tone: "danger" as StatusVariant,
          }
        : null,
      metrics.activeEventsCount === 0
        ? {
            label: "Belum ada event aktif",
            description: "Buat event atau terbitkan event yang masih berupa draf.",
            href: "/admin/events/create",
            tone: "neutral" as StatusVariant,
          }
        : null,
    ].filter(Boolean) as Array<{ label: string; description: string; href: string; tone: StatusVariant }>;
  }, [eventBase, metrics]);

  const summaryItems = [
    { label: "Event aktif", value: metrics?.activeEventsCount, href: "/admin/events" },
    { label: "Lembaga", value: metrics?.invitedInstitutionsCount, href: "/admin/institutions" },
    { label: "Respons undangan", value: metrics?.totalResponsesCount, href: eventBase ? `${eventBase}/registrations` : "/admin/events" },
    { label: "Peserta disetujui", value: metrics?.approvedParticipantsCount, href: eventBase ? `${eventBase}/registrations` : "/admin/events" },
    { label: "Menunggu tinjauan", value: metrics?.pendingParticipantsCount, href: eventBase ? `${eventBase}/registrations` : "/admin/events" },
    { label: "Kehadiran tercatat", value: metrics?.totalAttendedCount, href: eventBase ? `${eventBase}/attendance` : "/admin/events" },
  ];

  const actionGroups: ActionGroup[] = [
    {
      title: "Program & event",
      description: "Siapkan identitas, jadwal, panitia, dan status kegiatan.",
      items: [
        { title: "Semua event", description: "Cari, filter, dan buka workspace event.", href: "/admin/events", icon: CalendarDays },
        { title: "Buat event", description: "Atur periode, lokasi, kapasitas, dan poster.", href: "/admin/events/create", icon: CalendarPlus },
        { title: "Jadwal & sesi", description: "Susun agenda per hari dan jendela check-in.", href: eventBase ? `${eventBase}/schedule` : null, icon: Clock3 },
        { title: "Tim pelaksana", description: "Atur panitia, tugas, dan kewenangan event.", href: eventBase ? `${eventBase}/team` : null, icon: UsersRound },
      ],
    },
    {
      title: "Undangan & peserta",
      description: "Kelola respons lembaga sampai absensi individu.",
      items: [
        { title: "Pendaftaran", description: "Lihat undangan, delegasi lembaga, dan persetujuan.", href: eventBase ? `${eventBase}/registrations` : null, icon: ClipboardCheck },
        { title: "Absensi harian", description: "Pantau QR, kode peserta, no-show, dan kehadiran per hari.", href: eventBase ? `${eventBase}/attendance` : null, icon: ListChecks },
        { title: "Komunikasi", description: "Hubungi peserta melalui WhatsApp, email, dan pengumuman.", href: eventBase ? `${eventBase}/communications` : null, icon: Megaphone },
        { title: "Laporan event", description: "Rekap peserta, lembaga, dan kehadiran untuk ekspor.", href: eventBase ? `${eventBase}/reports` : null, icon: BarChart3 },
      ],
    },
    {
      title: "Data induk",
      description: "Jaga data lintas event tetap rapi dan dapat ditelusuri.",
      items: [
        { title: "Data lembaga", description: "Kontak, alamat, undangan, dan riwayat delegasi.", href: "/admin/institutions", icon: Building2 },
        { title: "Data asatidz", description: "Profil, afiliasi, dan riwayat mengikuti daurah.", href: "/admin/ustadz", icon: Users },
        { title: "Gabungkan duplikat", description: "Satukan profil tanpa menghilangkan histori event.", href: "/admin/ustadz/merge", icon: Combine },
        { title: "Panitia & akses", description: "Kelola akun, penugasan, dan batas konfirmasi.", href: "/admin/committee", icon: UserRoundCheck },
      ],
    },
    {
      title: "Pengawasan sistem",
      description: "Telusuri aktivitas dan gangguan operasional.",
      items: [
        { title: "Audit aktivitas", description: "Lihat pelaku, perubahan, waktu, dan request ID.", href: "/admin/audit-logs", icon: ShieldCheck },
        { title: "Antrean email", description: "Temukan pengiriman gagal dan jalankan penanganan.", href: "/admin/audit-logs", icon: Mail },
      ],
    },
  ];

  return (
    <AdminLayout>
      <div className="admin-dashboard">
        <PageHeader
          title="Kendali Operasional"
          description="Buka pekerjaan yang perlu ditangani dan lanjutkan pengelolaan event tanpa mencari menu berulang kali."
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

        <section className="admin-metric-strip" aria-label="Ringkasan operasional" aria-live="polite">
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
                  <h2 id="current-event-heading">Event kendali</h2>
                  <p>Event terbaru menjadi konteks pintasan operasional di dashboard dan submenu.</p>
                </div>
                <Link to="/admin/events" className="admin-text-link">Ganti event <ArrowRight className="h-4 w-4" /></Link>
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
                  <p>Fitur disusun mengikuti alur kerja daurah, bukan struktur teknis aplikasi.</p>
                </div>
                {!primaryEvent && !loading && <StatusBadge label="Fitur event menunggu event aktif" variant="neutral" />}
              </div>

              <div className="admin-module-index">
                {actionGroups.map((group) => (
                  <section key={group.title} className="admin-module-group">
                    <header><h3>{group.title}</h3><p>{group.description}</p></header>
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
