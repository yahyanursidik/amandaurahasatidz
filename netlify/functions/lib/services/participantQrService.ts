import { getDbClient } from "../db/client";
import { eventParticipants, ustadzProfiles, events } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { signParticipantQrToken, verifyParticipantQrToken } from "../utils/token";
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
      qrTokenVersion: eventParticipants.qrTokenVersion,
      qrIssuedAt: eventParticipants.qrIssuedAt,
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

  const issuedAt = p.qrIssuedAt || new Date();
  if (!p.qrIssuedAt) {
    await db
      .update(eventParticipants)
      .set({ qrIssuedAt: issuedAt, updatedAt: issuedAt })
      .where(eq(eventParticipants.id, p.id));
  }
  const opaqueQrToken = signParticipantQrToken({
    participantId: p.id,
    eventId: p.eventId,
    version: p.qrTokenVersion,
  });

  return {
    participantId: p.id,
    eventId: p.eventId,
    eventName: p.eventName,
    participantCode: p.participantCode,
    opaqueQrToken,
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

  const normalizedInput = qrTokenOrCode.trim();
  let participant = normalizedInput.startsWith("pqr_")
    ? []
    : await db
    .select({
      id: eventParticipants.id,
      eventId: eventParticipants.eventId,
      participantCode: eventParticipants.participantCode,
      qrTokenVersion: eventParticipants.qrTokenVersion,
      confirmationStatus: eventParticipants.confirmationStatus,
      approvalStatus: eventParticipants.approvalStatus,
      ustadzName: ustadzProfiles.fullName,
    })
    .from(eventParticipants)
    .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
    .where(
      and(
        eq(eventParticipants.eventId, currentEventId),
        eq(eventParticipants.participantCode, normalizedInput),
      ),
    )
    .limit(1);

  if (normalizedInput.startsWith("pqr_")) {
    const payload = verifyParticipantQrToken(normalizedInput);
    if (!payload) throw new ValidationError("Token QR peserta tidak valid atau telah dimodifikasi.");
    if (payload.eventId !== currentEventId) {
      throw new ForbiddenError("QR peserta ini terikat pada event lain.");
    }
    participant = await db
      .select({
        id: eventParticipants.id,
        eventId: eventParticipants.eventId,
        participantCode: eventParticipants.participantCode,
        qrTokenVersion: eventParticipants.qrTokenVersion,
        confirmationStatus: eventParticipants.confirmationStatus,
        approvalStatus: eventParticipants.approvalStatus,
        ustadzName: ustadzProfiles.fullName,
      })
      .from(eventParticipants)
      .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
      .where(
        and(
          eq(eventParticipants.id, payload.participantId),
          eq(eventParticipants.eventId, payload.eventId),
        ),
      )
      .limit(1);
    if (participant[0] && participant[0].qrTokenVersion !== payload.version) {
      throw new ValidationError("Token QR peserta sudah dirotasi dan tidak berlaku lagi.");
    }
  } else if (normalizedInput.startsWith("qr_tok_")) {
    throw new ValidationError("Format QR lama sudah tidak berlaku. Muat ulang kartu peserta.");
  }

  if (participant.length === 0) {
    throw new NotFoundError(`Token QR atau Kode Peserta '${normalizedInput}' tidak dikenali.`);
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
  const found = await db
    .select()
    .from(eventParticipants)
    .where(eq(eventParticipants.id, participantId))
    .limit(1);

  if (found.length === 0) throw new NotFoundError(`Peserta ID ${participantId} tidak ditemukan.`);

  const rotatedAt = new Date();
  const nextVersion = found[0].qrTokenVersion + 1;
  const updatedRows = await db
    .update(eventParticipants)
    .set({
      qrTokenVersion: nextVersion,
      qrIssuedAt: rotatedAt,
      qrRotatedAt: rotatedAt,
      updatedAt: rotatedAt,
    })
    .where(eq(eventParticipants.id, participantId))
    .returning();
  const updated = updatedRows[0];
  const newOpaqueQrToken = signParticipantQrToken({
    participantId: updated.id,
    eventId: updated.eventId,
    version: updated.qrTokenVersion,
  });

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
    newOpaqueQrToken,
    rotatedAt,
  };
}
