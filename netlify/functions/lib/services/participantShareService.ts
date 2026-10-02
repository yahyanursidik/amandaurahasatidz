import { and, eq } from "drizzle-orm";
import { getDbClient } from "../db/client";
import { eventParticipants, events, ustadzProfiles } from "../db/schema";
import { NotFoundError, ValidationError } from "../utils/errors";
import { cardPath, signCardForParticipant } from "./participantCardService";

export async function getParticipantShareService(eventId: string, participantId: string) {
  const db = getDbClient();
  const [participant] = await db.select({
    id: eventParticipants.id,
    eventId: eventParticipants.eventId,
    participantCode: eventParticipants.participantCode,
    qrTokenVersion: eventParticipants.qrTokenVersion,
    approvalStatus: eventParticipants.approvalStatus,
    confirmationStatus: eventParticipants.confirmationStatus,
    fullName: ustadzProfiles.fullName,
    email: ustadzProfiles.email,
    phone: ustadzProfiles.phone,
    whatsapp: ustadzProfiles.whatsapp,
    eventName: events.name,
    startDate: events.startDate,
    endDate: events.endDate,
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

  const qrToken = participant.approvalStatus === "APPROVED" ? signCardForParticipant(participant) : null;
  // The browser resolves this same-origin path; no deployment URL or token enters list responses.
  return {
    participantId: participant.id,
    eventId: participant.eventId,
    participantCode: participant.participantCode,
    fullName: participant.fullName,
    email: participant.email,
    phone: participant.phone,
    whatsapp: participant.whatsapp,
    eventName: participant.eventName,
    startDate: participant.startDate,
    endDate: participant.endDate,
    venueName: participant.venueName,
    approvalStatus: participant.approvalStatus,
    confirmationStatus: participant.confirmationStatus,
    qrToken,
    cardUrl: qrToken ? cardPath(qrToken) : null,
  };
}