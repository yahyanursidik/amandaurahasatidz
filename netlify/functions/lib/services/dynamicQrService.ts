import { withTransaction } from "../db/transaction";
import { checkinTokens } from "../db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import { generateSecureToken } from "../utils/token";
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
    const validFrom = new Date();
    if (!unit.qrEnabled) throw new ValidationError("Unit ini menggunakan pencatatan manual; QR Lokasi tidak tersedia.");
    if (!isAttendanceWindowOpen(unit, validFrom) || unit.endsAt <= validFrom) {
      throw new ValidationError("Jendela check-in belum dibuka atau sudah ditutup.");
    }
    const validUntil = new Date(Math.min(validFrom.getTime() + 30_000, unit.endsAt.getTime()));
    if (rotate) {
      const unitScope = unit.sessionId ? eq(checkinTokens.eventSessionId, unit.sessionId)
        : and(eq(checkinTokens.eventDayId, unit.dayId), isNull(checkinTokens.eventSessionId));
      await tx.update(checkinTokens).set({ revokedAt: validFrom }).where(and(eq(checkinTokens.eventId, eventId),
        unitScope, isNull(checkinTokens.revokedAt), gt(checkinTokens.validUntil, validFrom)));
    }
    const token = generateSecureToken("loc_qr");
    const [inserted] = await tx.insert(checkinTokens).values({ eventId, eventDayId: unit.dayId,
      eventSessionId: unit.sessionId, tokenHash: token.tokenHash, validFrom, validUntil, createdBy: actorUserId,
    }).returning({ id: checkinTokens.id });
    return { tokenId: inserted.id, eventId, dayId: unit.sessionId ? null : unit.dayId, sessionId: unit.sessionId,
      rawToken: token.rawToken, validFrom, validUntil };
  });
  if (rotate) await createAuditLog({ actorUserId, action: "LOCATION_QR_ROTATED", resourceType: "CHECKIN_TOKEN",
    resourceId: result.tokenId, eventId, afterData: { dayId: result.dayId, sessionId: result.sessionId }, requestId });
  const validForMs = Math.max(0, result.validUntil.getTime() - Date.now());
  return { ...result, validForMs, secondsRemaining: Math.ceil(validForMs / 1000) };
}
