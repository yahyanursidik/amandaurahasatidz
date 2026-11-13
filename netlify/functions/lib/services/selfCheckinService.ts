import { DuplicateAttendanceError, recordCheckinTransactionRepository, recordCheckinLogRepository } from "../repositories/attendanceRepository";
import { hashToken } from "../utils/token";
import { AppError, UnauthorizedError } from "../utils/errors";
import { selfCheckinSchema } from "../validations/attendanceValidation";
import { validateRequestData } from "../utils/validator";
import { logError } from "../utils/logger";

export async function processSelfCheckinService(
  input: unknown,
  actorUserId?: string,
  requestId = "req-self-checkin",
) {
  if (!actorUserId) throw new UnauthorizedError("Check-in mandiri memerlukan login peserta.");
  const { eventId, dayId, sessionId, rawLocationQrToken } = validateRequestData(selfCheckinSchema, input);
  try {
    // Scope, account ownership, token validity and eligibility are checked in
    // the same transaction as the write; the client never chooses a participant.
    const record = await recordCheckinTransactionRepository({ eventId, dayId, sessionId,
      locationTokenHash: hashToken(rawLocationQrToken), method: "SELF_SCAN", actorUserId, requestId });
    return { status: "SUCCESS", method: "SELF_SCAN", checkinAt: record.checkinAt,
      participantCode: record.participantCode, attendanceStatus: record.attendanceStatus,
      attendanceUnit: record.attendanceUnit, timezone: record.timezone, attendanceRecordId: record.id };
  } catch (error) {
    if (error instanceof AppError && error.statusCode !== 404) {
      await recordCheckinLogRepository({ eventId, method: "SELF_SCAN", scannedBy: actorUserId, requestId,
        result: error instanceof DuplicateAttendanceError ? "DUPLICATE" : "FAILED", failureReason: error.message,
        metadata: { dayId, sessionId },
      }).catch((logFailure) => logError(requestId, "Log check-in mandiri gagal disimpan", logFailure));
    }
    throw error;
  }
}
