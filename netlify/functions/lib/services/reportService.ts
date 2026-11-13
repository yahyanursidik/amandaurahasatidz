import { getDbClient } from "../db/client";
import {
  invitations,
  institutions,
  eventParticipants,
  ustadzProfiles,
  attendanceRecords,
  invitationResponses,
  eventDays,
  eventSessions,
  events,
} from "../db/schema";
import { eq, and, count, countDistinct, desc, sql, isNull, isNotNull, inArray } from "drizzle-orm";
import { ValidationError } from "../utils/errors";
import { eventNoShowCondition } from "../repositories/attendanceRepository";
import { ATTENDED_STATUSES } from "./attendanceModel";

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  eventId?: string;
}

export async function getPaginatedReportService(
  reportType: string,
  params: PaginationParams
) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(1000, Math.max(1, params.pageSize || 15));
  const offset = (page - 1) * pageSize;
  const db = getDbClient();

  let data: any[] = [];
  let total = 0;

  switch (reportType) {
    case "invitations": {
      // 1. Laporan Undangan
      const totalRes = await db
        .select({ total: count() })
        .from(invitations)
        .where(params.eventId ? eq(invitations.eventId, params.eventId) : undefined);
      total = totalRes[0]?.total || 0;

      data = await db
        .select({
          id: invitations.id,
          invitationNumber: invitations.invitationNumber,
          institutionName: institutions.name,
          recipientEmail: institutions.email,
          status: invitations.status,
          sentAt: invitations.sentAt,
        })
        .from(invitations)
        .leftJoin(institutions, eq(invitations.institutionId, institutions.id))
        .where(params.eventId ? eq(invitations.eventId, params.eventId) : undefined)
        .orderBy(desc(invitations.createdAt))
        .limit(pageSize)
        .offset(offset);
      break;
    }

    case "institution-participants": {
      // 2. Laporan Peserta per Lembaga
      const totalRes = await db
        .select({ total: count() })
        .from(eventParticipants)
        .where(params.eventId ? eq(eventParticipants.eventId, params.eventId) : undefined);
      total = totalRes[0]?.total || 0;

      data = await db
        .select({
          institutionId: institutions.id,
          name: institutions.name,
          cityCode: institutions.cityCode,
          provinceCode: institutions.provinceCode,
          delegationCount: count(eventParticipants.id),
        })
        .from(institutions)
        .leftJoin(eventParticipants, eq(institutions.id, eventParticipants.institutionId))
        .where(params.eventId ? eq(eventParticipants.eventId, params.eventId) : undefined)
        .groupBy(institutions.id, institutions.name, institutions.cityCode, institutions.provinceCode)
        .limit(pageSize)
        .offset(offset);
      break;
    }

    case "responses": {
      // 3. Laporan Respons Undangan
      const totalRes = await db
        .select({ total: count() })
        .from(invitationResponses)
        .innerJoin(invitations, eq(invitationResponses.invitationId, invitations.id))
        .where(params.eventId ? eq(invitations.eventId, params.eventId) : undefined);
      total = totalRes[0]?.total || 0;

      data = await db
        .select({
          id: invitationResponses.id,
          invitationId: invitationResponses.invitationId,
          isFinal: invitationResponses.isFinal,
          submittedAt: invitationResponses.submittedAt,
        })
        .from(invitationResponses)
        .innerJoin(invitations, eq(invitationResponses.invitationId, invitations.id))
        .where(params.eventId ? eq(invitations.eventId, params.eventId) : undefined)
        .orderBy(desc(invitationResponses.createdAt))
        .limit(pageSize)
        .offset(offset);
      break;
    }

    case "attendance-daily": {
      const condition = params.eventId
        ? and(eq(attendanceRecords.eventId, params.eventId), isNull(attendanceRecords.eventSessionId))
        : isNull(attendanceRecords.eventSessionId);
      total = (await db.select({ total: count() }).from(attendanceRecords).where(condition))[0]?.total || 0;
      data = await db
        .select({
          id: attendanceRecords.id,
          eventCode: events.code,
          eventName: events.name,
          activityDate: eventDays.date,
          dayNumber: eventDays.dayNumber,
          dayTitle: eventDays.title,
          participantCode: eventParticipants.participantCode,
          ustadzName: ustadzProfiles.fullName,
          institutionName: institutions.name,
          status: attendanceRecords.attendanceStatus,
          checkinAt: attendanceRecords.checkinAt,
          checkinMethod: attendanceRecords.checkinMethod,
          notes: attendanceRecords.notes,
        })
        .from(attendanceRecords)
        .innerJoin(events, eq(attendanceRecords.eventId, events.id))
        .innerJoin(eventDays, eq(attendanceRecords.eventDayId, eventDays.id))
        .innerJoin(eventParticipants, eq(attendanceRecords.participantId, eventParticipants.id))
        .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
        .leftJoin(institutions, eq(eventParticipants.institutionId, institutions.id))
        .where(condition)
        .orderBy(desc(attendanceRecords.createdAt))
        .limit(pageSize)
        .offset(offset);
      break;
    }

    case "attendance-session": {
      const condition = params.eventId
        ? and(eq(attendanceRecords.eventId, params.eventId), isNotNull(attendanceRecords.eventSessionId))
        : isNotNull(attendanceRecords.eventSessionId);
      total = (await db.select({ total: count() }).from(attendanceRecords).where(condition))[0]?.total || 0;
      data = await db
        .select({
          id: attendanceRecords.id,
          eventCode: events.code,
          eventName: events.name,
          activityDate: eventDays.date,
          sessionTitle: eventSessions.title,
          sessionType: eventSessions.sessionType,
          sessionStartAt: eventSessions.startAt,
          room: eventSessions.room,
          participantCode: eventParticipants.participantCode,
          ustadzName: ustadzProfiles.fullName,
          institutionName: institutions.name,
          status: attendanceRecords.attendanceStatus,
          checkinAt: attendanceRecords.checkinAt,
          checkinMethod: attendanceRecords.checkinMethod,
          notes: attendanceRecords.notes,
        })
        .from(attendanceRecords)
        .innerJoin(events, eq(attendanceRecords.eventId, events.id))
        .innerJoin(eventSessions, eq(attendanceRecords.eventSessionId, eventSessions.id))
        .innerJoin(eventDays, eq(eventSessions.eventDayId, eventDays.id))
        .innerJoin(eventParticipants, eq(attendanceRecords.participantId, eventParticipants.id))
        .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
        .leftJoin(institutions, eq(eventParticipants.institutionId, institutions.id))
        .where(condition)
        .orderBy(desc(eventSessions.startAt), desc(attendanceRecords.createdAt))
        .limit(pageSize)
        .offset(offset);
      break;
    }

    case "no-show": {
      const noShowCondition = eventNoShowCondition(params.eventId);
      const totalRes = await db
        .select({ total: count() })
        .from(eventParticipants)
        .innerJoin(events, eq(eventParticipants.eventId, events.id))
        .where(noShowCondition);
      total = totalRes[0]?.total || 0;

      data = await db
        .select({
          participantId: eventParticipants.id,
          participantCode: eventParticipants.participantCode,
          ustadzName: ustadzProfiles.fullName,
          institutionName: institutions.name,
          confirmationStatus: eventParticipants.confirmationStatus,
        })
        .from(eventParticipants)
        .innerJoin(events, eq(eventParticipants.eventId, events.id))
        .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
        .leftJoin(institutions, eq(eventParticipants.institutionId, institutions.id))
        .where(noShowCondition)
        .orderBy(desc(events.endDate), eventParticipants.id)
        .limit(pageSize)
        .offset(offset);
      break;
    }

    case "returning-participants": {
      const returningRows = await db
        .select({
          ustadzId: ustadzProfiles.id,
          fullName: ustadzProfiles.fullName,
          email: ustadzProfiles.email,
          eventCount: countDistinct(eventParticipants.eventId),
          attendanceRecordCount: count(attendanceRecords.id),
          institutionCount: countDistinct(eventParticipants.institutionId),
          institutions: sql<string>`string_agg(distinct coalesce(${institutions.name}, 'Individu'), ', ')`,
          lastAttendanceAt: sql<Date | null>`max(${attendanceRecords.checkinAt})`,
        })
        .from(ustadzProfiles)
        .innerJoin(eventParticipants, eq(ustadzProfiles.id, eventParticipants.ustadzId))
        .innerJoin(attendanceRecords, and(eq(eventParticipants.id, attendanceRecords.participantId),
          eq(eventParticipants.eventId, attendanceRecords.eventId), inArray(attendanceRecords.attendanceStatus, ATTENDED_STATUSES)))
        .leftJoin(institutions, eq(eventParticipants.institutionId, institutions.id))
        .groupBy(ustadzProfiles.id, ustadzProfiles.fullName, ustadzProfiles.email)
        .having(sql`count(distinct ${eventParticipants.eventId}) > 1`)
        .orderBy(desc(countDistinct(eventParticipants.eventId)));
      total = returningRows.length;
      data = returningRows.slice(offset, offset + pageSize);
      break;
    }

    case "demographics": {
      // 8. Laporan Wilayah (Provinsi/Kota)
      const totalRes = await db.select({ total: count() }).from(institutions);
      total = totalRes[0]?.total || 0;

      data = await db
        .select({
          provinceCode: institutions.provinceCode,
          cityCode: institutions.cityCode,
          institutionCount: count(institutions.id),
        })
        .from(institutions)
        .groupBy(institutions.provinceCode, institutions.cityCode)
        .limit(pageSize)
        .offset(offset);
      break;
    }

    default:
      throw new ValidationError(`Jenis laporan '${reportType}' tidak dikenal.`);
  }

  const pageCount = Math.ceil(total / pageSize) || 1;

  return {
    data,
    meta: {
      page,
      pageSize,
      total,
      pageCount,
    },
  };
}
