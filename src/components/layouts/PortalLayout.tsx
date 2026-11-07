import React from "react";
import { AppShell } from "../common/AppShell";
import { User, QrCode, Calendar, Bell, Home, Mail, CheckCircle2, CalendarRange, HeartHandshake, MessageCircle, BookOpen, HandHeart, Lightbulb, MapPinned } from "lucide-react";
import { SidebarNavItem } from "../common/Sidebar";

export const portalNavItems: SidebarNavItem[] = [
  { label: "Beranda Asatidz", shortLabel: "Beranda", href: "/portal", icon: <Home />, exact: true, mobilePrimary: true },
  { label: "Pendaftaran Saya", shortLabel: "Daftar", href: "/portal/invitations", icon: <Mail />, mobilePrimary: true },
  { label: "QR Kehadiran", shortLabel: "QR", href: "/portal/qr", icon: <QrCode />, mobilePrimary: true },
  { label: "Jadwal Daurah", shortLabel: "Jadwal", href: "/portal/schedule", icon: <Calendar />, mobilePrimary: true },
  { label: "Riwayat Kehadiran", shortLabel: "Riwayat", href: "/portal/attendance", icon: <CheckCircle2 /> },
  { label: "Pengumuman", shortLabel: "Info", href: "/portal/announcements", icon: <Bell /> },
  { label: "Kegiatan Saya", shortLabel: "Kegiatan", href: "/portal/activities", icon: <CalendarRange /> },
  { label: "Profil Saya", shortLabel: "Profil", href: "/portal/profile", icon: <User /> },
  {
    label: "Ruang Asatidz", shortLabel: "Ruang", href: "/portal/ruang-asatidz", icon: <HeartHandshake />,
    description: "Saran, pengalaman, dan pesan untuk panitia.", keywords: ["saran", "pengalaman", "kebutuhan", "pesan"],
    children: [
      { label: "Kabar Asatidz", href: "/portal/ruang-asatidz", icon: <HeartHandshake />, exact: true },
      { label: "Saran", href: "/portal/ruang-asatidz/saran", icon: <Lightbulb />, exact: true },
      { label: "Berbagi pengalaman", href: "/portal/ruang-asatidz/pengalaman", icon: <BookOpen />, exact: true },
      { label: "Ajukan kebutuhan", href: "/portal/ruang-asatidz/kebutuhan", icon: <HandHeart />, exact: true },
      { label: "Pesan & tanggapan saya", href: "/portal/ruang-asatidz/pesan", icon: <MessageCircle /> },
      { label: "Terhubung · Cerita bersama", href: "/portal/ruang-asatidz/terhubung", icon: <BookOpen />, exact: true },
    ],
  },
  { label: "Peta Ukhuwah", shortLabel: "Ukhuwah", href: "/portal/peta-ukhuwah", icon: <MapPinned />,
    description: "Lembaga, kebutuhan dakwah, laporan bersama, dan silaturahmi Bandung Raya.",
    keywords: ["peta", "bandung", "kontak", "dakwah", "laporan"], children: [
      { label: "Peta & direktori", href: "/portal/peta-ukhuwah", icon: <MapPinned />, exact: true },
      { label: "Laporan bersama", href: "/portal/peta-ukhuwah/laporan", icon: <BookOpen />, exact: true },
      { label: "Buat laporan", href: "/portal/peta-ukhuwah/laporan/baru", icon: <Lightbulb />, exact: true },
      { label: "Laporan saya", href: "/portal/peta-ukhuwah/laporan-saya", icon: <MessageCircle />, exact: true },
    ] },
];

export const PortalLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AppShell
      portalName="Portal Asatidz"
      badgeLabel="Peserta Daurah"
      badgeColorClass="bg-emerald-800 text-emerald-100 border-emerald-700"
      navItems={portalNavItems}
    >
      {children}
    </AppShell>
  );
};
