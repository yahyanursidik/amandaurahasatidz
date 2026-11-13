import { and, eq } from "drizzle-orm";
import { getDbClient } from "../db/client";
import { eventParticipants, events, ustadzProfiles } from "../db/schema";
import { NotFoundError, ValidationError } from "../utils/errors";
import { isAttendanceEventOpen } from "./attendanceModel";
import { registrationReceiptPath } from "./participantConfirmationLink";
import { getEventRegistrationWhatsAppNumber } from "./participantWhatsAppService";

export async function getParticipantShareService(eventId: string, participantId: string) {
  const db = getDbClient();
  const [participant] = await db.select({
    id: eventParticipants.id,
    eventId: eventParticipants.eventId,
    participantCode: eventParticipants.participantCode,
    approvalStatus: eventParticipants.approvalStatus,
    confirmationStatus: eventParticipants.confirmationStatus,
    fullName: ustadzProfiles.fullName,
    email: ustadzProfiles.email,
    eventName: events.name,
    startDate: events.startDate,
    endDate: events.endDate,
    status: events.status,
    timezone: events.timezone,
    archivedAt: events.archivedAt,
    attendanceConfirmationRequired: events.attendanceConfirmationRequired,
    venueName: events.venueName,
  }).from(eventParticipants)
    .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .where(and(eq(eventParticipants.id, participantId), eq(eventParticipants.eventId, eventId)))
    .limit(1);

  if (!participant) throw new NotFoundError("Peserta tidak ditemukan pada event ini.");
  if (["CANCELLED", "REPLACED", "DECLINED", "REJECTED"].includes(participant.confirmationStatus)
    || ["DECLINED", "REJECTED", "CANCELLED"].includes(participant.approvalStatus)) {
    throw new ValidationError("Pendaftaran tidak aktif. Kode dan QR tidak dapat dibagikan.");
  }

  const eventOpen = isAttendanceEventOpen(participant);
  const registrationStatusUrl = registrationReceiptPath(participant, participant.endDate);
  const whatsapp = await getEventRegistrationWhatsAppNumber(eventId, participantId);
  // The browser resolves this same-origin path; no deployment URL or token enters list responses.
  return {
    participantId: participant.id,
    eventId: participant.eventId,
    participantCode: participant.participantCode,
    fullName: participant.fullName,
    email: participant.email,
    phone: null,
    whatsapp,
    eventName: participant.eventName,
    startDate: participant.startDate,
    endDate: participant.endDate,
    venueName: participant.venueName,
    approvalStatus: participant.approvalStatus,
    confirmationStatus: participant.confirmationStatus,
    attendanceConfirmationRequired: participant.attendanceConfirmationRequired,
    eventOpen,
    registrationStatusUrl,
    qrToken: null,
    cardUrl: null,
    confirmationUrl: null,
  };
}
