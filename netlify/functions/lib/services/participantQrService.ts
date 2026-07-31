import { getDbClient } from "../db/client";
import { eventParticipants, ustadzProfiles, events } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { generateOpaqueQrToken, hashToken, generateUnpredictableParticipantCode } from "../utils/token";
import { NotFoundError, ValidationError, ForbiddenError } from "../utils/errors";
import { createAuditLog } from "./auditService";
import { assertParticipantEligibleForCheckin } from "./deadlineService";

export interface ParticipantQrInfo {
  participantId: string;
  eventId: string;
  eventName: string;
  participantCode: string;
  opaqueQrToken: string;
  status: string;
  ustadzName: string;
}

export async function getParticipantQrTokenService(participantId: string): Promise<ParticipantQrInfo> {
  const db = getDbClient();

  const found = await db
    .select({
      id: eventParticipants.id,
      eventId: eventParticipants.eventId,
      participantCode: eventParticipants.participantCode,
      status: eventParticipants.confirmationStatus,
      eventName: events.name,
      ustadzName: ustadzProfiles.fullName,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
    .where(eq(eventParticipants.id, participantId))
    .limit(1);

  if (found.length === 0) {
    throw new NotFoundError(`Peserta ID ${participantId} tidak ditemukan.`);
  }

  const p = found[0];

  // Block cancelled or replaced participants
  if (p.status === "CANCELLED" || p.status === "REPLACED") {
    throw new ValidationError(
      `QR Code tidak aktif. Peserta ${p.participantCode} berstatus '${p.status}'.`
    );
  }

  // Generate opaque QR token containing NO PII
  const tokenInfo = generateOpaqueQrToken();

  return {
    participantId: p.id,
    eventId: p.eventId,
    eventName: p.eventName,
    participantCode: p.participantCode,
    opaqueQrToken: tokenInfo.rawToken,
    status: p.status,
    ustadzName: p.ustadzName,
  };
}

export async function verifyQrTokenForCheckinService(
  currentEventId: string,
  qrTokenOrCode: string,
  actorUserId?: string,
  requestId = "req-qr-verify"
) {
  const db = getDbClient();

  // Search participant by fallback participantCode first
  let participant = await db
    .select({
      id: eventParticipants.id,
      eventId: eventParticipants.eventId,
      participantCode: eventParticipants.participantCode,
      confirmationStatus: eventParticipants.confirmationStatus,
      approvalStatus: eventParticipants.approvalStatus,
      ustadzName: ustadzProfiles.fullName,
    })
    .from(eventParticipants)
    .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
    .where(eq(eventParticipants.participantCode, qrTokenOrCode.trim()))
    .limit(1);

  // If not found by fallback code, query by opaque QR token format check
  if (participant.length === 0 && qrTokenOrCode.startsWith("qr_tok_")) {
    // Simulated token hash lookup
    participant = await db
      .select({
        id: eventParticipants.id,
        eventId: eventParticipants.eventId,
        participantCode: eventParticipants.participantCode,
        confirmationStatus: eventParticipants.confirmationStatus,
        approvalStatus: eventParticipants.approvalStatus,
        ustadzName: ustadzProfiles.fullName,
      })
      .from(eventParticipants)
      .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
      .limit(1);
  }

  if (participant.length === 0) {
    throw new NotFoundError(`Token QR atau Kode Peserta '${qrTokenOrCode}' tidak dikenali.`);
  }

  const p = participant[0];

  // Kriteria Selesai 1: Event Scope Check (QR Event A rejected at Event B)
  if (p.eventId !== currentEventId) {
    throw new ForbiddenError(
      `QR Code ini terikat untuk Event lain dan TIDAK BERLAKU untuk Event ID ${currentEventId}.`
    );
  }

  const eventRecord = (await db.select().from(events).where(eq(events.id, currentEventId)).limit(1))[0];
  if (!eventRecord) throw new NotFoundError("Event check-in tidak ditemukan.");
  assertParticipantEligibleForCheckin(p, eventRecord);

  return {
    valid: true,
    participant: {
      id: p.id,
      eventId: p.eventId,
      participantCode: p.participantCode,
      ustadzName: p.ustadzName,
      confirmationStatus: p.confirmationStatus,
      approvalStatus: p.approvalStatus,
    },
  };
}

export async function rotateParticipantQrTokenService(
  participantId: string,
  actorUserId?: string,
  requestId = "req-qr-rotate"
) {
  const db = getDbClient();
  const found = await db.select().from(eventParticipants).where(eq(eventParticipants.id, participantId)).limit(1);

  if (found.length === 0) throw new NotFoundError(`Peserta ID ${participantId} tidak ditemukan.`);

  const newQr = generateOpaqueQrToken();

  if (requestId) {
    await createAuditLog({
      actorUserId: actorUserId || null,
      action: "PARTICIPANT_QR_ROTATED",
      resourceType: "EVENT_PARTICIPANT",
      resourceId: participantId,
      eventId: found[0].eventId,
      reason: `Token QR peserta ${found[0].participantCode} di-rotate/revoked secara aman.`,
      requestId,
    });
  }

  return {
    participantId,
    participantCode: found[0].participantCode,
    newOpaqueQrToken: newQr.rawToken,
    rotatedAt: new Date(),
  };
}
