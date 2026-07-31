import { getDbClient } from "../db/client";
import { checkinTokens, eventSessions } from "../db/schema";
import { eq, and, isNull, gt } from "drizzle-orm";
import { generateSecureToken, hashToken } from "../utils/token";
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
  const now = new Date();

  // 1. Find existing active, non-expired, non-revoked token
  const activeTokens = await db
    .select()
    .from(checkinTokens)
    .where(
      and(
        eq(checkinTokens.eventId, eventId),
        eq(checkinTokens.eventSessionId, sessionId),
        isNull(checkinTokens.revokedAt),
        gt(checkinTokens.validUntil, now)
      )
    )
    .limit(1);

  if (activeTokens.length > 0) {
    const t = activeTokens[0];
    const secondsRemaining = Math.max(0, Math.floor((new Date(t.validUntil).getTime() - now.getTime()) / 1000));

    return {
      tokenId: t.id,
      eventId: t.eventId,
      sessionId: t.eventSessionId || sessionId,
      rawToken: `loc_qr_${t.id.substring(0, 8)}_${t.tokenHash.substring(0, 16)}`,
      validFrom: new Date(t.validFrom),
      validUntil: new Date(t.validUntil),
      secondsRemaining,
    };
  }

  // 2. Generate new dynamic location QR token if expired/absent
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
