import {
  findActiveSessionForEventRepository,
  recordCheckinLogRepository,
  recordCheckinTransactionRepository,
  getRecentCheckinLogsRepository,
} from "../repositories/attendanceRepository";
import { verifyQrTokenForCheckinService } from "./participantQrService";
import { NotFoundError, ValidationError } from "../utils/errors";

export async function getActiveSessionService(eventId: string) {
  const session = await findActiveSessionForEventRepository(eventId);
  if (!session) {
    throw new NotFoundError(`Sesi aktif untuk Event ID ${eventId} tidak ditemukan.`);
  }

  const now = new Date();
  const open = session.checkinOpenAt ? new Date(session.checkinOpenAt) : new Date(session.startAt.getTime() - 60 * 60000);
  const close = session.checkinCloseAt ? new Date(session.checkinCloseAt) : new Date(session.endAt.getTime() + 60 * 60000);
  const isOpen = now >= open && now <= close;

  return {
    session,
    checkinWindow: {
      isOpen,
      openAt: open,
      closeAt: close,
    },
  };
}

export async function processOnSiteCheckinService(
  eventId: string,
  qrTokenOrCode: string,
  method: string,
  actorUserId?: string,
  requestId = "req-checkin"
) {
  // 1. Resolve active session
  const activeSess = await getActiveSessionService(eventId);
  const { session, checkinWindow } = activeSess;

  // 2. Validate Check-in Window (Compliance Point 6)
  if (!checkinWindow.isOpen) {
    await recordCheckinLogRepository({
      eventId,
      method,
      result: "FAILED",
      failureReason: "Jendela presensi check-in untuk sesi ini belum dibuka atau telah ditutup.",
      scannedBy: actorUserId,
      requestId,
    });
    throw new ValidationError(
      `Jendela presensi check-in untuk sesi '${session.title}' belum dibuka atau telah ditutup.`
    );
  }

  // 3. Verify QR Token or Fallback Code with Event Scope & Status Guards
  let verified;
  try {
    verified = await verifyQrTokenForCheckinService(eventId, qrTokenOrCode, actorUserId, requestId);
  } catch (err: any) {
    await recordCheckinLogRepository({
      eventId,
      method,
      result: "FAILED",
      failureReason: err.message || "Token QR atau Kode tidak valid",
      scannedBy: actorUserId,
      requestId,
    });
    throw err;
  }

  const participant = verified.participant;

  // 4. Execute Transaction-Safe Check-in with Duplicate Scan Prevention
  try {
    const record = await recordCheckinTransactionRepository({
      eventId,
      sessionId: session.id,
      participantId: participant.id,
      method,
      actorUserId,
      requestId,
    });

    return {
      status: "SUCCESS",
      checkinAt: record.checkinAt,
      participant: {
        id: participant.id,
        participantCode: participant.participantCode,
        ustadzName: participant.ustadzName,
        confirmationStatus: participant.confirmationStatus,
      },
      sessionTitle: session.title,
    };
  } catch (err: any) {
    const isDuplicate = err.message?.includes("DUPLICATE");
    const resultType = isDuplicate ? "DUPLICATE" : "FAILED";

    await recordCheckinLogRepository({
      eventId,
      participantId: participant.id,
      eventSessionId: session.id,
      method,
      result: resultType,
      failureReason: err.message,
      scannedBy: actorUserId,
      requestId,
    });

    if (isDuplicate) {
      throw new ValidationError(
        `Presensi ganda ditolak: Peserta ${participant.participantCode} (${participant.ustadzName}) sudah pernah melakukan check-in pada sesi '${session.title}'.`
      );
    }

    throw err;
  }
}

export async function getRecentCheckinLogsService(eventId: string, limitCount = 20) {
  return await getRecentCheckinLogsRepository(eventId, limitCount);
}
