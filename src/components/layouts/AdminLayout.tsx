import React from "react";
import { useLocation } from "react-router-dom";
import { AppShell } from "../common/AppShell";
import { Shield, Calendar, Building2, Users, FileText, UsersRound } from "lucide-react";
import { SidebarNavItem } from "../common/Sidebar";

const adminNavItems: SidebarNavItem[] = [
  { label: "Dashboard Admin", shortLabel: "Beranda", href: "/admin", icon: <Shield />, exact: true },
  { label: "Kelola Event", shortLabel: "Event", href: "/admin/events", icon: <Calendar /> },
  { label: "Master Lembaga", shortLabel: "Lembaga", href: "/admin/institutions", icon: <Building2 /> },
  { label: "Master Asatidz", shortLabel: "Asatidz", href: "/admin/ustadz", icon: <Users /> },
  { label: "Pengelolaan Panitia", shortLabel: "Panitia", href: "/admin/committee", icon: <UsersRound /> },
  { label: "Audit Sistem", shortLabel: "Audit", href: "/admin/audit-logs", icon: <FileText /> },
];

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const isEventWorkspace = location.pathname.startsWith("/admin/events");
  const isInstitutionWorkspace = location.pathname.startsWith("/admin/institutions");
  const isUstadzWorkspace = location.pathname.startsWith("/admin/ustadz");
  const isCommitteeWorkspace = location.pathname.startsWith("/admin/committee");
  return (
    <AppShell
      portalName="Portal Super Admin"
      badgeLabel="Super Admin Mode"
      badgeColorClass="bg-emerald-800 text-emerald-100 border-emerald-700"
      navItems={adminNavItems}
    >
      <div
        className={
          isEventWorkspace
            ? "event-workspace-type"
            : isInstitutionWorkspace
              ? "institution-workspace-type"
              : isUstadzWorkspace
                ? "ustadz-workspace-type"
                : isCommitteeWorkspace
                  ? "committee-admin-workspace-type"
                : undefined
        }
      >
        {children}
      </div>
    </AppShell>
  );
};
