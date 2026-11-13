import { getDbClient } from "../db/client";
import { eventParticipants, events, ustadzProfiles } from "../db/schema";
import { and, eq } from "drizzle-orm";
import { signParticipantQrToken, verifyParticipantQrToken } from "../utils/token";
import { NotFoundError, ValidationError } from "../utils/errors";
import { isAttendanceQrEligible, type RegistrationState } from "../../../../src/lib/registrationStatus";
import { isAttendanceEventOpen } from "./attendanceModel";
import { isAttendanceQrEventOpen } from "../repositories/attendanceRepository";

export function cardPath(token: string) { return `/card?token=${encodeURIComponent(token)}`; }

export function signCardForParticipant(participant: { id: string; eventId: string; qrTokenVersion: number }) {
  return signParticipantQrToken({ participantId: participant.id, eventId: participant.eventId, version: participant.qrTokenVersion });
}

export function canDisplayAttendanceQr(state: RegistrationState, event: Parameters<typeof isAttendanceEventOpen>[0]) {
  return isAttendanceQrEligible(state) && isAttendanceEventOpen(event);
}

export async function getPublicParticipantCardService(token: string) {
  const payload = verifyParticipantQrToken(token);
  if (!payload) throw new ValidationError("Tautan kartu tidak valid. Buka Portal Asatidz atau hubungi panitia.");
  const db = getDbClient();
  const [participant] = await db.select({
    participantCode: eventParticipants.participantCode, qrTokenVersion: eventParticipants.qrTokenVersion,
    approvalStatus: eventParticipants.approvalStatus, confirmationStatus: eventParticipants.confirmationStatus,
    ustadzName: ustadzProfiles.fullName, eventName: events.name, eventSlug: events.slug,
    attendanceConfirmationRequired: events.attendanceConfirmationRequired,
    status: events.status, endDate: events.endDate, timezone: events.timezone, archivedAt: events.archivedAt,
  }).from(eventParticipants)
    .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .where(and(eq(eventParticipants.id, payload.participantId), eq(eventParticipants.eventId, payload.eventId)))
    .limit(1);
  if (!participant) throw new NotFoundError("Kartu peserta tidak ditemukan.");
  if (participant.qrTokenVersion !== payload.version) {
    throw new ValidationError("Tautan kartu lama sudah tidak berlaku. Lihat status melalui tautan terbaru dari panitia atau masuk ke Portal Asatidz.");
  }
  const { qrTokenVersion, archivedAt, endDate, status, timezone, ...receipt } = participant;
  const eventOpen = await isAttendanceQrEventOpen(payload.eventId, participant);
  return { ...receipt, eventOpen, opaqueQrToken: eventOpen && isAttendanceQrEligible(receipt) ? token : null };
}
