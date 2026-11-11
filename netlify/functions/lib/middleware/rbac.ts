import { PermissionCode, RoleCode, ROLE_PERMISSIONS } from "../../../../src/config/permissions";
import { UnauthorizedError, ForbiddenError, ValidationError } from "../utils/errors";

export interface UserRoleAssignment {
  roleCode: RoleCode;
  eventId?: string | null;
  institutionId?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
}

export interface UserContext {
  userId: string;
  email: string;
  name?: string | null;
  ustadzId?: string | null;
  assignments: UserRoleAssignment[];
}

export interface AccessCheckParams {
  action: PermissionCode;
  eventId?: string;
  institutionId?: string;
}

export function evaluatePermission(user: UserContext, params: AccessCheckParams): boolean {
  const now = new Date();

  for (const assignment of user.assignments) {
    // Check assignment validity period
    if (assignment.startsAt && new Date(assignment.startsAt) > now) continue;
    if (assignment.endsAt && new Date(assignment.endsAt) <= now) continue;

    const allowedPermissions = ROLE_PERMISSIONS[assignment.roleCode] || [];
    if (!allowedPermissions.includes(params.action)) continue;

    // Super Admin has global access across all events and institutions
    if (assignment.roleCode === "SUPER_ADMIN") return true;

    // Institution scope requirement check
    if (params.institutionId) {
      if (assignment.institutionId) {
        if (assignment.institutionId !== params.institutionId) continue;
      } else if (assignment.roleCode === "INSTITUTION_REPRESENTATIVE") {
        continue;
      }
    }

    // Event scope requirement check
    if (params.eventId) {
      if (assignment.eventId) {
        if (assignment.eventId !== "*" && assignment.eventId !== params.eventId) continue;
      } else {
        const eventScopedRoles: RoleCode[] = [
          "EVENT_ADMIN",
          "COMMITTEE_ADMIN",
          "COMMITTEE_LEAD",
          "REGISTRATION_OFFICER",
          "CHECKIN_OFFICER",
          "INFORMATION_OFFICER",
          "EVENT_VIEWER",
        ];
        if (eventScopedRoles.includes(assignment.roleCode)) continue;
      }
    }

    return true;
  }

  return false;
}

export function getEffectivePermissions(user: UserContext): PermissionCode[] {
  const now = new Date();
  const permissionsSet = new Set<PermissionCode>();

  for (const assignment of user.assignments) {
    if (assignment.startsAt && new Date(assignment.startsAt) > now) continue;
    if (assignment.endsAt && new Date(assignment.endsAt) <= now) continue;

    const allowed = ROLE_PERMISSIONS[assignment.roleCode] || [];
    allowed.forEach((p) => permissionsSet.add(p));
  }

  return Array.from(permissionsSet);
}

/** null means an active global staff role; an empty array means no readable event. */
export function readableEventIds(user: UserContext): string[] | null {
  const now = new Date();
  const active = user.assignments.filter((assignment) =>
    (!assignment.startsAt || new Date(assignment.startsAt) <= now)
    && (!assignment.endsAt || new Date(assignment.endsAt) > now)
    && ROLE_PERMISSIONS[assignment.roleCode]?.includes("events.read"));
  if (active.some((assignment) => ["SUPER_ADMIN", "SYSTEM_ADMIN", "REPORT_VIEWER", "COMMITTEE_ORGANIZER"].includes(assignment.roleCode)
    && !assignment.eventId) || active.some((assignment) => assignment.eventId === "*")) return null;
  return [...new Set(active.map((assignment) => assignment.eventId).filter((id): id is string => Boolean(id)))];
}

// 1. Guard requireAuth
export function requireAuth(userSession: UserContext | null): UserContext {
  if (!userSession) {
    throw new UnauthorizedError("Autentikasi diperlukan. Silakan login terlebih dahulu.");
  }
  return userSession;
}

// 2. Guard requirePermission
export function requirePermission(
  userSession: UserContext | null,
  action: PermissionCode,
  eventId?: string,
  institutionId?: string
): void {
  const session = requireAuth(userSession);
  const allowed = evaluatePermission(session, { action, eventId, institutionId });

  if (!allowed) {
    throw new ForbiddenError(
      `Akses ditolak: Anda tidak memiliki wewenang '${action}' pada lingkup yang diminta.`
    );
  }
}

/** Unscoped system-wide reads must never be authorized by an event role. */
export function requireGlobalPermission(userSession: UserContext | null, action: PermissionCode): void {
  const session = requireAuth(userSession);
  const globalAssignments = session.assignments.filter((assignment) =>
    ["SUPER_ADMIN", "SYSTEM_ADMIN", "DATA_STEWARD", "REPORT_VIEWER"].includes(assignment.roleCode)
    && !assignment.eventId);
  requirePermission({ ...session, assignments: globalAssignments }, action);
}

/** Event staff may report on their own event, never aggregate unrelated events. */
export function requireReportAccess(userSession: UserContext | null, action: "reports.read" | "reports.export",
  reportType: string, eventId?: string): void {
  const session = requireAuth(userSession);
  if (eventId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId)) {
    throw new ValidationError("ID event laporan tidak valid.");
  }
  const globalReportReader = session.assignments.some((assignment) =>
    ["SUPER_ADMIN", "REPORT_VIEWER"].includes(assignment.roleCode) && !assignment.eventId
    && (!assignment.startsAt || new Date(assignment.startsAt).getTime() <= Date.now())
    && (!assignment.endsAt || new Date(assignment.endsAt).getTime() > Date.now()));
  if (globalReportReader) {
    requireGlobalPermission(session, action);
    return;
  }
  if (!eventId) throw new ValidationError("Pilih event untuk melihat laporan.");
  if (reportType === "demographics" || reportType === "returning-participants" && readableEventIds(session) !== null) {
    throw new ForbiddenError("Laporan lintas event hanya tersedia untuk admin pusat.");
  }
  requirePermission(session, action, eventId);
}

// 3. Guard requireEventScope
export function requireEventScope(userSession: UserContext | null, targetEventId: string): void {
  const session = requireAuth(userSession);
  const globalEventAdmin = session.assignments.some((a) => ["SUPER_ADMIN", "COMMITTEE_ORGANIZER"].includes(a.roleCode)
    && !a.eventId && (!a.startsAt || new Date(a.startsAt) <= new Date())
    && (!a.endsAt || new Date(a.endsAt) > new Date()));
  if (globalEventAdmin) return;

  const now = new Date();
  const hasEventScope = session.assignments.some((a) => {
    if (a.startsAt && new Date(a.startsAt) > now) return false;
    if (a.endsAt && new Date(a.endsAt) < now) return false;
    return a.eventId === "*" || a.eventId === targetEventId;
  });

  if (!hasEventScope) {
    throw new ForbiddenError("Akses ditolak: Anda tidak ditugaskan pada event daurah ini.");
  }
}

// 4. Guard requireInstitutionScope
export function requireInstitutionScope(userSession: UserContext | null, targetInstitutionId: string): void {
  const session = requireAuth(userSession);
  const isSuperAdmin = session.assignments.some((a) => a.roleCode === "SUPER_ADMIN" || a.roleCode === "SYSTEM_ADMIN");
  if (isSuperAdmin) return;

  const now = new Date();
  const hasInstScope = session.assignments.some((a) => {
    if (a.startsAt && new Date(a.startsAt) > now) return false;
    if (a.endsAt && new Date(a.endsAt) < now) return false;
    return a.institutionId === targetInstitutionId;
  });

  if (!hasInstScope) {
    throw new ForbiddenError("Akses ditolak: Anda tidak memiliki wewenang untuk mengelola lembaga ini.");
  }
}

// 5. Guard requireOwnership
export function requireOwnership(userSession: UserContext | null, ownerUserId: string): void {
  const session = requireAuth(userSession);
  const isSuperAdmin = session.assignments.some((a) => a.roleCode === "SUPER_ADMIN");
  if (isSuperAdmin) return;

  if (session.userId !== ownerUserId) {
    throw new ForbiddenError("Akses ditolak: Anda hanya dapat mengelola data milik sendiri.");
  }
}
