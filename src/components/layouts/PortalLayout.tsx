import React from "react";
import { AppShell } from "../common/AppShell";
import { User, QrCode, Calendar, Bell, Home, Mail, CheckCircle2, CalendarRange, HeartHandshake, MessageCircle, BookOpen, HandHeart, Lightbulb } from "lucide-react";
import { SidebarNavItem } from "../common/Sidebar";

const portalNavItems: SidebarNavItem[] = [
  { label: "Beranda Asatidz", shortLabel: "Beranda", href: "/portal", icon: <Home />, exact: true, mobilePrimary: true },
  {
    label: "Ruang Asatidz", shortLabel: "Ruang", href: "/portal/ruang-asatidz", icon: <HeartHandshake />, mobilePrimary: true,
    description: "Disapa, didengar, dan terhubung dengan YTS.", keywords: ["saran", "pengalaman", "kebutuhan", "pesan"],
    children: [
      { label: "Disapa · Kabar YTS", href: "/portal/ruang-asatidz", icon: <HeartHandshake />, exact: true },
      { label: "Saran untuk YTS", href: "/portal/ruang-asatidz/saran", icon: <Lightbulb />, exact: true },
      { label: "Berbagi pengalaman", href: "/portal/ruang-asatidz/pengalaman", icon: <BookOpen />, exact: true },
      { label: "Ajukan kebutuhan", href: "/portal/ruang-asatidz/kebutuhan", icon: <HandHeart />, exact: true },
      { label: "Pesan & tanggapan saya", href: "/portal/ruang-asatidz/pesan", icon: <MessageCircle /> },
      { label: "Terhubung · Cerita bersama", href: "/portal/ruang-asatidz/terhubung", icon: <BookOpen />, exact: true },
      { label: "Halaman publik Ruang Asatidz", href: "/ruang-asatidz", icon: <HeartHandshake />, exact: true },
    ],
  },
  { label: "Pendaftaran Saya", shortLabel: "Daftar", href: "/portal/invitations", icon: <Mail />, mobilePrimary: true },
  { label: "Kegiatan Saya", shortLabel: "Kegiatan", href: "/portal/activities", icon: <CalendarRange /> },
  { label: "Jadwal Daurah", shortLabel: "Jadwal", href: "/portal/schedule", icon: <Calendar /> },
  { label: "QR Kehadiran", shortLabel: "QR", href: "/portal/qr", icon: <QrCode />, mobilePrimary: true },
  { label: "Pengumuman", shortLabel: "Info", href: "/portal/announcements", icon: <Bell />, mobilePrimary: true },
  { label: "Riwayat Kehadiran", shortLabel: "Riwayat", href: "/portal/attendance", icon: <CheckCircle2 /> },
  { label: "Profil Saya", shortLabel: "Profil", href: "/portal/profile", icon: <User />, mobilePrimary: true },
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
