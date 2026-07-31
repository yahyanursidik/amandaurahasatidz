import React from "react";
import { AppShell } from "../common/AppShell";
import { LayoutDashboard, QrCode, CheckSquare, Bell, ScanLine, Users, ClipboardList } from "lucide-react";
import { SidebarNavItem } from "../common/Sidebar";

const committeeNavItems: SidebarNavItem[] = [
  { label: "Dashboard Panitia", shortLabel: "Beranda", href: "/committee", icon: <LayoutDashboard />, exact: true },
  { label: "Tugas & Akses Saya", shortLabel: "Tugas", href: "/committee/assignments", icon: <ClipboardList /> },
  { label: "Scanner Check-in", shortLabel: "Scanner", href: "/committee/check-in", icon: <ScanLine /> },
  { label: "QR Lokasi", shortLabel: "QR Lokasi", href: "/committee/location-qr", icon: <QrCode /> },
  { label: "Daftar Kehadiran", shortLabel: "Hadir", href: "/committee/attendance", icon: <CheckSquare /> },
  { label: "Data Peserta", shortLabel: "Peserta", href: "/committee/participants", icon: <Users /> },
  { label: "Pengumuman", shortLabel: "Info", href: "/committee/announcements", icon: <Bell /> },
];

export const CommitteeLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AppShell
      portalName="Portal Panitia Event"
      badgeLabel="Panitia Registrasi"
      badgeColorClass="bg-teal-900 text-teal-100 border-teal-800"
      navItems={committeeNavItems}
    >
      {children}
    </AppShell>
  );
};
