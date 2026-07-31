/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4
 * Hallmark · macrostructure: Workbench · tone: utilitarian-institutional
 * audience: super admin daurah · primary use: triage and enter operational modules
 */
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge, StatusVariant } from "@/components/common/StatusBadge";
import { ENV } from "@/config/env";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileClock,
  Mail,
  QrCode,
  RefreshCw,
  Send,
  ShieldCheck,
  UserRoundCheck,
  Users,
  Workflow,
} from "lucide-react";

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

type FeatureItem = {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  accessHint?: string;
};

const featureGroups: Array<{ title: string; description: string; items: FeatureItem[] }> = [
  {
    title: "Persiapan event",
    description: "Bangun struktur kegiatan dan data dasar sebelum undangan dikirim.",
    items: [
      { title: "Event & status", description: "Buat event, atur periode, lokasi, kapasitas, dan publikasi.", href: "/admin/events", icon: CalendarDays },
      { title: "Jadwal & sesi", description: "Susun hari, sesi, pemateri, ruangan, dan jendela check-in.", href: "/admin/events", icon: Workflow, accessHint: "Dari detail event" },
      { title: "Master lembaga", description: "Kelola lembaga, alamat, kontak, dan penanggung jawab.", href: "/admin/institutions", icon: Building2 },
      { title: "Master asatidz", description: "Kelola profil, afiliasi, verifikasi, dan duplikasi data.", href: "/admin/ustadz", icon: Users },
    ],
  },
  {
    title: "Undangan & pendaftaran",
    description: "Pantau jalur masuk lembaga dan individu sampai peserta disetujui.",
    items: [
      { title: "Undangan lembaga", description: "Buat tautan unik, quota wakil, masa berlaku, dan pencabutan.", href: "/admin/events", icon: Building2, accessHint: "Dari detail event" },
      { title: "Undangan individu", description: "Kirim undangan langsung untuk asatidz tertentu.", href: "/admin/events", icon: Send, accessHint: "Dari detail event" },
      { title: "Konfirmasi pendaftar", description: "Lihat lembaga yang merespons beserta para wakilnya.", href: "/admin/events", icon: ClipboardCheck, accessHint: "Dari detail event" },
      { title: "Persetujuan peserta", description: "Tinjau data, setujui peserta, atau minta perbaikan.", href: "/admin/events", icon: UserRoundCheck, accessHint: "Dari detail event" },
    ],
  },
  {
    title: "Operasional kegiatan",
    description: "Siapkan identitas individu, komunikasi, dan pencatatan kehadiran.",
    items: [
      { title: "QR peserta", description: "Kelola QR individu untuk peserta dari lembaga maupun personal.", href: "/admin/events", icon: QrCode, accessHint: "Dari detail event" },
      { title: "Kehadiran & check-in", description: "Pantau kehadiran harian, per sesi, duplikasi, dan no-show.", href: "/admin/events", icon: CheckCircle2, accessHint: "Dari detail event" },
      { title: "Pengumuman", description: "Sampaikan pembaruan jadwal atau informasi kepada peserta.", href: "/admin/events", icon: Bell, accessHint: "Dari detail event" },
      { title: "Email & pengingat", description: "Pantau antrean email, kegagalan, dan pengiriman ulang.", href: "/admin/audit-logs", icon: Mail },
    ],
  },
  {
    title: "Kontrol & pelaporan",
    description: "Tutup kegiatan dengan data yang dapat ditelusuri dan diekspor.",
    items: [
      { title: "Laporan event", description: "Rekap undangan, peserta, lembaga, dan kehadiran.", href: "/admin/events", icon: Download, accessHint: "Dari detail event" },
      { title: "Audit sistem", description: "Telusuri perubahan data, pelaku, waktu, dan request ID.", href: "/admin/audit-logs", icon: FileClock },
      { title: "Kualitas data", description: "Gabungkan profil asatidz ganda tanpa kehilangan riwayat.", href: "/admin/ustadz/merge", icon: ShieldCheck },
    ],
  },
];

const statusVariant = (status: string): StatusVariant => {
  if (status === "ONGOING") return "success";
  if (status === "REGISTRATION_OPEN" || status === "PUBLISHED") return "info";
  if (status === "REGISTRATION_CLOSED") return "warning";
  return "neutral";
};

const formatShortDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(parsed);
};

export const AdminDashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMetrics = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${ENV.API_BASE_URL}/dashboard/admin`, { credentials: "include" });
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

  const priorities = useMemo(() => {
    if (!metrics) return [];
    return [
      metrics.pendingParticipantsCount > 0
        ? {
            label: `${metrics.pendingParticipantsCount} peserta menunggu persetujuan`,
            href: "/admin/events",
            tone: "warning" as StatusVariant,
          }
        : null,
      metrics.failedEmailsCount > 0
        ? {
            label: `${metrics.failedEmailsCount} email perlu ditangani`,
            href: "/admin/audit-logs",
            tone: "danger" as StatusVariant,
          }
        : null,
      metrics.activeEventsCount === 0
        ? {
            label: "Belum ada event aktif",
            href: "/admin/events/create",
            tone: "neutral" as StatusVariant,
          }
        : null,
    ].filter(Boolean) as Array<{ label: string; href: string; tone: StatusVariant }>;
  }, [metrics]);

  const summaries = [
    { label: "Event aktif", value: metrics?.activeEventsCount, href: "/admin/events" },
    { label: "Lembaga", value: metrics?.invitedInstitutionsCount, href: "/admin/institutions" },
    { label: "Respons undangan", value: metrics?.totalResponsesCount, href: "/admin/events" },
    { label: "Peserta disetujui", value: metrics?.approvedParticipantsCount, href: "/admin/events" },
    { label: "Menunggu tinjauan", value: metrics?.pendingParticipantsCount, href: "/admin/events" },
    { label: "Kehadiran tercatat", value: metrics?.totalAttendedCount, href: "/admin/events" },
  ];

  return (
    <AdminLayout>
      <PageHeader
        title="Pusat Kendali Daurah"
        description="Pantau pekerjaan mendesak, buka modul operasional, dan kelola seluruh siklus event."
        actions={
          <>
            <Link
              to="/admin/events/create"
              className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg bg-emerald-700 px-4 text-xs font-black text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              <CalendarDays className="h-4 w-4" />
              Buat event
            </Link>
            <button
              type="button"
              onClick={() => void loadMetrics()}
              disabled={loading}
              className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Segarkan
            </button>
          </>
        }
      />

      {error && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-t-2 border-amber-500 bg-amber-50 px-4 py-3 text-xs text-amber-950">
          <div>
            <p className="font-black">Metrik langsung belum tersambung</p>
            <p className="mt-1 leading-5">Menu tetap dapat digunakan. Jalankan Netlify Functions untuk menampilkan angka database.</p>
          </div>
          <StatusBadge label="Mode lokal" variant="warning" />
        </div>
      )}

      <section aria-label="Ringkasan operasional" className="overflow-hidden border-y border-slate-200 bg-white">
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
          {summaries.map((summary) => (
            <Link
              key={summary.label}
              to={summary.href}
              className="group min-w-0 p-4 hover:bg-emerald-50 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
            >
              <p className="text-2xl font-black tabular-nums text-slate-950">{loading ? "—" : summary.value ?? "—"}</p>
              <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wide text-slate-500">{summary.label}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-6 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <section aria-labelledby="features-heading" className="min-w-0">
          <div className="mb-4">
            <h2 id="features-heading" className="text-base font-black text-slate-950">Modul kerja admin</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Fitur dikelompokkan mengikuti urutan kerja daurah.</p>
          </div>

          <div className="space-y-4">
            {featureGroups.map((group) => (
              <section key={group.title} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <h3 className="text-xs font-black text-slate-900">{group.title}</h3>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">{group.description}</p>
                </div>
                <div className="grid md:grid-cols-2">
                  {group.items.map((item) => (
                    <Link
                      key={item.title}
                      to={item.href}
                      className="group flex min-w-0 items-start gap-3 border-b border-slate-100 p-4 transition hover:bg-emerald-50 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 md:border-r"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-800 group-hover:bg-emerald-100">
                        <item.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <strong className="truncate text-xs text-slate-900">{item.title}</strong>
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-emerald-700" />
                        </span>
                        <span className="mt-1 block text-[11px] leading-4 text-slate-500">{item.description}</span>
                        {item.accessHint && (
                          <span className="mt-2 block text-[9px] font-black uppercase tracking-wider text-emerald-700">{item.accessHint}</span>
                        )}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-slate-950 p-5 text-white">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-black">Perlu perhatian</h2>
              <AlertTriangle className="h-4 w-4 text-amber-300" />
            </div>
            {loading ? (
              <div className="mt-4 space-y-2">
                {[1, 2].map((item) => <div key={item} className="h-11 animate-pulse rounded-lg bg-white/10" />)}
              </div>
            ) : priorities.length === 0 && metrics ? (
              <div className="mt-4 flex gap-2 text-xs leading-5 text-slate-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                Tidak ada masalah prioritas dari ringkasan saat ini.
              </div>
            ) : priorities.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {priorities.map((priority) => (
                  <li key={priority.label}>
                    <Link to={priority.href} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 p-3 text-xs font-bold hover:bg-white/10">
                      <span>{priority.label}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-xs leading-5 text-slate-300">Sambungkan API untuk menghitung pekerjaan yang memerlukan tindakan.</p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-black text-slate-900">Event terbaru</h2>
              <Link to="/admin/events" className="text-[10px] font-black text-emerald-700 hover:text-emerald-900">Lihat semua</Link>
            </div>
            {loading ? (
              <div className="mt-3 space-y-2">
                {[1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-lg bg-slate-100" />)}
              </div>
            ) : metrics?.recentEvents?.length ? (
              <ul className="mt-3 divide-y divide-slate-100">
                {metrics.recentEvents.map((event) => (
                  <li key={event.id}>
                    <Link to={`/admin/events/${event.id}`} className="block py-3 hover:text-emerald-800">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-xs font-black text-slate-900">{event.name}</p>
                        <StatusBadge label={event.status.replaceAll("_", " ")} variant={statusVariant(event.status)} className="shrink-0 text-[9px]" />
                      </div>
                      <p className="mt-1 font-mono text-[9px] text-slate-400">
                        {event.code} · {formatShortDate(event.startDate)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-lg bg-slate-50 p-3 text-[11px] leading-5 text-slate-500">
                {metrics ? "Belum ada event yang dapat ditampilkan." : "Data event tersedia setelah API tersambung."}
              </p>
            )}
          </section>

          <section className="border-t-2 border-emerald-700 bg-emerald-50 p-4">
            <h2 className="text-xs font-black text-emerald-950">Alur yang disarankan</h2>
            <ol className="mt-3 space-y-2 text-[11px] leading-4 text-emerald-950">
              {["Buat event dan jadwal", "Kirim undangan", "Tinjau peserta", "Aktifkan QR individu", "Rekap kehadiran"].map((step, index) => (
                <li key={step} className="flex gap-2">
                  <span className="font-mono font-black text-emerald-700">{index + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </AdminLayout>
  );
};
