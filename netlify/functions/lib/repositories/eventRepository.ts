import { getDbClient } from "../db/client";
import { events, eventDays, eventSessions, eventCommitteeAssignments, users } from "../db/schema";
import { eq, ilike, and, or, isNull, count, desc, asc, inArray, sql } from "drizzle-orm";

export async function findEventCatalogRepository(query: { page: number; pageSize: number; search: string; status: string }) {
  const db = getDbClient();
  const keyword = query.search.trim();
  const filter = and(
    query.status === "ARCHIVED" ? undefined : isNull(events.archivedAt),
    query.status === "ALL" ? undefined : eq(events.status, query.status),
    keyword ? or(
      ilike(events.name, `%${keyword}%`),
      ilike(events.code, `%${keyword}%`),
      ilike(events.venueName, `%${keyword}%`),
    ) : undefined,
  );
  const [items, [totalRow], statusRows] = await Promise.all([
    db.select({
      id: events.id, code: events.code, slug: events.slug, name: events.name,
      startDate: events.startDate, endDate: events.endDate, timezone: events.timezone,
      venueName: events.venueName,
      // Full data-URI posters can be hundreds of KB each; omit them from the index only.
      posterUrl: sql<string | null>`case when ${events.posterUrl} like 'data:image/%' then null else ${events.posterUrl} end`,
      posterAlt: events.posterAlt, posterFocalPoint: events.posterFocalPoint,
      audienceMode: events.audienceMode, status: events.status,
    }).from(events).where(filter).orderBy(desc(events.startDate), desc(events.createdAt))
      .limit(query.pageSize).offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(events).where(filter),
    db.select({ status: events.status, total: count() }).from(events)
      .where(isNull(events.archivedAt)).groupBy(events.status),
  ]);
  return {
    items,
    total: totalRow?.total || 0,
    page: query.page,
    pageCount: Math.max(1, Math.ceil((totalRow?.total || 0) / query.pageSize)),
    statusCounts: Object.fromEntries(statusRows.map((row) => [row.status, row.total])),
  };
}

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

export async function findPublicEventsRepository() {
  const db = getDbClient();
  return db.select({
    slug: events.slug,
    code: events.code,
    name: events.name,
    subtitle: events.subtitle,
    posterUrl: events.posterUrl,
    posterAlt: events.posterAlt,
    startDate: events.startDate,
    endDate: events.endDate,
    venueName: events.venueName,
    audienceMode: events.audienceMode,
    status: events.status,
  }).from(events).where(and(
    isNull(events.archivedAt),
    inArray(events.status, ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING"]),
  )).orderBy(asc(events.startDate));
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
