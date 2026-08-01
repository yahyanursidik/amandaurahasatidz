import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { getDbClient } from "../db/client";
import {
  attendanceRecords,
  eventDays,
  eventParticipants,
  eventSessions,
  events,
  institutions,
  invitations,
  ustadzInstitutionAffiliations,
  ustadzProfiles,
} from "../db/schema";
import { ForbiddenError, NotFoundError } from "../utils/errors";
import { getParticipantQrTokenService } from "./participantQrService";
import { replacePortalDelegationMemberTxRepository } from "../repositories/participantRepository";

export async function resolvePortalUstadzIdService(userId: string, email: string) {
  const db = getDbClient();
  const profiles = await db
    .select({ id: ustadzProfiles.id })
    .from(ustadzProfiles)
    .where(
      or(
        eq(ustadzProfiles.userId, userId),
        eq(ustadzProfiles.email, email.trim().toLowerCase()),
      ),
    )
    .limit(1);

  if (!profiles[0]) {
    throw new NotFoundError(
      "Profil asatidz belum terhubung dengan akun ini. Hubungi admin untuk menghubungkan akun dan data peserta.",
    );
  }

  return profiles[0].id;
}

export async function getPortalOverviewService(userId: string, email: string) {
  const db = getDbClient();
  const ustadzId = await resolvePortalUstadzIdService(userId, email);

  const [profileRows, affiliationRows, participationRows] = await Promise.all([
    db.select().from(ustadzProfiles).where(eq(ustadzProfiles.id, ustadzId)).limit(1),
    db
      .select({
        institutionId: institutions.id,
        institutionName: institutions.name,
        institutionCode: institutions.code,
        position: ustadzInstitutionAffiliations.position,
        isPrimary: ustadzInstitutionAffiliations.isPrimary,
        status: ustadzInstitutionAffiliations.status,
      })
      .from(ustadzInstitutionAffiliations)
      .innerJoin(institutions, eq(ustadzInstitutionAffiliations.institutionId, institutions.id))
      .where(
        and(
          eq(ustadzInstitutionAffiliations.ustadzId, ustadzId),
          eq(ustadzInstitutionAffiliations.status, "ACTIVE"),
        ),
      ),
    db
      .select({
        participantId: eventParticipants.id,
        participantCode: eventParticipants.participantCode,
        registrationSource: eventParticipants.registrationSource,
        invitationId: eventParticipants.invitationId,
        isDelegationLead: eventParticipants.isDelegationLead,
        confirmationStatus: eventParticipants.confirmationStatus,
        approvalStatus: eventParticipants.approvalStatus,
        registeredAt: eventParticipants.createdAt,
        confirmedAt: eventParticipants.confirmedAt,
        institutionId: institutions.id,
        institutionName: institutions.name,
        eventId: events.id,
        eventCode: events.code,
        eventSlug: events.slug,
        eventName: events.name,
        eventSubtitle: events.subtitle,
        eventStatus: events.status,
        posterUrl: events.posterUrl,
        posterAlt: events.posterAlt,
        startDate: events.startDate,
        endDate: events.endDate,
        venueName: events.venueName,
        venueAddress: events.venueAddress,
        mapsUrl: events.mapsUrl,
        invitationResponseDeadline: events.invitationResponseDeadline,
        attendanceConfirmationDeadline: events.attendanceConfirmationDeadline,
      })
      .from(eventParticipants)
      .innerJoin(events, eq(eventParticipants.eventId, events.id))
      .leftJoin(institutions, eq(eventParticipants.institutionId, institutions.id))
      .where(eq(eventParticipants.ustadzId, ustadzId))
      .orderBy(desc(events.startDate)),
  ]);

  const participantIds = participationRows.map((item) => item.participantId);
  const eventIds = participationRows.map((item) => item.eventId);
  const [attendanceRows, sessionRows] = await Promise.all([
    participantIds.length
      ? db
          .select({
            id: attendanceRecords.id,
            participantId: attendanceRecords.participantId,
            attendanceStatus: attendanceRecords.attendanceStatus,
            checkinAt: attendanceRecords.checkinAt,
            checkoutAt: attendanceRecords.checkoutAt,
            checkinMethod: attendanceRecords.checkinMethod,
            sessionId: eventSessions.id,
            sessionTitle: eventSessions.title,
            sessionStartAt: eventSessions.startAt,
          })
          .from(attendanceRecords)
          .leftJoin(eventSessions, eq(attendanceRecords.eventSessionId, eventSessions.id))
          .where(inArray(attendanceRecords.participantId, participantIds))
          .orderBy(desc(attendanceRecords.checkinAt))
      : Promise.resolve([]),
    eventIds.length
      ? db
          .select({
            id: eventSessions.id,
            eventId: eventDays.eventId,
            dayId: eventDays.id,
            dayNumber: eventDays.dayNumber,
            dayDate: eventDays.date,
            dayTitle: eventDays.title,
            title: eventSessions.title,
            sessionType: eventSessions.sessionType,
            startAt: eventSessions.startAt,
            endAt: eventSessions.endAt,
            room: eventSessions.room,
            attendanceRequired: eventSessions.attendanceRequired,
            checkinRequired: eventSessions.checkinRequired,
          })
          .from(eventSessions)
          .innerJoin(eventDays, eq(eventSessions.eventDayId, eventDays.id))
          .where(inArray(eventDays.eventId, eventIds))
          .orderBy(asc(eventSessions.startAt))
      : Promise.resolve([]),
  ]);

  const profile = profileRows[0];
  const primaryAffiliation =
    affiliationRows.find((item) => item.isPrimary) || affiliationRows[0] || null;

  return {
    profile: {
      ...profile,
      affiliations: affiliationRows,
      primaryInstitution: primaryAffiliation,
    },
    participations: participationRows.map((participation) => ({
      ...participation,
      sessions: sessionRows.filter((session) => session.eventId === participation.eventId),
      attendance: attendanceRows.filter(
        (attendance) => attendance.participantId === participation.participantId,
      ),
    })),
  };
}

export async function getPortalDelegationService(
  userId: string,
  email: string,
  actorParticipantId: string,
) {
  const db = getDbClient();
  const ustadzId = await resolvePortalUstadzIdService(userId, email);
  const actorRows = await db
    .select({
      participantId: eventParticipants.id,
      eventId: eventParticipants.eventId,
      invitationId: eventParticipants.invitationId,
      institutionId: eventParticipants.institutionId,
      isDelegationLead: eventParticipants.isDelegationLead,
      confirmationStatus: eventParticipants.confirmationStatus,
      eventName: events.name,
      institutionName: institutions.name,
      quota: invitations.quota,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .leftJoin(institutions, eq(eventParticipants.institutionId, institutions.id))
    .leftJoin(invitations, eq(eventParticipants.invitationId, invitations.id))
    .where(
      and(
        eq(eventParticipants.id, actorParticipantId),
        eq(eventParticipants.ustadzId, ustadzId),
      ),
    )
    .limit(1);
  const actor = actorRows[0];
  if (!actor) throw new NotFoundError("Kepesertaan kepala rombongan tidak ditemukan.");
  if (!actor.isDelegationLead || !actor.invitationId || !actor.institutionId) {
    throw new ForbiddenError("Akun ini bukan kepala rombongan untuk delegasi yang dipilih.");
  }

  const members = await db
    .select({
      participantId: eventParticipants.id,
      participantCode: eventParticipants.participantCode,
      fullName: ustadzProfiles.fullName,
      email: ustadzProfiles.email,
      phone: ustadzProfiles.phone,
      whatsapp: ustadzProfiles.whatsapp,
      address: ustadzProfiles.address,
      isDelegationLead: eventParticipants.isDelegationLead,
      confirmationStatus: eventParticipants.confirmationStatus,
      approvalStatus: eventParticipants.approvalStatus,
      registeredAt: eventParticipants.createdAt,
    })
    .from(eventParticipants)
    .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
    .where(
      and(
        eq(eventParticipants.eventId, actor.eventId),
        eq(eventParticipants.institutionId, actor.institutionId),
        eq(eventParticipants.invitationId, actor.invitationId),
        inArray(eventParticipants.confirmationStatus, ["INVITED", "CONFIRMED", "APPROVED"]),
      ),
    )
    .orderBy(desc(eventParticipants.isDelegationLead), asc(ustadzProfiles.fullName));
  const memberIds = members.map((member) => member.participantId);
  const attendance = memberIds.length
    ? await db
        .select({ participantId: attendanceRecords.participantId })
        .from(attendanceRecords)
        .where(inArray(attendanceRecords.participantId, memberIds))
    : [];
  const checkedInIds = new Set(attendance.map((record) => record.participantId));

  return {
    actorParticipantId: actor.participantId,
    eventId: actor.eventId,
    eventName: actor.eventName,
    institutionId: actor.institutionId,
    institutionName: actor.institutionName,
    quota: actor.quota || members.length,
    members: members.map((member) => ({
      ...member,
      hasCheckedIn: checkedInIds.has(member.participantId),
      canReplace: !member.isDelegationLead && !checkedInIds.has(member.participantId),
    })),
  };
}

export async function replacePortalDelegationMemberService(
  userId: string,
  email: string,
  actorParticipantId: string,
  payload: {
    targetParticipantId: string;
    fullName: string;
    email: string;
    phone?: string | null;
    whatsapp: string;
    address?: string | null;
    reason: string;
  },
  requestId: string,
) {
  const ustadzId = await resolvePortalUstadzIdService(userId, email);
  return replacePortalDelegationMemberTxRepository(
    ustadzId,
    userId,
    actorParticipantId,
    payload,
    requestId,
  );
}

export async function getPortalParticipantIdsService(userId: string, email: string) {
  const db = getDbClient();
  const ustadzId = await resolvePortalUstadzIdService(userId, email);
  const participants = await db
    .select({ id: eventParticipants.id })
    .from(eventParticipants)
    .where(eq(eventParticipants.ustadzId, ustadzId));
  return participants.map((participant) => participant.id);
}

export async function getPortalParticipantQrService(
  userId: string,
  email: string,
  requestedParticipantId?: string,
) {
  const db = getDbClient();
  const ustadzId = await resolvePortalUstadzIdService(userId, email);
  const ownedParticipants = await db
    .select({
      id: eventParticipants.id,
      startDate: events.startDate,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .where(eq(eventParticipants.ustadzId, ustadzId))
    .orderBy(desc(events.startDate));

  const participant = requestedParticipantId
    ? ownedParticipants.find((item) => item.id === requestedParticipantId)
    : ownedParticipants[0];
  if (!participant) {
    throw new NotFoundError("Data kepesertaan untuk QR tidak ditemukan pada akun ini.");
  }

  return getParticipantQrTokenService(participant.id);
}
