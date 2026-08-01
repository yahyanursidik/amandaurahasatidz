import { getDbClient } from "../db/client";
import { withTransaction } from "../db/transaction";
import {
  eventSessions,
  eventDays,
  events,
  attendanceRecords,
  checkinLogs,
  eventParticipants,
  ustadzProfiles,
  institutions,
} from "../db/schema";
import { eq, and, desc, isNull, asc } from "drizzle-orm";

export async function findAttendanceScheduleForEventRepository(eventId: string) {
  const db = getDbClient();
  const event = (await db
    .select({
      id: events.id,
      attendanceMode: events.attendanceMode,
      timezone: events.timezone,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1))[0];
  if (!event) return null;
  const days = await db
    .select()
    .from(eventDays)
    .where(eq(eventDays.eventId, eventId))
    .orderBy(asc(eventDays.dayNumber));
  const sessions = await db
    .select({
      id: eventSessions.id,
      eventDayId: eventSessions.eventDayId,
      title: eventSessions.title,
      startAt: eventSessions.startAt,
      endAt: eventSessions.endAt,
      attendanceRequired: eventSessions.attendanceRequired,
      checkinRequired: eventSessions.checkinRequired,
      checkinOpenAt: eventSessions.checkinOpenAt,
      checkinCloseAt: eventSessions.checkinCloseAt,
    })
    .from(eventSessions)
    .innerJoin(eventDays, eq(eventSessions.eventDayId, eventDays.id))
    .where(eq(eventDays.eventId, eventId))
    .orderBy(asc(eventSessions.startAt));
  return { event, days, sessions };
}

export async function findActiveSessionForEventRepository(eventId: string) {
  const db = getDbClient();
  const sessions = await db
    .select({
      id: eventSessions.id,
      dayId: eventSessions.eventDayId,
      title: eventSessions.title,
      startAt: eventSessions.startAt,
      endAt: eventSessions.endAt,
      checkinOpenAt: eventSessions.checkinOpenAt,
      checkinCloseAt: eventSessions.checkinCloseAt,
    })
    .from(eventSessions)
    .innerJoin(eventDays, eq(eventSessions.eventDayId, eventDays.id))
    .where(eq(eventDays.eventId, eventId))
    .orderBy(eventSessions.startAt);

  const now = new Date();

  // Find session where current time is within checkin window
  const activeWindowSession = sessions.find((s) => {
    const open = s.checkinOpenAt ? new Date(s.checkinOpenAt) : new Date(s.startAt.getTime() - 60 * 60000);
    const close = s.checkinCloseAt ? new Date(s.checkinCloseAt) : new Date(s.endAt.getTime() + 60 * 60000);
    return now >= open && now <= close;
  });

  return activeWindowSession || sessions[0] || null;
}

export async function recordCheckinLogRepository(data: {
  eventId: string;
  participantId?: string | null;
  eventSessionId?: string | null;
  method: string;
  result: "SUCCESS" | "FAILED" | "DUPLICATE";
  failureReason?: string | null;
  scannedBy?: string | null;
  requestId?: string | null;
  metadata?: any;
}) {
  const db = getDbClient();
  return await db.insert(checkinLogs).values({
    eventId: data.eventId,
    participantId: data.participantId || null,
    eventSessionId: data.eventSessionId || null,
    method: data.method,
    result: data.result,
    failureReason: data.failureReason || null,
    scannedBy: data.scannedBy || null,
    requestId: data.requestId || null,
    metadata: data.metadata || null,
  }).returning();
}

export async function recordAttendanceTransactionRepository(data: {
  eventId: string;
  dayId: string;
  sessionId?: string | null;
  participantId: string;
  method: string;
  attendanceStatus?: string;
  notes?: string | null;
  actorUserId?: string;
  requestId?: string;
}) {
  return await withTransaction(async (tx) => {
    const unitCondition = data.sessionId
      ? eq(attendanceRecords.eventSessionId, data.sessionId)
      : and(
          eq(attendanceRecords.eventDayId, data.dayId),
          isNull(attendanceRecords.eventSessionId),
        );
    const existing = await tx
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.eventId, data.eventId),
          eq(attendanceRecords.participantId, data.participantId),
          unitCondition,
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw new Error("DUPLICATE: Peserta sudah memiliki catatan pada unit kehadiran ini.");
    }

    let inserted;
    try {
      inserted = await tx
        .insert(attendanceRecords)
        .values({
          eventId: data.eventId,
          eventDayId: data.dayId,
          eventSessionId: data.sessionId || null,
          participantId: data.participantId,
          attendanceStatus: data.attendanceStatus || "PRESENT",
          checkinAt: new Date(),
          checkinMethod: data.method,
          notes: data.notes || null,
          recordedBy: data.actorUserId || null,
        })
        .returning();
    } catch (error: any) {
      if (error?.code === "23505" || error?.message?.includes("uniq_attendance_part_")) {
        throw new Error("DUPLICATE: Peserta sudah memiliki catatan pada unit kehadiran ini.");
      }
      throw error;
    }

    // 3. Log success
    await tx.insert(checkinLogs).values({
      eventId: data.eventId,
      participantId: data.participantId,
      eventSessionId: data.sessionId || null,
      method: data.method,
      result: "SUCCESS",
      scannedBy: data.actorUserId || null,
      requestId: data.requestId || null,
    });

    return inserted[0];
  });
}

export async function recordCheckinTransactionRepository(data: {
  eventId: string;
  dayId: string;
  sessionId?: string | null;
  participantId: string;
  method: string;
  actorUserId?: string;
  requestId?: string;
}) {
  return recordAttendanceTransactionRepository(data);
}

export async function getRecentCheckinLogsRepository(eventId: string, limitCount = 20) {
  const db = getDbClient();
  return await db
    .select({
      id: checkinLogs.id,
      result: checkinLogs.result,
      method: checkinLogs.method,
      failureReason: checkinLogs.failureReason,
      createdAt: checkinLogs.createdAt,
      participantCode: eventParticipants.participantCode,
      ustadzName: ustadzProfiles.fullName,
      institutionName: institutions.name,
    })
    .from(checkinLogs)
    .leftJoin(eventParticipants, eq(checkinLogs.participantId, eventParticipants.id))
    .leftJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
    .leftJoin(institutions, eq(eventParticipants.institutionId, institutions.id))
    .where(eq(checkinLogs.eventId, eventId))
    .orderBy(desc(checkinLogs.createdAt))
    .limit(limitCount);
}
