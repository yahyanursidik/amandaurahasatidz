import React from "react";
import { AppShell } from "../common/AppShell";
import { QrCode, CheckSquare, Bell } from "lucide-react";
import { SidebarNavItem } from "../common/Sidebar";

const committeeNavItems: SidebarNavItem[] = [
  { label: "Scanner Check-in", href: "/committee", icon: <QrCode /> },
  { label: "Daftar Kehadiran", href: "/committee/attendance", icon: <CheckSquare /> },
  { label: "Kelola Pengumuman", href: "/committee/announcements", icon: <Bell /> },
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
