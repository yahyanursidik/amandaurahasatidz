import React, { useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  Activity,
  BarChart3,
  Building2,
  Calendar,
  CalendarClock,
  ClipboardList,
  Combine,
  FileText,
  LayoutDashboard,
  ListChecks,
  Mail,
  PencilLine,
  Plus,
  ShieldCheck,
  UserRoundCog,
  Users,
  UsersRound,
} from "lucide-react";
import { AppShell } from "../common/AppShell";
import { SidebarNavItem } from "../common/Sidebar";

const eventIdFromPath = (pathname: string) => {
  const match = pathname.match(/^\/admin\/events\/([^/]+)/);
  if (!match || match[1] === "create") return null;
  return match[1];
};

export const getAdminNavItems = (pathname: string): SidebarNavItem[] => {
  const eventId = eventIdFromPath(pathname);
  const eventBase = eventId ? `/admin/events/${eventId}` : null;

  return [
    {
      label: "Dashboard Admin",
      shortLabel: "Beranda",
      href: "/admin",
      icon: <LayoutDashboard />,
      exact: true,
      mobilePrimary: true,
      description: "Ringkasan operasional dan pekerjaan prioritas.",
      keywords: ["beranda", "ringkasan", "prioritas"],
    },
    {
      label: "Event & Daurah",
      shortLabel: "Event",
      href: "/admin/events",
      icon: <Calendar />,
      mobilePrimary: true,
      description: "Kelola siklus event, undangan, peserta, dan laporan.",
      keywords: ["daurah", "kegiatan", "acara"],
      children: [
        { label: "Semua event", href: "/admin/events", icon: <ClipboardList />, exact: true, keywords: ["daftar"] },
        { label: "Buat event", href: "/admin/events/create", icon: <Plus />, exact: true, keywords: ["baru", "tambah"] },
        ...(eventBase
          ? [
              { label: "Ikhtisar event", href: eventBase, icon: <Activity />, exact: true, keywords: ["detail", "overview"] },
              { label: "Pendaftaran", href: `${eventBase}/registrations`, icon: <ListChecks />, exact: true, keywords: ["peserta", "undangan", "konfirmasi"] },
              { label: "Jadwal & sesi", href: `${eventBase}/schedule`, icon: <CalendarClock />, exact: true, keywords: ["hari", "materi"] },
              { label: "Tim pelaksana", href: `${eventBase}/team`, icon: <UsersRound />, exact: true, keywords: ["panitia", "penugasan"] },
              { label: "Absensi harian", href: `${eventBase}/attendance`, icon: <ListChecks />, exact: true, keywords: ["kehadiran", "check in", "qr"] },
              { label: "Komunikasi", href: `${eventBase}/communications`, icon: <Mail />, exact: true, keywords: ["wa", "email", "pengumuman"] },
              { label: "Laporan event", href: `${eventBase}/reports`, icon: <BarChart3 />, exact: true, keywords: ["rekap", "ekspor", "raport"] },
              { label: "Ubah event", href: `${eventBase}/edit`, icon: <PencilLine />, exact: true, keywords: ["edit", "poster", "pengaturan"] },
            ] satisfies SidebarNavItem[]
          : []),
      ],
    },
    {
      label: "Data Lembaga",
      shortLabel: "Lembaga",
      href: "/admin/institutions",
      icon: <Building2 />,
      mobilePrimary: true,
      description: "Direktori lembaga, kontak, undangan, dan delegasi.",
      keywords: ["institusi", "yayasan", "delegasi"],
      children: [
        { label: "Direktori lembaga", href: "/admin/institutions", icon: <Building2 />, exact: true, keywords: ["daftar"] },
        { label: "Tambah lembaga", href: "/admin/institutions/create", icon: <Plus />, exact: true, keywords: ["baru"] },
      ],
    },
    {
      label: "Data Asatidz",
      shortLabel: "Asatidz",
      href: "/admin/ustadz",
      icon: <Users />,
      mobilePrimary: true,
      description: "Profil asatidz, afiliasi, dan riwayat kehadiran.",
      keywords: ["ustadz", "peserta", "riwayat"],
      children: [
        { label: "Direktori asatidz", href: "/admin/ustadz", icon: <Users />, exact: true, keywords: ["daftar", "profil"] },
        { label: "Tambah asatidz", href: "/admin/ustadz/create", icon: <Plus />, exact: true, keywords: ["baru"] },
        { label: "Gabungkan duplikat", href: "/admin/ustadz/merge", icon: <Combine />, exact: true, keywords: ["merge", "kualitas data"] },
      ],
    },
    {
      label: "Panitia & Akses",
      shortLabel: "Panitia",
      href: "/admin/committee",
      icon: <UsersRound />,
      mobilePrimary: true,
      description: "Akun panitia, penugasan, dan batas akses.",
      keywords: ["petugas", "role", "izin"],
      children: [
        { label: "Daftar panitia", href: "/admin/committee", icon: <UserRoundCog />, exact: true, keywords: ["akun"] },
        { label: "Tambah panitia", href: "/admin/committee/create", icon: <Plus />, exact: true, keywords: ["baru", "akun"] },
      ],
    },
    {
      label: "Audit Sistem",
      shortLabel: "Audit",
      href: "/admin/audit-logs",
      icon: <FileText />,
      description: "Jejak perubahan, email gagal, dan kontrol keamanan.",
      keywords: ["log", "riwayat", "keamanan", "email gagal"],
      children: [
        { label: "Jejak aktivitas", href: "/admin/audit-logs", icon: <ShieldCheck />, exact: true, keywords: ["audit", "request id"] },
      ],
    },
  ];
};

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navItems = useMemo(() => getAdminNavItems(location.pathname), [location.pathname]);
  const isEventWorkspace = location.pathname.startsWith("/admin/events");
  const isInstitutionWorkspace = location.pathname.startsWith("/admin/institutions");
  const isUstadzWorkspace = location.pathname.startsWith("/admin/ustadz");
  const isCommitteeWorkspace = location.pathname.startsWith("/admin/committee");

  const workspaceClass = isEventWorkspace
    ? "event-workspace-type"
    : isInstitutionWorkspace
      ? "institution-workspace-type"
      : isUstadzWorkspace
        ? "ustadz-workspace-type"
        : isCommitteeWorkspace
          ? "committee-admin-workspace-type"
          : "";

  return (
    <AppShell
      portalName="Portal Super Admin"
      badgeLabel="Super Admin Mode"
      badgeColorClass="bg-emerald-800 text-emerald-100 border-emerald-700"
      navItems={navItems}
      enableCommandMenu
    >
      <div className={`admin-workspace-type ${workspaceClass}`.trim()}>{children}</div>
    </AppShell>
  );
};
