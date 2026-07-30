import React from "react";
import { AppShell } from "../common/AppShell";
import { Shield, Calendar, Building2, Users, FileText } from "lucide-react";
import { SidebarNavItem } from "../common/Sidebar";

const adminNavItems: SidebarNavItem[] = [
  { label: "Dashboard Admin", href: "/admin", icon: <Shield /> },
  { label: "Kelola Event", href: "/admin/events", icon: <Calendar /> },
  { label: "Master Lembaga", href: "/admin/institutions", icon: <Building2 /> },
  { label: "Master Asatidz", href: "/admin/ustadz", icon: <Users /> },
  { label: "Audit Log System", href: "/admin/audit-logs", icon: <FileText /> },
];

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AppShell
      portalName="Portal Super Admin"
      badgeLabel="Super Admin Mode"
      badgeColorClass="bg-emerald-800 text-emerald-100 border-emerald-700"
      navItems={adminNavItems}
    >
      {children}
    </AppShell>
  );
};
