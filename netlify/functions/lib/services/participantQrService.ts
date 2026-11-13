import { getDbClient } from "../db/client";
import { eventParticipants, ustadzProfiles, institutions, events } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { signParticipantQrToken, verifyParticipantQrToken } from "../utils/token";
import { ConflictError, NotFoundError, ValidationError, ForbiddenError } from "../utils/errors";
import { createAuditLog } from "./auditService";
import { assertParticipantEligibleForCheckin } from "./deadlineService";
import { canDisplayAttendanceQr } from "./participantCardService";
import { isAttendanceQrEventOpen } from "../repositories/attendanceRepository";

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
      approvalStatus: eventParticipants.approvalStatus,
      attendanceConfirmationRequired: events.attendanceConfirmationRequired,
      eventName: events.name,
      eventStatus: events.status,
      endDate: events.endDate,
      timezone: events.timezone,
      archivedAt: events.archivedAt,
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
  if (p.approvalStatus !== "APPROVED") {
    throw new ForbiddenError("QR presensi tersedia setelah data peserta disetujui panitia.");
  }
  if (p.attendanceConfirmationRequired && p.status !== "CONFIRMED") {
    throw new ForbiddenError("Konfirmasikan kehadiran pribadi sebelum membuka QR presensi.");
  }
  const event = { ...p, status: p.eventStatus };
  if (!canDisplayAttendanceQr({ ...p, confirmationStatus: p.status }, event) && !(await isAttendanceQrEventOpen(p.eventId, event))) {
    throw new ForbiddenError("QR presensi tidak tersedia untuk acara ini. Periksa status acara di portal.");
  }

  const issuedAt = p.qrIssuedAt || new Date();
  if (!p.qrIssuedAt) {
    await db
      .update(eventParticipants)
      .set({ qrIssuedAt: issuedAt, updatedAt: issuedAt })
      .where(and(eq(eventParticipants.id, p.id), eq(eventParticipants.qrTokenVersion, p.qrTokenVersion)));
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
  if (normalizedInput.startsWith("qr_tok_")) {
    throw new ValidationError("Format QR lama sudah tidak berlaku. Muat ulang kartu peserta.");
  }
  const signedQr = normalizedInput.startsWith("pqr_");
  let participant = signedQr
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
      institutionName: institutions.name,
    })
    .from(eventParticipants)
    .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
    .leftJoin(institutions, eq(eventParticipants.institutionId, institutions.id))
    .where(
      and(
        eq(eventParticipants.eventId, currentEventId),
        sql`lower(${eventParticipants.participantCode}) = lower(${normalizedInput})`,
      ),
    )
    .limit(1);

  if (signedQr) {
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
        institutionName: institutions.name,
      })
      .from(eventParticipants)
      .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
      .leftJoin(institutions, eq(eventParticipants.institutionId, institutions.id))
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
  }

  if (participant.length === 0) {
    throw new NotFoundError("QR atau kode peserta tidak dikenali pada event ini.");
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
    qrTokenVersion: signedQr ? p.qrTokenVersion : undefined,
    participant: {
      id: p.id,
      eventId: p.eventId,
      participantCode: p.participantCode,
      ustadzName: p.ustadzName,
      institutionName: p.institutionName,
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
  const [current] = await db
    .select({
      eventId: eventParticipants.eventId, participantCode: eventParticipants.participantCode,
      qrTokenVersion: eventParticipants.qrTokenVersion, approvalStatus: eventParticipants.approvalStatus,
      confirmationStatus: eventParticipants.confirmationStatus, attendanceConfirmationRequired: events.attendanceConfirmationRequired,
      status: events.status, endDate: events.endDate, timezone: events.timezone, archivedAt: events.archivedAt,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(events.id, eventParticipants.eventId))
    .where(eq(eventParticipants.id, participantId))
    .limit(1);

  if (!current) throw new NotFoundError(`Peserta ID ${participantId} tidak ditemukan.`);
  if (current.approvalStatus !== "APPROVED" || ["CANCELLED", "REPLACED"].includes(current.confirmationStatus) ||
    (current.attendanceConfirmationRequired && current.confirmationStatus !== "CONFIRMED") ||
    (!canDisplayAttendanceQr(current, current) && !(await isAttendanceQrEventOpen(current.eventId, current)))) {
    throw new ForbiddenError("QR presensi belum tersedia untuk peserta ini.");
  }

  const rotatedAt = new Date();
  const [updated] = await db
    .update(eventParticipants)
    .set({
      qrTokenVersion: sql`${eventParticipants.qrTokenVersion} + 1`,
      qrIssuedAt: rotatedAt,
      qrRotatedAt: rotatedAt,
      updatedAt: rotatedAt,
    })
    .where(and(eq(eventParticipants.id, participantId), eq(eventParticipants.qrTokenVersion, current.qrTokenVersion)))
    .returning();
  if (!updated) throw new ConflictError("Status atau QR peserta berubah. Muat ulang portal sebelum mencoba lagi.");
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
      eventId: current.eventId,
      reason: `Token QR peserta ${current.participantCode} diganti.`,
      requestId,
    });
  }

  return {
    participantId,
    participantCode: current.participantCode,
    newOpaqueQrToken,
    rotatedAt,
  };
}
