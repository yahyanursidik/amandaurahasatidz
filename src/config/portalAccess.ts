import type { RoleCode } from "./permissions";

export type PortalCode = "admin" | "committee" | "ustadz";

/** One policy for password login, activation/recovery, and portal guidance. */
export const PORTAL_ROLES: Record<PortalCode, readonly RoleCode[]> = {
  admin: ["SUPER_ADMIN", "SYSTEM_ADMIN", "DATA_STEWARD", "REPORT_VIEWER", "EVENT_ADMIN", "COMMITTEE_ORGANIZER"],
  committee: ["SUPER_ADMIN", "EVENT_ADMIN", "COMMITTEE_ORGANIZER", "COMMITTEE_ADMIN", "COMMITTEE_LEAD",
    "REGISTRATION_OFFICER", "CHECKIN_OFFICER", "INFORMATION_OFFICER", "EVENT_VIEWER"],
  ustadz: ["USTADZ"],
};

export const PORTAL_LOGIN_PATHS: Record<PortalCode, string> = {
  admin: "/login/admin", committee: "/login/committee", ustadz: "/login/ustadz",
};

export const PORTAL_LABELS: Record<PortalCode, string> = {
  admin: "Portal Admin", committee: "Portal Panitia", ustadz: "Portal Asatidz",
};

export type PortalAssignment = {
  roleCode: string;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
};

export function hasPortalAccess(portal: PortalCode, assignments: readonly PortalAssignment[], now = Date.now()) {
  return assignments.some((assignment) => PORTAL_ROLES[portal].includes(assignment.roleCode as RoleCode)
    && (!assignment.startsAt || new Date(assignment.startsAt).getTime() <= now)
    && (!assignment.endsAt || new Date(assignment.endsAt).getTime() > now));
}

export function getAccessiblePortals(assignments: readonly PortalAssignment[], now = Date.now()) {
  return (["admin", "committee", "ustadz"] as const).filter((portal) => hasPortalAccess(portal, assignments, now));
}
