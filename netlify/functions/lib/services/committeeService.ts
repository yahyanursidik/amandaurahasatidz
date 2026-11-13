import { ROLE_PERMISSIONS, RoleCode } from "../../../../src/config/permissions";
import {
  createCommitteeMemberWithAssignmentRepository,
  endCommitteeAssignmentRepository,
  findCommitteeCandidatesRepository,
  findCommitteeAssignmentsForUserRepository,
  findCommitteeDirectoryRepository,
  findCommitteeMemberRepository,
  findUserByEmailRepository,
  setCommitteeGlobalAccessRepository,
  updateCommitteeAssignmentRepository,
  updateCommitteeUserRepository,
  upsertCommitteeAssignmentRepository,
} from "../repositories/committeeRepository";
import { findEventOptionsRepository } from "../repositories/eventRepository";
import { evaluatePermission, type UserRoleAssignment } from "../middleware/rbac";
import { hashPassword } from "../utils/password";
import { ConflictError, NotFoundError, ValidationError } from "../utils/errors";
import { createAuditLog } from "./auditService";

const validatePeriod = (startsAt?: string | null, endsAt?: string | null) => {
  if (startsAt && Number.isNaN(new Date(startsAt).getTime()) || endsAt && Number.isNaN(new Date(endsAt).getTime())) {
    throw new ValidationError("Tanggal masa tugas tidak valid.");
  }
  if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) {
    throw new ValidationError("Awal masa tugas harus lebih awal daripada akhir masa tugas.");
  }
};

export async function getCommitteeDirectoryService(filters: { search?: string; status?: string; eventId?: string }) {
  const items = await findCommitteeDirectoryRepository(filters);
  const now = new Date();
  return {
    items,
    summary: {
      totalMembers: items.length,
      globalAdmins: items.filter((item) => item.globalAccess && item.status === "ACTIVE").length,
      activeMembers: items.filter((item) => item.status === "ACTIVE").length,
      activeAssignments: items.flatMap((item) => item.assignments)
        .filter((assignment) => (!assignment.startsAt || new Date(assignment.startsAt) <= now) && (!assignment.endsAt || new Date(assignment.endsAt) > now)).length,
      endingSoon: items.flatMap((item) => item.assignments).filter((assignment) => {
        if (!assignment.endsAt) return false;
        const remaining = new Date(assignment.endsAt).getTime() - now.getTime();
        return remaining > 0 && remaining <= 7 * 86400000;
      }).length,
    },
  };
}

export async function getCommitteeCandidatesService() {
  return findCommitteeCandidatesRepository();
}

export async function getCommitteeMemberService(userId: string) {
  const member = await findCommitteeMemberRepository(userId);
  if (!member) throw new NotFoundError("Akun panitia tidak ditemukan.");
  return member;
}

export async function createCommitteeMemberService(data: any, actorUserId: string, requestId: string) {
  if (await findUserByEmailRepository(data.email)) throw new ConflictError("Email sudah digunakan oleh akun lain.");
  validatePeriod(data.startsAt, data.endsAt);
  const { member, assignment } = await createCommitteeMemberWithAssignmentRepository({
    user: { name: data.name, email: data.email.trim().toLowerCase(),
      passwordHash: hashPassword(data.password), status: data.status },
    eventId: data.committeeRole === "COMMITTEE_ORGANIZER" ? null : data.eventId, committeeRole: data.committeeRole,
    startsAt: data.startsAt ? new Date(data.startsAt) : null,
    endsAt: data.endsAt ? new Date(data.endsAt) : null, createdBy: actorUserId,
  });
  await createAuditLog({
    actorUserId,
    action: "COMMITTEE_MEMBER_CREATED",
    resourceType: "USER",
    resourceId: member.id,
    eventId: data.committeeRole === "COMMITTEE_ORGANIZER" ? null : data.eventId || null,
    afterData: { ...member, passwordHash: undefined, assignment } as any,
    requestId,
  });
  return { ...member, passwordHash: undefined, assignment };
}

export async function updateCommitteeMemberService(userId: string, data: any, actorUserId: string, requestId: string) {
  const existing = await getCommitteeMemberService(userId);
  if (data.email) {
    const duplicate = await findUserByEmailRepository(data.email);
    if (duplicate && duplicate.id !== userId) throw new ConflictError("Email sudah digunakan oleh akun lain.");
  }
  const { password, ...profileChanges } = data;
  const updated = await updateCommitteeUserRepository(userId, {
    ...profileChanges,
    ...(data.email && { email: data.email.trim().toLowerCase() }),
    ...(password && { passwordHash: hashPassword(password) }),
  });
  delete (updated as any)?.passwordHash;
  await createAuditLog({
    actorUserId,
    action: "COMMITTEE_MEMBER_UPDATED",
    resourceType: "USER",
    resourceId: userId,
    beforeData: existing as any,
    afterData: updated as any,
    requestId,
  });
  return updated;
}

export async function setCommitteeGlobalAccessService(userId: string, enabled: boolean, actorUserId: string, requestId: string) {
  const member = await getCommitteeMemberService(userId);
  const globalAccess = await setCommitteeGlobalAccessRepository(userId, enabled, actorUserId);
  await createAuditLog({ actorUserId, action: enabled ? "COMMITTEE_GLOBAL_ACCESS_GRANTED" : "COMMITTEE_GLOBAL_ACCESS_REVOKED",
    resourceType: "USER", resourceId: userId, beforeData: { globalAccess: member.globalAccess },
    afterData: { globalAccess }, requestId });
  return { userId, globalAccess };
}

export async function assignCommitteeService(eventId: string, data: any, actorUserId: string, requestId: string) {
  validatePeriod(data.startsAt, data.endsAt);
  const created = await upsertCommitteeAssignmentRepository({
    eventId,
    userId: data.userId,
    committeeRole: data.committeeRole,
    startsAt: data.startsAt ? new Date(data.startsAt) : null,
    endsAt: data.endsAt ? new Date(data.endsAt) : null,
    permissions: data.permissions || null,
    createdBy: actorUserId,
  });
  await createAuditLog({
    actorUserId,
    action: "EVENT_COMMITTEE_ASSIGNED",
    resourceType: "EVENT_COMMITTEE_ASSIGNMENT",
    resourceId: created.id,
    eventId,
    afterData: created as any,
    requestId,
  });
  return created;
}

export async function updateCommitteeAssignmentService(assignmentId: string, eventId: string, data: any, actorUserId: string, requestId: string) {
  validatePeriod(data.startsAt, data.endsAt);
  const updated = await updateCommitteeAssignmentRepository(assignmentId, eventId, {
    ...data,
    ...(data.startsAt !== undefined && { startsAt: data.startsAt ? new Date(data.startsAt) : null }),
    ...(data.endsAt !== undefined && { endsAt: data.endsAt ? new Date(data.endsAt) : null }),
  });
  if (!updated) throw new NotFoundError("Penugasan panitia tidak ditemukan.");
  await createAuditLog({ actorUserId, action: "EVENT_COMMITTEE_UPDATED", resourceType: "EVENT_COMMITTEE_ASSIGNMENT", resourceId: assignmentId, eventId, afterData: updated as any, requestId });
  return updated;
}

export async function endCommitteeAssignmentService(assignmentId: string, eventId: string, actorUserId: string, requestId: string) {
  const updated = await endCommitteeAssignmentRepository(assignmentId, eventId);
  if (!updated) throw new NotFoundError("Penugasan panitia tidak ditemukan.");
  await createAuditLog({ actorUserId, action: "EVENT_COMMITTEE_ENDED", resourceType: "EVENT_COMMITTEE_ASSIGNMENT", resourceId: assignmentId, eventId, afterData: updated as any, requestId });
  return updated;
}

export async function getCommitteeContextService(userId: string, roleAssignments: UserRoleAssignment[] = []) {
  const now = Date.now();
  const active = roleAssignments.filter((assignment) => (!assignment.startsAt || new Date(assignment.startsAt).getTime() <= now)
    && (!assignment.endsAt || new Date(assignment.endsAt).getTime() > now)
    && !["USTADZ", "INSTITUTION_REPRESENTATIVE"].includes(assignment.roleCode));
  const global = active.find((assignment) => ["SUPER_ADMIN", "COMMITTEE_ORGANIZER"].includes(assignment.roleCode) && !assignment.eventId);
  const explicitAdmin = active.filter((assignment) => assignment.roleCode === "EVENT_ADMIN" && assignment.eventId);
  const wildcard = explicitAdmin.find((assignment) => assignment.eventId === "*");
  const actor = { userId, email: "", assignments: active };
  const permissionsForEvent = (eventId: string) => [...new Set(active.flatMap((item) => ROLE_PERMISSIONS[item.roleCode] || []))]
    .filter((action) => evaluatePermission(actor, { action, eventId }));
  const fromEvent = (event: Awaited<ReturnType<typeof findEventOptionsRepository>>[number], assignment: UserRoleAssignment) => ({
    id: `role-${event.id}`, eventId: event.id, eventName: event.name, eventCode: event.code, eventSlug: event.slug,
    eventStatus: event.status, startDate: event.startDate, endDate: event.endDate, venueName: event.venueName,
    invitationResponseDeadline: event.invitationResponseDeadline, attendanceConfirmationDeadline: event.attendanceConfirmationDeadline,
    attendanceConfirmationRequired: event.attendanceConfirmationRequired, lateConfirmationPolicy: event.lateConfirmationPolicy,
    committeeRole: assignment.roleCode, startsAt: assignment.startsAt ?? null, endsAt: assignment.endsAt ?? null,
    effectivePermissions: permissionsForEvent(event.id),
  });
  if (global || wildcard) {
    const assignment = global || wildcard!;
    const events = await findEventOptionsRepository();
    return { globalAccess: true, assignments: events.map((event) => fromEvent(event, assignment)) };
  }
  const assignments = await findCommitteeAssignmentsForUserRepository(userId);
  const linked = assignments.map((assignment) => ({
    ...assignment,
    effectivePermissions: (!assignment.startsAt || new Date(assignment.startsAt).getTime() <= now)
      && (!assignment.endsAt || new Date(assignment.endsAt).getTime() > now)
      ? permissionsForEvent(assignment.eventId) : [],
  }));
  const explicitIds = [...new Set(explicitAdmin.map((assignment) => assignment.eventId!))]
    .filter((id) => !linked.some((assignment) => assignment.eventId === id && assignment.effectivePermissions.length));
  const adminEvents = explicitIds.length ? await findEventOptionsRepository(explicitIds) : [];
  return {
    globalAccess: false,
    assignments: [...linked, ...adminEvents.map((event) => fromEvent(event, explicitAdmin.find((assignment) => assignment.eventId === event.id)!))],
  };
}
