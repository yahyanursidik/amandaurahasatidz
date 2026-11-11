import { and, asc, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { getDbClient } from "../db/client";
import { withTransaction } from "../db/transaction";
import { eventCommitteeAssignments, events, roles, userRoleAssignments, users } from "../db/schema";
import { ConflictError, NotFoundError, ValidationError } from "../utils/errors";

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
      eventSlug: events.slug,
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
        globalAccess: false,
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

  {
    const accountConditions = [
      filters.eventId ? and(eq(roles.code, "COMMITTEE_ORGANIZER"), isNull(userRoleAssignments.eventId))! : inArray(roles.code, [
        "EVENT_ADMIN",
        "COMMITTEE_ADMIN",
        "COMMITTEE_ORGANIZER",
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
        roleCode: roles.code,
        roleEventId: userRoleAssignments.eventId,
        roleStartsAt: userRoleAssignments.startsAt,
        roleEndsAt: userRoleAssignments.endsAt,
      })
      .from(users)
      .innerJoin(userRoleAssignments, eq(userRoleAssignments.userId, users.id))
      .innerJoin(roles, eq(userRoleAssignments.roleId, roles.id))
      .where(and(...accountConditions))
      .orderBy(asc(users.name));

    const now = Date.now();
    for (const account of committeeAccounts) {
      const activeGlobalAccess = account.roleCode === "COMMITTEE_ORGANIZER" && !account.roleEventId
        && (!account.roleStartsAt || account.roleStartsAt.getTime() <= now)
        && (!account.roleEndsAt || account.roleEndsAt.getTime() > now);
      if (filters.eventId && !activeGlobalAccess) continue;
      if (!grouped.has(account.id)) grouped.set(account.id, {
        id: account.id, name: account.name, email: account.email, status: account.status,
        lastLoginAt: account.lastLoginAt, createdAt: account.createdAt, assignments: [], globalAccess: false,
      });
      if (activeGlobalAccess) grouped.get(account.id).globalAccess = true;
    }
  }
  return Array.from(grouped.values());
}

/** Minimal staff selector for an event manager; it never exposes other events' assignments. */
export async function findCommitteeCandidatesRepository() {
  return getDbClient().selectDistinct({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .innerJoin(userRoleAssignments, eq(userRoleAssignments.userId, users.id))
    .innerJoin(roles, eq(userRoleAssignments.roleId, roles.id))
    .where(and(eq(users.status, "ACTIVE"), inArray(roles.code, [
      "EVENT_ADMIN", "COMMITTEE_ORGANIZER", "COMMITTEE_ADMIN", "COMMITTEE_LEAD", "REGISTRATION_OFFICER",
      "CHECKIN_OFFICER", "INFORMATION_OFFICER",
    ])))
    .orderBy(asc(users.name), asc(users.email));
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
      eventSlug: events.slug,
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

/** Static role data is provisioned idempotently, so a new assignment works before a manual seed. */
export async function ensureCommitteeRoleRepository(code: string) {
  const db = getDbClient();
  if (code === "COMMITTEE_ADMIN" || code === "COMMITTEE_ORGANIZER") {
    await db.insert(roles).values({ code, name: code === "COMMITTEE_ORGANIZER" ? "Admin Panitia Semua Event" : "Admin Panitia Event",
      description: code === "COMMITTEE_ORGANIZER" ? "Membuat dan mengelola semua event daurah" : "Keputusan peserta pada event yang ditugaskan" })
      .onConflictDoNothing({ target: roles.code });
  }
  const [role] = await db.select().from(roles).where(eq(roles.code, code)).limit(1);
  if (!role) throw new ConflictError(`Peran ${code} belum tersedia pada database.`);
  return role;
}

export async function assertCommitteeEventExistsRepository(eventId: string) {
  const [event] = await getDbClient().select({ id: events.id }).from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) throw new NotFoundError("Event penugasan tidak ditemukan.");
}

export async function createCommitteeMemberWithAssignmentRepository(data: {
  user: typeof users.$inferInsert;
  eventId?: string | null;
  committeeRole: string;
  startsAt?: Date | null;
  endsAt?: Date | null;
  createdBy: string;
}) {
  if (data.eventId) await assertCommitteeEventExistsRepository(data.eventId);
  else if (data.committeeRole !== "COMMITTEE_ORGANIZER") throw new ConflictError("Pilih event untuk peran panitia ini.");
  const role = await ensureCommitteeRoleRepository(data.committeeRole);
  return withTransaction(async (tx) => {
    const [member] = await tx.insert(users).values(data.user).onConflictDoNothing({ target: users.email }).returning();
    if (!member) throw new ConflictError("Email sudah digunakan oleh akun lain.");
    const [assignment] = data.eventId ? await tx.insert(eventCommitteeAssignments).values({
      eventId: data.eventId, userId: member.id, committeeRole: data.committeeRole,
      startsAt: data.startsAt ?? null, endsAt: data.endsAt ?? null, createdBy: data.createdBy,
    }).returning() : [null];
    await tx.insert(userRoleAssignments).values({ userId: member.id, roleId: role.id,
      eventId: data.eventId ?? null, startsAt: data.startsAt ?? null, endsAt: data.endsAt ?? null, createdBy: data.createdBy });
    return { member, assignment };
  });
}

export async function setCommitteeGlobalAccessRepository(userId: string, enabled: boolean, actorUserId: string) {
  const role = await ensureCommitteeRoleRepository("COMMITTEE_ORGANIZER");
  return withTransaction(async (tx) => {
    const [member] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1).for("update");
    if (!member) throw new NotFoundError("Akun panitia tidak ditemukan.");
    const scope = and(eq(userRoleAssignments.userId, userId), eq(userRoleAssignments.roleId, role.id),
      isNull(userRoleAssignments.eventId));
    if (!enabled) {
      await tx.delete(userRoleAssignments).where(scope);
      return false;
    }
    const [existing] = await tx.select().from(userRoleAssignments).where(scope).limit(1);
    if (!existing) await tx.insert(userRoleAssignments).values({ userId, roleId: role.id, createdBy: actorUserId });
    else if (existing.endsAt || existing.startsAt) await tx.update(userRoleAssignments)
      .set({ startsAt: null, endsAt: null }).where(eq(userRoleAssignments.id, existing.id));
    return true;
  });
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
  // Validate both foreign keys before the first assignment write.
  await assertCommitteeEventExistsRepository(data.eventId);
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, data.userId)).limit(1);
  if (!user) throw new NotFoundError("Akun panitia tidak ditemukan.");
  const role = await ensureCommitteeRoleRepository(data.committeeRole);
  return withTransaction(async (tx) => {
    const [existing] = await tx.select().from(eventCommitteeAssignments).where(and(
      eq(eventCommitteeAssignments.eventId, data.eventId),
      eq(eventCommitteeAssignments.userId, data.userId),
      eq(eventCommitteeAssignments.committeeRole, data.committeeRole),
    )).limit(1);
    const [assignment] = existing
      ? await tx.update(eventCommitteeAssignments).set({
          startsAt: data.startsAt ?? null, endsAt: data.endsAt ?? null, permissions: data.permissions ?? null,
        }).where(eq(eventCommitteeAssignments.id, existing.id)).returning()
      : await tx.insert(eventCommitteeAssignments).values(data).returning();
    const [rbac] = await tx.select().from(userRoleAssignments).where(and(
      eq(userRoleAssignments.userId, data.userId), eq(userRoleAssignments.roleId, role.id),
      eq(userRoleAssignments.eventId, data.eventId),
    )).limit(1);
    if (rbac) {
      await tx.update(userRoleAssignments).set({ startsAt: data.startsAt ?? null, endsAt: data.endsAt ?? null })
        .where(eq(userRoleAssignments.id, rbac.id));
    } else {
      await tx.insert(userRoleAssignments).values({ userId: data.userId, roleId: role.id,
        eventId: data.eventId, startsAt: data.startsAt ?? null, endsAt: data.endsAt ?? null,
        createdBy: data.createdBy ?? null });
    }
    return assignment;
  });
}

export async function updateCommitteeAssignmentRepository(
  assignmentId: string,
  eventId: string,
  data: { committeeRole?: string; startsAt?: Date | null; endsAt?: Date | null; permissions?: string[] | null }
) {
  if (data.committeeRole) await ensureCommitteeRoleRepository(data.committeeRole);
  return withTransaction(async (tx) => {
    const [existing] = await tx.select().from(eventCommitteeAssignments).where(and(
      eq(eventCommitteeAssignments.id, assignmentId), eq(eventCommitteeAssignments.eventId, eventId),
    )).limit(1);
    if (!existing) return null;
    const nextRoleCode = data.committeeRole || existing.committeeRole;
    const nextStartsAt = data.startsAt === undefined ? existing.startsAt : data.startsAt;
    const nextEndsAt = data.endsAt === undefined ? existing.endsAt : data.endsAt;
    if (nextStartsAt && nextEndsAt && nextStartsAt >= nextEndsAt) {
      throw new ValidationError("Awal masa tugas harus lebih awal daripada akhir masa tugas.");
    }
    if (nextRoleCode !== existing.committeeRole) {
      const [duplicate] = await tx.select({ id: eventCommitteeAssignments.id }).from(eventCommitteeAssignments)
        .where(and(eq(eventCommitteeAssignments.eventId, eventId), eq(eventCommitteeAssignments.userId, existing.userId),
          eq(eventCommitteeAssignments.committeeRole, nextRoleCode))).limit(1);
      if (duplicate) throw new ConflictError("Akun ini sudah memiliki peran tersebut pada event yang sama.");
    }
    const [newRole] = await tx.select().from(roles).where(eq(roles.code, nextRoleCode)).limit(1);
    if (!newRole) throw new ConflictError(`Peran ${nextRoleCode} belum tersedia pada database.`);
    const [oldRole] = await tx.select().from(roles).where(eq(roles.code, existing.committeeRole)).limit(1);
    const [updated] = await tx.update(eventCommitteeAssignments).set({
      committeeRole: nextRoleCode, startsAt: nextStartsAt, endsAt: nextEndsAt,
      ...(data.permissions !== undefined && { permissions: data.permissions }),
    }).where(eq(eventCommitteeAssignments.id, assignmentId)).returning();
    const [targetRbac] = await tx.select().from(userRoleAssignments).where(and(
      eq(userRoleAssignments.userId, existing.userId), eq(userRoleAssignments.roleId, newRole.id),
      eq(userRoleAssignments.eventId, eventId),
    )).limit(1);
    if (targetRbac) {
      await tx.update(userRoleAssignments).set({ startsAt: nextStartsAt, endsAt: nextEndsAt })
        .where(eq(userRoleAssignments.id, targetRbac.id));
    } else {
      await tx.insert(userRoleAssignments).values({ userId: existing.userId, roleId: newRole.id, eventId,
        startsAt: nextStartsAt, endsAt: nextEndsAt });
    }
    if (oldRole && oldRole.id !== newRole.id) {
      await tx.delete(userRoleAssignments).where(and(eq(userRoleAssignments.userId, existing.userId),
        eq(userRoleAssignments.roleId, oldRole.id), eq(userRoleAssignments.eventId, eventId)));
    }
    return updated;
  });
}

export async function endCommitteeAssignmentRepository(assignmentId: string, eventId: string, at = new Date()) {
  return withTransaction(async (tx) => {
    const [existing] = await tx.select().from(eventCommitteeAssignments).where(and(
      eq(eventCommitteeAssignments.id, assignmentId), eq(eventCommitteeAssignments.eventId, eventId),
    )).limit(1);
    if (!existing) return null;
    const [updated] = await tx.update(eventCommitteeAssignments).set({ endsAt: at })
      .where(eq(eventCommitteeAssignments.id, assignmentId)).returning();
    const [role] = await tx.select().from(roles).where(eq(roles.code, existing.committeeRole)).limit(1);
    if (role) await tx.update(userRoleAssignments).set({ endsAt: at }).where(and(
      eq(userRoleAssignments.userId, existing.userId), eq(userRoleAssignments.roleId, role.id),
      eq(userRoleAssignments.eventId, eventId),
    ));
    return updated;
  });
}
