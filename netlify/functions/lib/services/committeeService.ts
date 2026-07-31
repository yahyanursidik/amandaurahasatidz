import { ROLE_PERMISSIONS, RoleCode } from "../../../../src/config/permissions";
import {
  createCommitteeUserRepository,
  endCommitteeAssignmentRepository,
  findCommitteeAssignmentsForUserRepository,
  findCommitteeDirectoryRepository,
  findCommitteeMemberRepository,
  findUserByEmailRepository,
  updateCommitteeAssignmentRepository,
  updateCommitteeUserRepository,
  upsertCommitteeAssignmentRepository,
} from "../repositories/committeeRepository";
import { hashPassword } from "../utils/password";
import { ConflictError, NotFoundError, ValidationError } from "../utils/errors";
import { createAuditLog } from "./auditService";

const validatePeriod = (startsAt?: string | null, endsAt?: string | null) => {
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

export async function getCommitteeMemberService(userId: string) {
  const member = await findCommitteeMemberRepository(userId);
  if (!member) throw new NotFoundError("Akun panitia tidak ditemukan.");
  return member;
}

export async function createCommitteeMemberService(data: any, actorUserId: string, requestId: string) {
  if (await findUserByEmailRepository(data.email)) throw new ConflictError("Email sudah digunakan oleh akun lain.");
  validatePeriod(data.startsAt, data.endsAt);
  const member = await createCommitteeUserRepository({
    name: data.name,
    email: data.email.trim().toLowerCase(),
    passwordHash: hashPassword(data.password),
    status: data.status,
  });
  let assignment = null;
  if (data.eventId && data.committeeRole) {
    assignment = await upsertCommitteeAssignmentRepository({
      eventId: data.eventId,
      userId: member.id,
      committeeRole: data.committeeRole,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
      createdBy: actorUserId,
    });
  }
  await createAuditLog({
    actorUserId,
    action: "COMMITTEE_MEMBER_CREATED",
    resourceType: "USER",
    resourceId: member.id,
    eventId: data.eventId || null,
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
  const updated = await updateCommitteeUserRepository(userId, {
    ...data,
    ...(data.email && { email: data.email.trim().toLowerCase() }),
    ...(data.password && { passwordHash: hashPassword(data.password) }),
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

export async function getCommitteeContextService(userId: string) {
  const assignments = await findCommitteeAssignmentsForUserRepository(userId);
  return {
    assignments: assignments.map((assignment) => ({
      ...assignment,
      effectivePermissions: ROLE_PERMISSIONS[assignment.committeeRole as RoleCode] || [],
    })),
  };
}
