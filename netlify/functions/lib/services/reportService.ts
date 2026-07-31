import { getDbClient } from "../db/client";
import {
  invitations,
  institutions,
  eventParticipants,
  ustadzProfiles,
  attendanceRecords,
  invitationResponses,
} from "../db/schema";
import { eq, and, count, desc, sql } from "drizzle-orm";
import { ValidationError } from "../utils/errors";

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
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 15));
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

    case "attendance-daily":
    case "attendance-session": {
      // 4 & 5. Laporan Attendance per Hari & per Sesi
      const totalRes = await db.select({ total: count() }).from(attendanceRecords);
      if (params.eventId) {
        const scopedTotal = await db
          .select({ total: count() })
          .from(attendanceRecords)
          .where(eq(attendanceRecords.eventId, params.eventId));
        totalRes[0] = scopedTotal[0];
      }
      total = totalRes[0]?.total || 0;

      data = await db
        .select({
          id: attendanceRecords.id,
          participantCode: eventParticipants.participantCode,
          ustadzName: ustadzProfiles.fullName,
          status: attendanceRecords.attendanceStatus,
          checkinAt: attendanceRecords.checkinAt,
        })
        .from(attendanceRecords)
        .innerJoin(eventParticipants, eq(attendanceRecords.participantId, eventParticipants.id))
        .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
        .where(params.eventId ? eq(attendanceRecords.eventId, params.eventId) : undefined)
        .orderBy(desc(attendanceRecords.createdAt))
        .limit(pageSize)
        .offset(offset);
      break;
    }

    case "no-show": {
      // 6. Laporan No-Show (Confirmed but absent)
      const totalRes = await db
        .select({ total: count() })
        .from(eventParticipants)
        .where(
          params.eventId
            ? and(
                eq(eventParticipants.confirmationStatus, "CONFIRMED"),
                eq(eventParticipants.eventId, params.eventId)
              )
            : eq(eventParticipants.confirmationStatus, "CONFIRMED")
        );
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
        .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
        .leftJoin(institutions, eq(eventParticipants.institutionId, institutions.id))
        .where(
          params.eventId
            ? and(
                eq(eventParticipants.confirmationStatus, "CONFIRMED"),
                eq(eventParticipants.eventId, params.eventId)
              )
            : eq(eventParticipants.confirmationStatus, "CONFIRMED")
        )
        .limit(pageSize)
        .offset(offset);
      break;
    }

    case "returning-participants": {
      // 7. Laporan Peserta Berulang across events
      const totalRes = await db.select({ total: count() }).from(ustadzProfiles);
      total = totalRes[0]?.total || 0;

      data = await db
        .select({
          ustadzId: ustadzProfiles.id,
          fullName: ustadzProfiles.fullName,
          email: ustadzProfiles.email,
          eventCount: count(eventParticipants.id),
        })
        .from(ustadzProfiles)
        .leftJoin(eventParticipants, eq(ustadzProfiles.id, eventParticipants.ustadzId))
        .groupBy(ustadzProfiles.id, ustadzProfiles.fullName, ustadzProfiles.email)
        .limit(pageSize)
        .offset(offset);
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
