import { getDbClient } from "../db/client";
import { events, eventDays, eventSessions, eventCommitteeAssignments, users } from "../db/schema";
import { eq, ilike, and, or, isNull, count, desc, asc, inArray, sql, getTableColumns, ne } from "drizzle-orm";
import { publicPosterUrl, publicProgramColumns } from "./eventReadProjections";
import type { PublicProgramQuery } from "../validations/eventValidation";
import { assertRegistrationQuotaEdit } from "../services/registrationCapacity";

export async function findEventCatalogRepository(query: { page: number; pageSize: number; search: string; status: string }, allowedEventIds: string[] | null = null) {
  const db = getDbClient();
  if (allowedEventIds?.length === 0) return { items: [], total: 0, page: query.page, pageCount: 1, statusCounts: {} };
  const keyword = query.search.trim();
  const filter = and(
    allowedEventIds ? inArray(events.id, allowedEventIds) : undefined,
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
      .where(and(isNull(events.archivedAt), allowedEventIds ? inArray(events.id, allowedEventIds) : undefined)).groupBy(events.status),
  ]);
  return {
    items,
    total: totalRow?.total || 0,
    page: query.page,
    pageCount: Math.max(1, Math.ceil((totalRow?.total || 0) / query.pageSize)),
    statusCounts: Object.fromEntries(statusRows.map((row) => [row.status, row.total])),
  };
}

export async function findEventsRepository(search?: string, status?: string, allowedEventIds: string[] | null = null) {
  if (allowedEventIds?.length === 0) return [];
  const db = getDbClient();
  const conditions = [isNull(events.archivedAt), ...(allowedEventIds ? [inArray(events.id, allowedEventIds)] : [])];

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

/** Small event selectors must not transfer every poster and event description. */
export async function findEventOptionsRepository(allowedEventIds: string[] | null = null) {
  if (allowedEventIds?.length === 0) return [];
  return getDbClient().select({ id: events.id, code: events.code, slug: events.slug, name: events.name, status: events.status,
    startDate: events.startDate, endDate: events.endDate, timezone: events.timezone,
    venueName: events.venueName, venueAddress: events.venueAddress,
    invitationResponseDeadline: events.invitationResponseDeadline,
    attendanceConfirmationDeadline: events.attendanceConfirmationDeadline,
    attendanceConfirmationRequired: events.attendanceConfirmationRequired, lateConfirmationPolicy: events.lateConfirmationPolicy,
  }).from(events).where(and(isNull(events.archivedAt), allowedEventIds ? inArray(events.id, allowedEventIds) : undefined))
    .orderBy(desc(events.startDate), desc(events.id));
}

export async function findPublicEventsRepository() {
  const db = getDbClient();
  return db.select(publicProgramColumns).from(events).where(and(
    isNull(events.archivedAt),
    inArray(events.status, ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING", "COMPLETED"]),
  )).orderBy(asc(events.startDate), asc(events.id)).limit(50);
}

export async function findPublicProgramPageRepository(query: PublicProgramQuery) {
  const db = getDbClient();
  const searchPattern = `%${query.search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
  const visible = and(isNull(events.archivedAt), inArray(events.status,
    ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING", "COMPLETED"]));
  const keyword = query.search ? or(ilike(events.name, searchPattern), ilike(events.code, searchPattern),
    ilike(events.venueName, searchPattern), sql`extract(year from ${events.startDate})::text like ${searchPattern}`) : undefined;
  const where = and(visible, keyword, query.view === "history" ? eq(events.status, "COMPLETED")
    : query.view === "agenda" ? ne(events.status, "COMPLETED") : undefined);
  const priority = sql`case
    when ${events.status} = 'REGISTRATION_OPEN' and (${events.registrationOpenAt} is null or ${events.registrationOpenAt} <= now())
      and (${events.registrationCloseAt} is null or ${events.registrationCloseAt} >= now()) then
      case when ${events.audienceMode} in ('PUBLIC_OPEN','MIXED') and ${events.regularQuota} is distinct from 0 then 0 else 1 end
    when ${events.status} = 'PUBLISHED' or (${events.status} = 'REGISTRATION_OPEN' and ${events.registrationOpenAt} > now()) then 2
    when ${events.status} = 'ONGOING' then 3 when ${events.status} = 'COMPLETED' then 5 else 4 end`;
  const ordering = query.view === "history" ? [desc(events.endDate), desc(events.startDate), desc(events.id)]
    : [asc(priority), sql`case when ${events.status} = 'COMPLETED' then -extract(epoch from ${events.startDate}) else extract(epoch from ${events.startDate}) end`, asc(events.id)];
  const pageSize = query.view === "featured" ? Math.min(query.pageSize, 3) : query.pageSize;
  const [data, [totalRow]] = await Promise.all([
    db.select(publicProgramColumns).from(events).where(where).orderBy(...ordering)
      .limit(pageSize).offset((query.page - 1) * pageSize),
    db.select({ total: count() }).from(events).where(where),
  ]);
  const total = totalRow?.total || 0;
  return { data, meta: { page: query.page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) } };
}

/** Registration controls do not need posters, schedules, or committee accounts. */
export async function findRegistrationEventRepository(id: string) {
  const [event] = await getDbClient().select({ id: events.id, code: events.code, name: events.name, slug: events.slug,
    timezone: events.timezone, startDate: events.startDate, endDate: events.endDate,
    venueName: events.venueName, venueAddress: events.venueAddress, audienceMode: events.audienceMode,
    status: events.status, defaultInstitutionQuota: events.defaultInstitutionQuota,
    invitationResponseDeadline: events.invitationResponseDeadline,
    attendanceConfirmationDeadline: events.attendanceConfirmationDeadline,
    attendanceConfirmationRequired: events.attendanceConfirmationRequired, lateConfirmationPolicy: events.lateConfirmationPolicy,
  }).from(events).where(eq(events.id, id)).limit(1);
  return event || null;
}

export async function findEventByIdRepository(id: string, db = getDbClient()) {
  const found = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (found.length === 0) return null;

  const [days, sessions, committee] = await Promise.all([db
    .select()
    .from(eventDays)
    .where(eq(eventDays.eventId, id))
    .orderBy(asc(eventDays.dayNumber)),
  db
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
    .orderBy(asc(eventSessions.sortOrder)),
  db
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
    .where(eq(eventCommitteeAssignments.eventId, id))]);

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
    .select({ ...getTableColumns(events), posterUrl: publicPosterUrl })
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
  const [days, sessions] = await Promise.all([
    db.select().from(eventDays).where(eq(eventDays.eventId, eventId)).orderBy(asc(eventDays.dayNumber)),
    db
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
    .orderBy(asc(eventSessions.startAt), asc(eventSessions.sortOrder))]);

  return {
    ...found[0],
    days,
    sessions,
  };
}

export async function createEventRepository(data: typeof events.$inferInsert) {
  const [created] = await getDbClient().insert(events).values(data).returning();
  return created;
}

/** The caller holds the event lock used by capacity and attendance writers. */
export async function updateEventRepository(id: string, data: Partial<typeof events.$inferInsert>,
  db: ReturnType<typeof getDbClient>, current: typeof events.$inferSelect) {

  // Strip status column to prevent arbitrary status mutation in PATCH update!
  const sanitizedData = { ...data };
  delete sanitizedData.status;

  if ((["capacity", "regularQuota", "invitationQuota"] as const).some((key) =>
    sanitizedData[key] !== undefined && sanitizedData[key] !== current[key])) {
    await assertRegistrationQuotaEdit(db, { ...current, ...sanitizedData });
  }

  const updated = await db
    .update(events)
    .set({ ...sanitizedData, updatedAt: new Date() })
    .where(eq(events.id, id))
    .returning();

  return updated[0] || null;
}

export async function updateEventStatusRepository(id: string, newStatus: string, db = getDbClient()) {
  const updated = await db
    .update(events)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(events.id, id))
    .returning();
  return updated[0] || null;
}

export async function createEventDayRepository(data: typeof eventDays.$inferInsert, db = getDbClient()) {
  const created = await db.insert(eventDays).values(data).returning();
  return created[0];
}

export async function createEventSessionRepository(data: typeof eventSessions.$inferInsert, db = getDbClient()) {
  const created = await db.insert(eventSessions).values(data).returning();
  return created[0];
}

export async function assignCommitteeRepository(data: typeof eventCommitteeAssignments.$inferInsert) {
  const db = getDbClient();
  const created = await db.insert(eventCommitteeAssignments).values(data).returning();
  return created[0];
}
