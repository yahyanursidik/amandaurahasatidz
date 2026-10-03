import { getDbClient } from "../db/client";
import { eventParticipants, checkinTokens, events, eventSessions, eventDays, ustadzProfiles } from "../db/schema";
import { eq, and, isNull, gt, lte, sql } from "drizzle-orm";
import { recordCheckinTransactionRepository, recordCheckinLogRepository } from "../repositories/attendanceRepository";
import { hashToken } from "../utils/token";
import { NotFoundError, ValidationError, UnauthorizedError } from "../utils/errors";
import { assertParticipantEligibleForCheckin } from "./deadlineService";
import { findOwnPortalProfileRepository, portalProfileOwnership } from "../repositories/portalProfileRepository";
import { selfCheckinSchema } from "../validations/attendanceValidation";
import { validateRequestData } from "../utils/validator";
import { getAttendanceCheckinUnitsService } from "./attendanceService";

// Memory rate limit cache: max 5 requests per minute
const rateLimitCache = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit = 5, windowMs = 60000) {
  const now = Date.now();
  const entry = rateLimitCache.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitCache.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (entry.count >= limit) {
    throw new ValidationError(`Batas percobaan self check-in terlampaui (${limit}x/menit). Silakan tunggu 1 menit.`);
  }

  entry.count++;
}

export async function processSelfCheckinService(
  ustadzId: string,
  eventId: string,
  sessionId: string,
  rawLocationQrToken: string,
  actorUserId?: string,
  requestId = "req-self-checkin"
) {
  // 1. Mandatory Login / Auth Verification (Compliance Point 4)
  if (!ustadzId || !actorUserId) {
    throw new UnauthorizedError("Self check-in memerlukan login peserta.");
  }
  validateRequestData(selfCheckinSchema, { eventId, sessionId, rawLocationQrToken });
  const ownProfile = await findOwnPortalProfileRepository(actorUserId);
  if (ownProfile?.id !== ustadzId) throw new UnauthorizedError("Profil peserta tidak terhubung dengan akun ini.");

  // 2. Rate Limiting Guard (Compliance Point 5)
  checkRateLimit(`self_checkin_${ustadzId}`, 5, 60000);

  const db = getDbClient();

  // 3. Verify Dynamic Location QR Token (Anti-static photo sharing)
  const tokenHash = hashToken(rawLocationQrToken);
  const now = new Date();

  const validToken = await db
    .select()
    .from(checkinTokens)
    .where(
      and(
        eq(checkinTokens.eventId, eventId),
        eq(checkinTokens.eventSessionId, sessionId),
        eq(checkinTokens.tokenHash, tokenHash),
        isNull(checkinTokens.revokedAt),
        lte(checkinTokens.validFrom, now),
        gt(checkinTokens.validUntil, now)
      )
    )
    .limit(1);

  if (validToken.length === 0) {
    await recordCheckinLogRepository({
      eventId,
      method: "SELF_SCAN",
      result: "FAILED",
      failureReason: "Token QR Lokasi kedaluwarsa atau tidak valid.",
      scannedBy: actorUserId,
      requestId,
    });
    throw new ValidationError("Token QR Lokasi telah kedaluwarsa (expired) atau tidak valid. Silakan pindai ulang dari layar lokasi daurah.");
  }

  const sessionRecord = (await db
    .select({ dayId: eventSessions.eventDayId })
    .from(eventSessions)
    .innerJoin(eventDays, eq(eventSessions.eventDayId, eventDays.id))
    .where(and(eq(eventSessions.id, sessionId), eq(eventDays.eventId, eventId)))
    .limit(1))[0];
  if (!sessionRecord) throw new ValidationError("Sesi tidak termasuk dalam event ini.");
  const schedule = await getAttendanceCheckinUnitsService(eventId, now);
  const unit = schedule.units.find((item) => item.sessionId === sessionId);
  if (!unit?.isOpen) throw new ValidationError("Jendela self check-in sesi belum dibuka atau telah ditutup.");

  // 4. Resolve Participant ID for this Ustadz on this Event
  const participant = await db
    .select()
    .from(eventParticipants)
    .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.ustadzId, ustadzId),
      // Recheck ownership in the participant query, not just a cached session/profile ID.
      sql`${eventParticipants.ustadzId} IN (SELECT ${ustadzProfiles.id} FROM ${ustadzProfiles} WHERE ${portalProfileOwnership(actorUserId)})`))
    .limit(1);

  if (participant.length === 0) {
    throw new NotFoundError(`Data kepesertaan Ustadz untuk event ini tidak ditemukan.`);
  }

  const p = participant[0];

  const eventRecord = (await db.select().from(events).where(eq(events.id, eventId)).limit(1))[0];
  if (!eventRecord) throw new NotFoundError("Event check-in tidak ditemukan.");
  assertParticipantEligibleForCheckin(p, eventRecord);

  // 5. Execute Transaction-Safe Check-in with method = SELF_SCAN (Compliance Point 7)
  const record = await recordCheckinTransactionRepository({
    eventId,
    dayId: sessionRecord.dayId,
    sessionId,
    participantId: p.id,
    method: "SELF_SCAN",
    actorUserId,
    requestId,
  });

  return {
    status: "SUCCESS",
    method: "SELF_SCAN",
    checkinAt: record.checkinAt,
    participantCode: p.participantCode,
  };
}
