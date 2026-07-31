import { getDbClient } from "../db/client";
import { withTransaction } from "../db/transaction";
import {
  eventSessions,
  eventDays,
  attendanceRecords,
  checkinLogs,
  eventParticipants,
  ustadzProfiles,
  institutions,
} from "../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

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

export async function recordCheckinTransactionRepository(data: {
  eventId: string;
  sessionId: string;
  participantId: string;
  method: string;
  actorUserId?: string;
  requestId?: string;
}) {
  return await withTransaction(async (tx) => {
    // 1. Duplicate check within transaction
    const existing = await tx
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.eventId, data.eventId),
          eq(attendanceRecords.eventSessionId, data.sessionId),
          eq(attendanceRecords.participantId, data.participantId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`DUPLICATE: Peserta sudah pernah melakukan presensi check-in pada sesi ini.`);
    }

    // 2. Insert attendance record
    const inserted = await tx
      .insert(attendanceRecords)
      .values({
        eventId: data.eventId,
        eventSessionId: data.sessionId,
        participantId: data.participantId,
        attendanceStatus: "PRESENT",
        checkinAt: new Date(),
        checkinMethod: data.method,
        recordedBy: data.actorUserId || null,
      })
      .returning();

    // 3. Log success
    await tx.insert(checkinLogs).values({
      eventId: data.eventId,
      participantId: data.participantId,
      eventSessionId: data.sessionId,
      method: data.method,
      result: "SUCCESS",
      scannedBy: data.actorUserId || null,
      requestId: data.requestId || null,
    });

    return inserted[0];
  });
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
