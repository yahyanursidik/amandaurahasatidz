import React from "react";
import { AppShell } from "../common/AppShell";
import { User, QrCode, Calendar, Bell } from "lucide-react";
import { SidebarNavItem } from "../common/Sidebar";

const portalNavItems: SidebarNavItem[] = [
  { label: "Beranda Ustadz", href: "/portal", icon: <User /> },
  { label: "QR Kehadiran", href: "/portal/qr", icon: <QrCode /> },
  { label: "Jadwal Daurah", href: "/portal/schedule", icon: <Calendar /> },
  { label: "Pengumuman", href: "/portal/announcements", icon: <Bell /> },
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
