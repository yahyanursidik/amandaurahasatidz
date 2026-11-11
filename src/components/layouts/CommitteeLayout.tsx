import React from "react";
import { useGetIdentity } from "@refinedev/core";
import { AppShell } from "../common/AppShell";
import { LayoutDashboard, QrCode, CheckSquare, Bell, ScanLine, Users, ClipboardList, CalendarDays } from "lucide-react";
import { SidebarNavItem } from "../common/Sidebar";
import { ROLE_PERMISSIONS, type PermissionCode, type RoleCode } from "@/config/permissions";
import type { AuthIdentity } from "@/lib/refine/authProvider";

const committeeNavItems: SidebarNavItem[] = [
  { label: "Dashboard Panitia", shortLabel: "Beranda", href: "/committee", icon: <LayoutDashboard />, exact: true, mobilePrimary: true },
  { label: "Tugas & Akses Saya", shortLabel: "Tugas", href: "/committee/assignments", icon: <ClipboardList /> },
  { label: "Scanner Check-in", shortLabel: "Scanner", href: "/committee/check-in", icon: <ScanLine />, mobilePrimary: true },
  { label: "Gate cepat", shortLabel: "Gate", href: "/gate", icon: <ScanLine /> },
  { label: "QR Lokasi", shortLabel: "QR Lokasi", href: "/committee/location-qr", icon: <QrCode /> },
  { label: "Daftar Kehadiran", shortLabel: "Hadir", href: "/committee/attendance", icon: <CheckSquare />, mobilePrimary: true },
  { label: "Data Peserta", shortLabel: "Peserta", href: "/committee/participants", icon: <Users />, mobilePrimary: true },
  { label: "Pengumuman", shortLabel: "Info", href: "/committee/announcements", icon: <Bell />, mobilePrimary: true },
];

export const CommitteeLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: identity } = useGetIdentity<AuthIdentity>();
  const now = Date.now();
  const activeAssignments = (identity?.assignments || []).filter((assignment) =>
    (!assignment.startsAt || new Date(assignment.startsAt).getTime() <= now)
    && (!assignment.endsAt || new Date(assignment.endsAt).getTime() > now));
  const permissions = new Set(activeAssignments.flatMap((assignment) => ROLE_PERMISSIONS[assignment.roleCode as RoleCode] || []));
  const required: Record<string, PermissionCode> = {
    "/committee/check-in": "attendance.record", "/gate": "attendance.record",
    "/committee/location-qr": "attendance.record", "/committee/attendance": "attendance.read",
    "/committee/participants": "participants.read", "/committee/announcements": "announcements.read",
  };
  const navItems = committeeNavItems.filter((item) => !required[item.href] || permissions.has(required[item.href]));
  const isCommitteeOrganizer = activeAssignments.some((assignment) => assignment.roleCode === "COMMITTEE_ORGANIZER" && !assignment.eventId);
  if (isCommitteeOrganizer) navItems.splice(2, 0, { label: "Kelola Event", shortLabel: "Event", href: "/admin/events", icon: <CalendarDays />, mobilePrimary: true });
  return (
    <AppShell
      portalName="Portal Panitia Event"
      badgeLabel={isCommitteeOrganizer ? "Admin Panitia Semua Event" : "Panitia Event"}
      badgeColorClass="bg-teal-900 text-teal-100 border-teal-800"
      navItems={navItems}
    >
      {children}
    </AppShell>
  );
};
