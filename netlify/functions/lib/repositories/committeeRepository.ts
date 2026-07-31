import { and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { getDbClient } from "../db/client";
import { eventCommitteeAssignments, events, roles, userRoleAssignments, users } from "../db/schema";

export async function findCommitteeDirectoryRepository(filters: {
  search?: string;
  status?: string;
  eventId?: string;
} = {}) {
  const db = getDbClient();
  const conditions = [];
  if (filters.search) {
    const pattern = `%${filters.search.trim()}%`;
    conditions.push(or(ilike(users.name, pattern), ilike(users.email, pattern)));
  }
  if (filters.status) conditions.push(eq(users.status, filters.status));
  if (filters.eventId) conditions.push(eq(eventCommitteeAssignments.eventId, filters.eventId));

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      assignmentId: eventCommitteeAssignments.id,
      eventId: eventCommitteeAssignments.eventId,
      eventName: events.name,
      eventCode: events.code,
      eventStatus: events.status,
      committeeRole: eventCommitteeAssignments.committeeRole,
      permissions: eventCommitteeAssignments.permissions,
      startsAt: eventCommitteeAssignments.startsAt,
      endsAt: eventCommitteeAssignments.endsAt,
    })
    .from(eventCommitteeAssignments)
    .innerJoin(users, eq(eventCommitteeAssignments.userId, users.id))
    .innerJoin(events, eq(eventCommitteeAssignments.eventId, events.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(users.name), desc(events.startDate));

  const grouped = new Map<string, any>();
  for (const row of rows) {
    if (!grouped.has(row.id)) {
      grouped.set(row.id, {
        id: row.id,
        name: row.name,
        email: row.email,
        status: row.status,
        lastLoginAt: row.lastLoginAt,
        createdAt: row.createdAt,
        assignments: [],
      });
    }
    grouped.get(row.id).assignments.push({
      id: row.assignmentId,
      eventId: row.eventId,
      eventName: row.eventName,
      eventCode: row.eventCode,
      eventStatus: row.eventStatus,
      committeeRole: row.committeeRole,
      permissions: row.permissions,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
    });
  }

  if (!filters.eventId) {
    const accountConditions = [
      inArray(roles.code, [
        "EVENT_ADMIN",
        "COMMITTEE_LEAD",
        "REGISTRATION_OFFICER",
        "CHECKIN_OFFICER",
        "INFORMATION_OFFICER",
      ]),
    ];
    if (filters.search) {
      const pattern = `%${filters.search.trim()}%`;
      accountConditions.push(or(ilike(users.name, pattern), ilike(users.email, pattern))!);
    }
    if (filters.status) accountConditions.push(eq(users.status, filters.status));
    const committeeAccounts = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        status: users.status,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .innerJoin(userRoleAssignments, eq(userRoleAssignments.userId, users.id))
      .innerJoin(roles, eq(userRoleAssignments.roleId, roles.id))
      .where(and(...accountConditions))
      .orderBy(asc(users.name));

    for (const account of committeeAccounts) {
      if (!grouped.has(account.id)) grouped.set(account.id, { ...account, assignments: [] });
    }
  }
  return Array.from(grouped.values());
}

export async function findCommitteeMemberRepository(userId: string) {
  const members = await findCommitteeDirectoryRepository();
  return members.find((member) => member.id === userId) || null;
}

export async function findCommitteeAssignmentsForUserRepository(userId: string) {
  const db = getDbClient();
  return db
    .select({
      id: eventCommitteeAssignments.id,
      eventId: eventCommitteeAssignments.eventId,
      eventName: events.name,
      eventCode: events.code,
      eventStatus: events.status,
      startDate: events.startDate,
      endDate: events.endDate,
      venueName: events.venueName,
      invitationResponseDeadline: events.invitationResponseDeadline,
      attendanceConfirmationDeadline: events.attendanceConfirmationDeadline,
      attendanceConfirmationRequired: events.attendanceConfirmationRequired,
      lateConfirmationPolicy: events.lateConfirmationPolicy,
      committeeRole: eventCommitteeAssignments.committeeRole,
      permissions: eventCommitteeAssignments.permissions,
      startsAt: eventCommitteeAssignments.startsAt,
      endsAt: eventCommitteeAssignments.endsAt,
    })
    .from(eventCommitteeAssignments)
    .innerJoin(events, eq(eventCommitteeAssignments.eventId, events.id))
    .where(eq(eventCommitteeAssignments.userId, userId))
    .orderBy(desc(events.startDate));
}

export async function findUserByEmailRepository(email: string) {
  const db = getDbClient();
  const found = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
  return found[0] || null;
}

export async function createCommitteeUserRepository(data: typeof users.$inferInsert) {
  const db = getDbClient();
  const created = await db.insert(users).values(data).returning();
  return created[0];
}

export async function updateCommitteeUserRepository(userId: string, data: Partial<typeof users.$inferInsert>) {
  const db = getDbClient();
  const updated = await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return updated[0] || null;
}

export async function upsertCommitteeAssignmentRepository(data: {
  eventId: string;
  userId: string;
  committeeRole: string;
  startsAt?: Date | null;
  endsAt?: Date | null;
  permissions?: string[] | null;
  createdBy?: string | null;
}) {
  const db = getDbClient();
  const existing = await db
    .select()
    .from(eventCommitteeAssignments)
    .where(and(
      eq(eventCommitteeAssignments.eventId, data.eventId),
      eq(eventCommitteeAssignments.userId, data.userId),
      eq(eventCommitteeAssignments.committeeRole, data.committeeRole)
    ))
    .limit(1);

  const assignment = existing[0]
    ? (await db.update(eventCommitteeAssignments).set({
        startsAt: data.startsAt ?? null,
        endsAt: data.endsAt ?? null,
        permissions: data.permissions ?? null,
      }).where(eq(eventCommitteeAssignments.id, existing[0].id)).returning())[0]
    : (await db.insert(eventCommitteeAssignments).values(data).returning())[0];

  const role = (await db.select().from(roles).where(eq(roles.code, data.committeeRole)).limit(1))[0];
  if (!role) throw new Error(`Role ${data.committeeRole} belum tersedia. Jalankan seed role.`);

  const rbac = await db
    .select()
    .from(userRoleAssignments)
    .where(and(
      eq(userRoleAssignments.userId, data.userId),
      eq(userRoleAssignments.roleId, role.id),
      eq(userRoleAssignments.eventId, data.eventId)
    ))
    .limit(1);

  if (rbac[0]) {
    await db.update(userRoleAssignments).set({
      startsAt: data.startsAt ?? null,
      endsAt: data.endsAt ?? null,
    }).where(eq(userRoleAssignments.id, rbac[0].id));
  } else {
    await db.insert(userRoleAssignments).values({
      userId: data.userId,
      roleId: role.id,
      eventId: data.eventId,
      startsAt: data.startsAt ?? null,
      endsAt: data.endsAt ?? null,
      createdBy: data.createdBy ?? null,
    });
  }
  return assignment;
}

export async function updateCommitteeAssignmentRepository(
  assignmentId: string,
  eventId: string,
  data: { committeeRole?: string; startsAt?: Date | null; endsAt?: Date | null; permissions?: string[] | null }
) {
  const db = getDbClient();
  const existing = (await db.select().from(eventCommitteeAssignments)
    .where(and(eq(eventCommitteeAssignments.id, assignmentId), eq(eventCommitteeAssignments.eventId, eventId))).limit(1))[0];
  if (!existing) return null;

  if (data.committeeRole && data.committeeRole !== existing.committeeRole) {
    const oldRole = (await db.select().from(roles).where(eq(roles.code, existing.committeeRole)).limit(1))[0];
    const newRole = (await db.select().from(roles).where(eq(roles.code, data.committeeRole)).limit(1))[0];
    if (!newRole) throw new Error(`Role ${data.committeeRole} belum tersedia.`);
    if (oldRole) {
      await db.update(userRoleAssignments).set({ roleId: newRole.id })
        .where(and(
          eq(userRoleAssignments.userId, existing.userId),
          eq(userRoleAssignments.roleId, oldRole.id),
          eq(userRoleAssignments.eventId, eventId)
        ));
    }
  }

  const updated = await db.update(eventCommitteeAssignments).set({
    ...(data.committeeRole && { committeeRole: data.committeeRole }),
    ...(data.startsAt !== undefined && { startsAt: data.startsAt }),
    ...(data.endsAt !== undefined && { endsAt: data.endsAt }),
    ...(data.permissions !== undefined && { permissions: data.permissions }),
  }).where(eq(eventCommitteeAssignments.id, assignmentId)).returning();

  const roleCode = data.committeeRole || existing.committeeRole;
  const role = (await db.select().from(roles).where(eq(roles.code, roleCode)).limit(1))[0];
  if (role) {
    await db.update(userRoleAssignments).set({
      ...(data.startsAt !== undefined && { startsAt: data.startsAt }),
      ...(data.endsAt !== undefined && { endsAt: data.endsAt }),
    }).where(and(
      eq(userRoleAssignments.userId, existing.userId),
      eq(userRoleAssignments.roleId, role.id),
      eq(userRoleAssignments.eventId, eventId)
    ));
  }
  return updated[0];
}

export async function endCommitteeAssignmentRepository(assignmentId: string, eventId: string, at = new Date()) {
  const db = getDbClient();
  const existing = (await db.select().from(eventCommitteeAssignments)
    .where(and(eq(eventCommitteeAssignments.id, assignmentId), eq(eventCommitteeAssignments.eventId, eventId))).limit(1))[0];
  if (!existing) return null;
  const updated = await db.update(eventCommitteeAssignments).set({ endsAt: at })
    .where(eq(eventCommitteeAssignments.id, assignmentId)).returning();
  const role = (await db.select().from(roles).where(eq(roles.code, existing.committeeRole)).limit(1))[0];
  if (role) {
    await db.update(userRoleAssignments).set({ endsAt: at }).where(and(
      eq(userRoleAssignments.userId, existing.userId),
      eq(userRoleAssignments.roleId, role.id),
      eq(userRoleAssignments.eventId, eventId)
    ));
  }
  return updated[0];
}
