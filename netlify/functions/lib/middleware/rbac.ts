import { PermissionCode, RoleCode, ROLE_PERMISSIONS } from "../../../../src/config/permissions";
import { UnauthorizedError, ForbiddenError } from "../utils/errors";

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
    if (assignment.endsAt && new Date(assignment.endsAt) < now) continue;

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
    if (assignment.endsAt && new Date(assignment.endsAt) < now) continue;

    const allowed = ROLE_PERMISSIONS[assignment.roleCode] || [];
    allowed.forEach((p) => permissionsSet.add(p));
  }

  return Array.from(permissionsSet);
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

// 3. Guard requireEventScope
export function requireEventScope(userSession: UserContext | null, targetEventId: string): void {
  const session = requireAuth(userSession);
  const isSuperAdmin = session.assignments.some((a) => a.roleCode === "SUPER_ADMIN");
  if (isSuperAdmin) return;

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
