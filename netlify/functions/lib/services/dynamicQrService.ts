import { getDbClient } from "../db/client";
import { checkinTokens, eventSessions, eventDays } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { generateSecureToken } from "../utils/token";
import { NotFoundError, ValidationError } from "../utils/errors";

export interface LocationQrInfo {
  tokenId: string;
  eventId: string;
  sessionId: string;
  rawToken: string;
  validFrom: Date;
  validUntil: Date;
  secondsRemaining: number;
}

export async function getOrGenerateLocationQrTokenService(
  eventId: string,
  sessionId: string,
  rotationSeconds = 30
): Promise<LocationQrInfo> {
  const db = getDbClient();
  if (!Number.isInteger(rotationSeconds) || rotationSeconds < 5 || rotationSeconds > 120) {
    throw new ValidationError("Masa berlaku QR lokasi harus 5–120 detik.");
  }
  const session = (await db.select({ id: eventSessions.id }).from(eventSessions)
    .innerJoin(eventDays, eq(eventSessions.eventDayId, eventDays.id))
    .where(and(eq(eventSessions.id, sessionId), eq(eventDays.eventId, eventId))).limit(1))[0];
  if (!session) throw new NotFoundError("Sesi tidak termasuk dalam event ini.");

  // A stored hash cannot reconstruct its bearer token. Issue fresh entropy rather
  // than a fabricated token derived from the hash. Previous tokens expire normally.
  const tokenGen = generateSecureToken("loc_qr");
  const validFrom = new Date();
  const validUntil = new Date(Date.now() + rotationSeconds * 1000);

  const inserted = await db
    .insert(checkinTokens)
    .values({
      eventId,
      eventSessionId: sessionId,
      tokenHash: tokenGen.tokenHash,
      validFrom,
      validUntil,
      maxUses: null,
    })
    .returning();

  return {
    tokenId: inserted[0].id,
    eventId,
    sessionId,
    rawToken: tokenGen.rawToken,
    validFrom,
    validUntil,
    secondsRemaining: rotationSeconds,
  };
}

export async function rotateLocationQrTokenService(eventId: string, sessionId: string, actorUserId?: string) {
  const db = getDbClient();

  // Revoke all active tokens for this session
  await db
    .update(checkinTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(checkinTokens.eventId, eventId), eq(checkinTokens.eventSessionId, sessionId)));

  // Issue brand new token
  return await getOrGenerateLocationQrTokenService(eventId, sessionId, 30);
}
