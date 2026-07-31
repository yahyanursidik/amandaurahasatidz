import React from "react";
import { AppShell } from "../common/AppShell";
import { User, QrCode, Calendar, Bell, Home, Mail, CheckCircle2, CalendarRange } from "lucide-react";
import { SidebarNavItem } from "../common/Sidebar";

const portalNavItems: SidebarNavItem[] = [
  { label: "Beranda Asatidz", shortLabel: "Beranda", href: "/portal", icon: <Home />, exact: true, mobilePrimary: true },
  { label: "Undangan Saya", shortLabel: "Undangan", href: "/portal/invitations", icon: <Mail />, mobilePrimary: true },
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
