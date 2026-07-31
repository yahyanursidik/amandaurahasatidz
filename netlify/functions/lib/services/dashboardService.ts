import { getDbClient } from "../db/client";
import {
  events,
  institutions,
  invitationResponses,
  eventParticipants,
  emailJobs,
  attendanceRecords,
  checkinLogs,
} from "../db/schema";
import { eq, and, count, desc, sql, inArray } from "drizzle-orm";

export async function getAdminDashboardMetricsService() {
  const db = getDbClient();

  const activeEventsRes = await db
    .select({ total: count() })
    .from(events)
    .where(inArray(events.status, ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING"]));

  const invitedInstitutionsRes = await db
    .select({ total: count() })
    .from(institutions);

  const responsesRes = await db
    .select({ total: count() })
    .from(invitationResponses);

  const approvedParticipantsRes = await db
    .select({ total: count() })
    .from(eventParticipants)
    .where(eq(eventParticipants.approvalStatus, "APPROVED"));

  const pendingParticipantsRes = await db
    .select({ total: count() })
    .from(eventParticipants)
    .where(eq(eventParticipants.approvalStatus, "PENDING_REVIEW"));

  const totalAttendedRes = await db
    .select({ total: count() })
    .from(attendanceRecords)
    .where(eq(attendanceRecords.attendanceStatus, "PRESENT"));

  const failedEmailsRes = await db
    .select({ total: count() })
    .from(emailJobs)
    .where(eq(emailJobs.status, "DEAD_LETTER"));

  const recentEvents = await db
    .select({
      id: events.id,
      code: events.code,
      name: events.name,
      status: events.status,
      startDate: events.startDate,
      endDate: events.endDate,
    })
    .from(events)
    .where(inArray(events.status, ["DRAFT", "PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING"]))
    .orderBy(desc(events.startDate))
    .limit(4);

  return {
    activeEventsCount: activeEventsRes[0]?.total || 0,
    invitedInstitutionsCount: invitedInstitutionsRes[0]?.total || 0,
    totalResponsesCount: responsesRes[0]?.total || 0,
    approvedParticipantsCount: approvedParticipantsRes[0]?.total || 0,
    pendingParticipantsCount: pendingParticipantsRes[0]?.total || 0,
    totalAttendedCount: totalAttendedRes[0]?.total || 0,
    failedEmailsCount: failedEmailsRes[0]?.total || 0,
    recentEvents,
  };
}

export async function getCommitteeDashboardMetricsService(eventId?: string) {
  const db = getDbClient();
  const participantWhere = eventId ? eq(eventParticipants.eventId, eventId) : undefined;
  const logWhere = (result?: string) => and(
    ...(eventId ? [eq(checkinLogs.eventId, eventId)] : []),
    ...(result ? [eq(checkinLogs.result, result)] : [])
  );

  const totalParticipantsRes = await db
    .select({ total: count() })
    .from(eventParticipants)
    .where(participantWhere);

  const recentCheckins = await db
    .select({
      id: checkinLogs.id,
      result: checkinLogs.result,
      createdAt: checkinLogs.createdAt,
    })
    .from(checkinLogs)
    .where(eventId ? eq(checkinLogs.eventId, eventId) : undefined)
    .orderBy(desc(checkinLogs.createdAt))
    .limit(10);

  const checkinIssuesRes = await db
    .select({ total: count() })
    .from(checkinLogs)
    .where(logWhere("FAILED"));

  const duplicateScansRes = await db
    .select({ total: count() })
    .from(checkinLogs)
    .where(logWhere("DUPLICATE"));

  const noShowParticipantsRes = await db
    .select({ total: count() })
    .from(eventParticipants)
    .where(and(
      ...(eventId ? [eq(eventParticipants.eventId, eventId)] : []),
      eq(eventParticipants.confirmationStatus, "CONFIRMED"),
      sql`not exists (
        select 1 from ${attendanceRecords}
        where ${attendanceRecords.participantId} = ${eventParticipants.id}
          and ${attendanceRecords.attendanceStatus} in ('PRESENT', 'LATE')
      )`
    ));

  return {
    totalParticipantsCount: totalParticipantsRes[0]?.total || 0,
    recentCheckins,
    checkinIssuesCount: checkinIssuesRes[0]?.total || 0,
    duplicateScansCount: duplicateScansRes[0]?.total || 0,
    noShowParticipantsCount: noShowParticipantsRes[0]?.total || 0,
  };
}
