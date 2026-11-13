import { withTransaction } from "../db/transaction";
import { checkinTokens } from "../db/schema";
import { eq, and, desc, gt, isNull, sql } from "drizzle-orm";
import { createHmac, randomUUID } from "node:crypto";
import { hashToken } from "../utils/token";
import { ConflictError, NotFoundError, ValidationError } from "../utils/errors";
import { findAttendanceScheduleForEventRepository } from "../repositories/attendanceRepository";
import { buildRequiredAttendanceUnits, CHECKIN_EVENT_STATUSES, findAttendanceUnit, isAttendanceWindowOpen,
  type AttendanceMode, type AttendanceUnitSelection } from "./attendanceModel";
import { createAuditLog } from "./auditService";

export interface LocationQrInfo {
  tokenId: string;
  eventId: string;
  dayId: string | null;
  sessionId: string | null;
  rawToken: string;
  validFrom: Date;
  validUntil: Date;
  secondsRemaining: number;
  validForMs: number;
}

function locationQrSecret() {
  const secret = process.env.LOCATION_QR_SECRET || process.env.PARTICIPANT_QR_SECRET || process.env.SESSION_SECRET ||
    process.env.JWT_SECRET || process.env.AUTH_SECRET || process.env.INVITATION_OTP_SECRET;
  if (!secret && (process.env.APP_ENV === "production" || process.env.CONTEXT === "production")) {
    throw new Error("LOCATION_QR_SECRET atau SESSION_SECRET belum dikonfigurasi.");
  }
  return secret || "fallback_location_qr_secret_for_local_development_2026";
}

function derivedLocationToken(eventId: string, unitId: string, tokenId: string, validFrom: Date, rotate: boolean) {
  const digest = createHmac("sha256", locationQrSecret())
    .update(`location-qr:v1:${eventId}:${unitId}:${tokenId}:${validFrom.getTime()}:${rotate ? "rotate" : "auto"}`).digest("hex");
  const rawToken = `loc_qr_${digest}`;
  return { rawToken, tokenHash: hashToken(rawToken) };
}

export async function getOrGenerateLocationQrTokenService(
  eventId: string,
  selection: AttendanceUnitSelection,
  actorUserId: string,
  rotate = false,
  requestId = "location-qr",
): Promise<LocationQrInfo> {
  const result = await withTransaction(async (tx) => {
    const schedule = await findAttendanceScheduleForEventRepository(eventId, tx, true);
    if (!schedule) throw new NotFoundError("Event tidak ditemukan.");
    const { event } = schedule;
    if (event.archivedAt || !CHECKIN_EVENT_STATUSES.includes(event.status)) {
      throw new ConflictError("QR Lokasi tidak tersedia pada status event ini.");
    }
    const unit = findAttendanceUnit(buildRequiredAttendanceUnits(event.attendanceMode as AttendanceMode,
      schedule.days, schedule.sessions, event.timezone), selection);
    if (!unit) throw new NotFoundError("Hari atau sesi tidak termasuk dalam jadwal presensi event ini.");
    // Serialize issuers only within one unit. A separate screen reuses the
    // existing QR rather than generating a new row or revoking that display.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`daurah:location:${eventId}:${unit.id}`}, 0))`);
    const validFrom = new Date();
    if (!unit.qrEnabled) throw new ValidationError("Unit ini menggunakan pencatatan manual; QR Lokasi tidak tersedia.");
    if (!isAttendanceWindowOpen(unit, validFrom) || unit.endsAt <= validFrom) {
      throw new ValidationError("Jendela check-in belum dibuka atau sudah ditutup.");
    }
    const validUntil = new Date(Math.min(validFrom.getTime() + 30_000, unit.endsAt.getTime()));
    const unitScope = unit.sessionId ? eq(checkinTokens.eventSessionId, unit.sessionId)
      : and(eq(checkinTokens.eventDayId, unit.dayId), isNull(checkinTokens.eventSessionId));
    const tokenScope = and(eq(checkinTokens.eventId, eventId), unitScope, isNull(checkinTokens.revokedAt));
    let reusableId: string | undefined;
    if (rotate) {
      await tx.update(checkinTokens).set({ revokedAt: validFrom }).where(and(tokenScope, gt(checkinTokens.validUntil, validFrom)));
    } else {
      const [latest] = await tx.select().from(checkinTokens).where(tokenScope)
        .orderBy(desc(checkinTokens.validFrom), desc(checkinTokens.id)).limit(1);
      if (latest) {
        const automatic = derivedLocationToken(eventId, unit.id, latest.id, latest.validFrom, false);
        const explicit = derivedLocationToken(eventId, unit.id, latest.id, latest.validFrom, true);
        if (latest.validFrom <= validFrom && latest.validUntil > validFrom && latest.validUntil <= unit.endsAt) {
          const matching = [automatic, explicit].find((candidate) => candidate.tokenHash === latest.tokenHash);
          if (matching) return { tokenId: latest.id, eventId, dayId: unit.sessionId ? null : unit.dayId,
            sessionId: unit.sessionId, rawToken: matching.rawToken, validFrom: latest.validFrom, validUntil: latest.validUntil };
        }
        // Only renew an expired, provably automatic token. Never overwrite old
        // deployment tokens or records tied to a staff rotation audit entry.
        if (latest.validUntil <= validFrom && latest.tokenHash === automatic.tokenHash) reusableId = latest.id;
      }
    }
    const tokenId = reusableId || randomUUID();
    const token = derivedLocationToken(eventId, unit.id, tokenId, validFrom, rotate);
    const period = { tokenHash: token.tokenHash, validFrom, validUntil, createdBy: actorUserId };
    if (reusableId) await tx.update(checkinTokens).set(period).where(eq(checkinTokens.id, reusableId));
    else await tx.insert(checkinTokens).values({ id: tokenId, eventId, eventDayId: unit.dayId,
      eventSessionId: unit.sessionId, ...period });
    return { tokenId, eventId, dayId: unit.sessionId ? null : unit.dayId, sessionId: unit.sessionId,
      rawToken: token.rawToken, validFrom, validUntil };
  });
  if (rotate) await createAuditLog({ actorUserId, action: "LOCATION_QR_ROTATED", resourceType: "CHECKIN_TOKEN",
    resourceId: result.tokenId, eventId, afterData: { dayId: result.dayId, sessionId: result.sessionId }, requestId });
  const validForMs = Math.max(0, result.validUntil.getTime() - Date.now());
  return { ...result, validForMs, secondsRemaining: Math.ceil(validForMs / 1000) };
}
