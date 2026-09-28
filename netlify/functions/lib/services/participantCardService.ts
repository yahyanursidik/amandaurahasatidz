import { getDbClient } from "../db/client";
import { eventParticipants, events, ustadzProfiles } from "../db/schema";
import { and, eq } from "drizzle-orm";
import { signParticipantQrToken, verifyParticipantQrToken } from "../utils/token";
import { NotFoundError, ValidationError } from "../utils/errors";

export function cardPath(token: string) { return `/card?token=${encodeURIComponent(token)}`; }

export function cardPublicUrl(token: string) {
  const base = process.env.APP_URL || process.env.URL || "http://localhost:3000";
  return new URL(cardPath(token), base).toString();
}

export function signCardForParticipant(participant: { id: string; eventId: string; qrTokenVersion: number }) {
  return signParticipantQrToken({ participantId: participant.id, eventId: participant.eventId, version: participant.qrTokenVersion });
}

export async function getPublicParticipantCardService(token: string) {
  const payload = verifyParticipantQrToken(token);
  if (!payload) throw new ValidationError("Tautan kartu QR tidak valid. Minta kartu baru kepada peserta atau panitia.");
  const db = getDbClient();
  const [participant] = await db.select({
    participantCode: eventParticipants.participantCode, qrTokenVersion: eventParticipants.qrTokenVersion,
    approvalStatus: eventParticipants.approvalStatus, confirmationStatus: eventParticipants.confirmationStatus,
    ustadzName: ustadzProfiles.fullName, eventName: events.name,
  }).from(eventParticipants)
    .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .where(and(eq(eventParticipants.id, payload.participantId), eq(eventParticipants.eventId, payload.eventId)))
    .limit(1);
  if (!participant) throw new NotFoundError("Kartu peserta tidak ditemukan.");
  if (participant.qrTokenVersion !== payload.version || participant.approvalStatus !== "APPROVED" ||
    ["CANCELLED", "REPLACED"].includes(participant.confirmationStatus)) {
    throw new ValidationError("Kartu QR peserta sudah tidak aktif. Hubungi panitia.");
  }
  return { ...participant, opaqueQrToken: token };
}
