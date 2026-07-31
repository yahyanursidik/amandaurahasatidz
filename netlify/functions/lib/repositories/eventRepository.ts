import { getDbClient } from "../db/client";
import { events, eventDays, eventSessions, eventCommitteeAssignments, users } from "../db/schema";
import { eq, ilike, and, isNull, count, desc, asc, inArray } from "drizzle-orm";

export async function findEventsRepository(search?: string, status?: string) {
  const db = getDbClient();
  const conditions = [isNull(events.archivedAt)];

  if (search && search.trim() !== "") {
    const pattern = `%${search.trim()}%`;
    conditions.push(ilike(events.name, pattern));
  }

  if (status) {
    conditions.push(eq(events.status, status));
  }

  const result = await db
    .select()
    .from(events)
    .where(and(...conditions))
    .orderBy(desc(events.startDate));

  return result;
}

export async function findEventByIdRepository(id: string) {
  const db = getDbClient();
  const found = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (found.length === 0) return null;

  const days = await db
    .select()
    .from(eventDays)
    .where(eq(eventDays.eventId, id))
    .orderBy(asc(eventDays.dayNumber));

  const sessions = await db
    .select({
      id: eventSessions.id,
      eventDayId: eventSessions.eventDayId,
      title: eventSessions.title,
      sessionType: eventSessions.sessionType,
      speakerUstadzId: eventSessions.speakerUstadzId,
      moderatorName: eventSessions.moderatorName,
      startAt: eventSessions.startAt,
      endAt: eventSessions.endAt,
      room: eventSessions.room,
      attendanceRequired: eventSessions.attendanceRequired,
      checkinRequired: eventSessions.checkinRequired,
      checkinOpenAt: eventSessions.checkinOpenAt,
      checkinCloseAt: eventSessions.checkinCloseAt,
      sortOrder: eventSessions.sortOrder,
    })
    .from(eventSessions)
    .innerJoin(eventDays, eq(eventSessions.eventDayId, eventDays.id))
    .where(eq(eventDays.eventId, id))
    .orderBy(asc(eventSessions.sortOrder));

  const committee = await db
    .select({
      id: eventCommitteeAssignments.id,
      userId: eventCommitteeAssignments.userId,
      userName: users.name,
      userEmail: users.email,
      userStatus: users.status,
      committeeRole: eventCommitteeAssignments.committeeRole,
      permissions: eventCommitteeAssignments.permissions,
      startsAt: eventCommitteeAssignments.startsAt,
      endsAt: eventCommitteeAssignments.endsAt,
    })
    .from(eventCommitteeAssignments)
    .innerJoin(users, eq(eventCommitteeAssignments.userId, users.id))
    .where(eq(eventCommitteeAssignments.eventId, id));

  return {
    ...found[0],
    days,
    sessions,
    committee,
  };
}

export async function findEventBySlugRepository(slug: string) {
  const db = getDbClient();
  const found = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.slug, slug),
        isNull(events.archivedAt),
        inArray(events.status, [
          "PUBLISHED",
          "REGISTRATION_OPEN",
          "REGISTRATION_CLOSED",
          "ONGOING",
          "COMPLETED",
        ])
      )
    )
    .limit(1);
  if (found.length === 0) return null;

  const eventId = found[0].id;
  const days = await db.select().from(eventDays).where(eq(eventDays.eventId, eventId)).orderBy(asc(eventDays.dayNumber));
  const sessions = await db
    .select({
      id: eventSessions.id,
      eventDayId: eventSessions.eventDayId,
      title: eventSessions.title,
      sessionType: eventSessions.sessionType,
      moderatorName: eventSessions.moderatorName,
      startAt: eventSessions.startAt,
      endAt: eventSessions.endAt,
      room: eventSessions.room,
      sortOrder: eventSessions.sortOrder,
    })
    .from(eventSessions)
    .innerJoin(eventDays, eq(eventSessions.eventDayId, eventDays.id))
    .where(eq(eventDays.eventId, eventId))
    .orderBy(asc(eventSessions.startAt), asc(eventSessions.sortOrder));

  return {
    ...found[0],
    days,
    sessions,
  };
}

export async function createEventRepository(data: typeof events.$inferInsert) {
  const db = getDbClient();
  const created = await db.insert(events).values(data).returning();
  return created[0];
}

export async function updateEventRepository(id: string, data: Partial<typeof events.$inferInsert>) {
  const db = getDbClient();

  // Strip status column to prevent arbitrary status mutation in PATCH update!
  const sanitizedData = { ...data };
  delete sanitizedData.status;

  const updated = await db
    .update(events)
    .set({ ...sanitizedData, updatedAt: new Date() })
    .where(eq(events.id, id))
    .returning();

  return updated[0] || null;
}

export async function updateEventStatusRepository(id: string, newStatus: string) {
  const db = getDbClient();
  const updated = await db
    .update(events)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(events.id, id))
    .returning();
  return updated[0] || null;
}

export async function createEventDayRepository(data: typeof eventDays.$inferInsert) {
  const db = getDbClient();
  const created = await db.insert(eventDays).values(data).returning();
  return created[0];
}

export async function createEventSessionRepository(data: typeof eventSessions.$inferInsert) {
  const db = getDbClient();
  const created = await db.insert(eventSessions).values(data).returning();
  return created[0];
}

export async function assignCommitteeRepository(data: typeof eventCommitteeAssignments.$inferInsert) {
  const db = getDbClient();
  const created = await db.insert(eventCommitteeAssignments).values(data).returning();
  return created[0];
}
