import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDbClient } from "../db/client";
import { withTransaction } from "../db/transaction";
import { attendanceRecords, eventParticipants, events, participantStatusHistories, ustadzProfiles } from "../db/schema";
import { ConflictError, NotFoundError, ValidationError } from "../utils/errors";
import { verifyParticipantConfirmationToken } from "../utils/token";
import { createAuditLog } from "./auditService";
import { assertAttendanceConfirmationAllowed } from "./deadlineService";
import { lockRegistrationEvent } from "./registrationCapacity";
import { cardPath, signCardForParticipant } from "./participantCardService";
import { queueParticipantConfirmationOutcomeEmail } from "./participantCardEmailService";
import { logError } from "../utils/logger";
export { participantConfirmationPath, participantConfirmationUrl, signConfirmationForParticipant } from "./participantConfirmationLink";

export type PublicConfirmationDecision = "CONFIRM" | "DECLINE";

function localEventDate(timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
  }
  catch { return new Date().toISOString().slice(0, 10); }
}

function readToken(token: string) {
  const payload = verifyParticipantConfirmationToken(token);
  if (!payload) throw new ValidationError("Tautan konfirmasi tidak valid atau sudah kedaluwarsa. Mintalah tautan baru kepada panitia.");
  return payload;
}

async function hasRecordedCheckin(participantId: string) {
  const [record] = await getDbClient().select({ id: attendanceRecords.id }).from(attendanceRecords)
    .where(and(eq(attendanceRecords.participantId, participantId),
      inArray(attendanceRecords.attendanceStatus, ["PRESENT", "LATE"]))).limit(1);
  return Boolean(record);
}

export async function getPublicParticipantConfirmationService(token: string) {
  const payload = readToken(token);
  const [row] = await getDbClient().select({
    participantId: eventParticipants.id, eventId: eventParticipants.eventId,
    participantCode: eventParticipants.participantCode, qrTokenVersion: eventParticipants.qrTokenVersion,
    approvalStatus: eventParticipants.approvalStatus, confirmationStatus: eventParticipants.confirmationStatus,
    confirmedAt: eventParticipants.confirmedAt,
    participantName: ustadzProfiles.fullName,
    eventName: events.name, eventSlug: events.slug, eventStatus: events.status,
    startDate: events.startDate, endDate: events.endDate, timezone: events.timezone,
    venueName: events.venueName, publicContactWhatsapp: events.publicContactWhatsapp,
    attendanceConfirmationRequired: events.attendanceConfirmationRequired,
    attendanceConfirmationDeadline: events.attendanceConfirmationDeadline,
    lateConfirmationPolicy: events.lateConfirmationPolicy, archivedAt: events.archivedAt,
  }).from(eventParticipants)
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
    .where(and(eq(eventParticipants.id, payload.participantId), eq(eventParticipants.eventId, payload.eventId))).limit(1);
  if (!row) throw new NotFoundError("Pendaftaran tidak ditemukan. Hubungi panitia.");
  const eventOpen = !row.archivedAt && ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING"].includes(row.eventStatus)
    && row.endDate >= localEventDate(row.timezone);
  const approved = row.approvalStatus === "APPROVED";
  const active = !["CANCELLED", "REPLACED"].includes(row.confirmationStatus);
  const deadlinePassed = Boolean(row.attendanceConfirmationDeadline && new Date() > row.attendanceConfirmationDeadline);
  const canConfirm = Boolean(eventOpen && approved && active && row.confirmationStatus !== "CONFIRMED" &&
    (!deadlinePassed || row.lateConfirmationPolicy !== "BLOCK"));
  const canDecline = Boolean(eventOpen && approved && active && !(await hasRecordedCheckin(row.participantId)));
  const [cancellation] = row.confirmationStatus === "CANCELLED"
    ? await getDbClient().select({ reason: participantStatusHistories.reason }).from(participantStatusHistories)
      .where(and(eq(participantStatusHistories.participantId, row.participantId),
        eq(participantStatusHistories.statusType, "CONFIRMATION_STATUS"), eq(participantStatusHistories.toStatus, "CANCELLED")))
      .orderBy(desc(participantStatusHistories.changedAt), desc(participantStatusHistories.id)).limit(1)
    : [];
  const cardUrl = approved && row.confirmationStatus === "CONFIRMED"
    ? cardPath(signCardForParticipant({ id: row.participantId, eventId: row.eventId, qrTokenVersion: row.qrTokenVersion })) : null;
  return { participantName: row.participantName, participantCode: row.participantCode,
    approvalStatus: row.approvalStatus, confirmationStatus: row.confirmationStatus,
    confirmedAt: row.confirmedAt, eventName: row.eventName, eventSlug: row.eventSlug,
    eventStatus: row.eventStatus, startDate: row.startDate, endDate: row.endDate,
    timezone: row.timezone, venueName: row.venueName, publicContactWhatsapp: row.publicContactWhatsapp,
    attendanceConfirmationRequired: row.attendanceConfirmationRequired,
    attendanceConfirmationDeadline: row.attendanceConfirmationDeadline,
    lateConfirmationPolicy: row.lateConfirmationPolicy,
    canConfirm, canDecline, cardUrl,
    cancellationKind: cancellation?.reason?.startsWith("Mengundurkan diri melalui tautan pribadi") ? "WITHDRAWN"
      : cancellation?.reason?.startsWith("Berhalangan melalui tautan pribadi") ? "DECLINED" : null };
}

export async function submitPublicParticipantConfirmationService(token: string, decision: PublicConfirmationDecision, requestId: string) {
  const payload = readToken(token);
  if (!["CONFIRM", "DECLINE"].includes(decision)) throw new ValidationError("Pilih konfirmasi hadir atau berhalangan.");
  const outcome = await withTransaction(async (tx) => {
    const event = await lockRegistrationEvent(tx, payload.eventId);
    if (!["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING"].includes(event.status)) {
      throw new ConflictError("Konfirmasi belum dibuka untuk acara ini. Hubungi panitia.");
    }
    if (event.endDate < localEventDate(event.timezone)) throw new ConflictError("Acara telah selesai. Hubungi panitia bila data perlu diperbaiki.");
    const [participant] = await tx.select().from(eventParticipants)
      .where(and(eq(eventParticipants.id, payload.participantId), eq(eventParticipants.eventId, payload.eventId)))
      .limit(1).for("update");
    if (!participant) throw new NotFoundError("Pendaftaran tidak ditemukan.");
    if (participant.approvalStatus !== "APPROVED") throw new ConflictError("Tunggu persetujuan admin sebelum mengonfirmasi kehadiran.");
    if (["CANCELLED", "REPLACED"].includes(participant.confirmationStatus)) {
      if (decision === "DECLINE" && participant.confirmationStatus === "CANCELLED") return { changed: false, withdrawn: false, event, participant };
      throw new ConflictError("Pendaftaran sudah tidak aktif. Hubungi panitia bila rencana berubah.");
    }
    if (decision === "CONFIRM" && participant.confirmationStatus === "CONFIRMED") return { changed: false, withdrawn: false, event, participant };
    const withdrawn = decision === "DECLINE" && participant.confirmationStatus === "CONFIRMED";
    if (decision === "DECLINE") {
      const [checkin] = await tx.select({ id: attendanceRecords.id }).from(attendanceRecords)
        .where(and(eq(attendanceRecords.participantId, participant.id),
          inArray(attendanceRecords.attendanceStatus, ["PRESENT", "LATE"]))).limit(1);
      if (checkin) throw new ConflictError("Peserta sudah dicatat hadir. Hubungi panitia untuk koreksi data.");
    }
    const late = decision === "CONFIRM" ? assertAttendanceConfirmationAllowed(event).needsReview : false;
    const now = new Date();
    const toStatus = decision === "CONFIRM" ? "CONFIRMED" : "CANCELLED";
    const [updated] = await tx.update(eventParticipants).set({
      confirmationStatus: toStatus, updatedAt: now,
      ...(decision === "CONFIRM" ? { confirmedAt: now, ...(late ? { approvalStatus: "PENDING_REVIEW", approvedAt: null, approvedBy: null } : {}) }
        : { cancelledAt: now, qrTokenVersion: sql`${eventParticipants.qrTokenVersion} + 1` }),
    }).where(eq(eventParticipants.id, participant.id)).returning();
    await tx.insert(participantStatusHistories).values({ participantId: participant.id, statusType: "CONFIRMATION_STATUS",
      fromStatus: participant.confirmationStatus, toStatus,
      reason: decision === "CONFIRM" ? "Konfirmasi pribadi melalui tautan tanpa login."
        : withdrawn ? "Mengundurkan diri melalui tautan pribadi tanpa login."
          : "Berhalangan melalui tautan pribadi tanpa login." });
    if (late) await tx.insert(participantStatusHistories).values({ participantId: participant.id, statusType: "APPROVAL_STATUS",
      fromStatus: participant.approvalStatus, toStatus: "PENDING_REVIEW", reason: "Konfirmasi melewati tenggat; perlu peninjauan admin." });
    return { changed: true, withdrawn, event, participant: updated };
  });
  if (outcome.changed) {
    const sideEffects = await Promise.allSettled([
      createAuditLog({ actorUserId: null, action: decision === "CONFIRM" ? "PUBLIC_ATTENDANCE_CONFIRMED"
        : outcome.withdrawn ? "PUBLIC_PARTICIPANT_WITHDRAWN" : "PUBLIC_ATTENDANCE_DECLINED",
        resourceType: "EVENT_PARTICIPANT", resourceId: outcome.participant.id, eventId: outcome.event.id,
        afterData: { confirmationStatus: outcome.participant.confirmationStatus, approvalStatus: outcome.participant.approvalStatus }, requestId }),
      queueParticipantConfirmationOutcomeEmail({ id: outcome.event.id, name: outcome.event.name, slug: outcome.event.slug,
        endDate: outcome.event.endDate }, outcome.participant, outcome.withdrawn ? "WITHDRAW" : decision),
    ]);
    for (const [index, result] of sideEffects.entries()) if (result.status === "rejected") {
      logError(requestId, index === 0 ? "Audit konfirmasi peserta gagal disimpan" : "Email konfirmasi peserta gagal diantrekan", result.reason);
    }
  }
  return getPublicParticipantConfirmationService(token);
}
