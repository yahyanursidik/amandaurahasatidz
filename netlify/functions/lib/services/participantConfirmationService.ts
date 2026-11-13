import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDbClient } from "../db/client";
import { withTransaction } from "../db/transaction";
import { attendanceRecords, eventParticipants, events, participantStatusHistories, ustadzProfiles } from "../db/schema";
import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../utils/errors";
import { participantPrivateLinkBinding, verifyParticipantConfirmationToken, type ParticipantConfirmationPayload } from "../utils/token";
import { createAuditLog } from "./auditService";
import { assertAttendanceConfirmationAllowed } from "./deadlineService";
import { lockRegistrationEvent } from "./registrationCapacity";
import { cardPath, signCardForParticipant } from "./participantCardService";
import { isAttendanceEventOpen } from "./attendanceModel";
import { registrationStage } from "../../../../src/lib/registrationStatus";
import { queueParticipantConfirmationOutcomeEmail } from "./participantCardEmailService";
import { logError } from "../utils/logger";
import { checkRateLimit } from "../utils/rateLimiter";
import { registrationStatusUrl, PRIVATE_REGISTRATION_LINK_MINUTES } from "./participantConfirmationLink";
import { sendImmediateTransactionalTemplate } from "./emailTransport";
import { isAttendanceQrEventOpen } from "../repositories/attendanceRepository";
export { participantConfirmationPath, participantConfirmationUrl, signConfirmationForParticipant } from "./participantConfirmationLink";

export type PublicConfirmationDecision = "CONFIRM" | "DECLINE";

function readToken(token: string) {
  const payload = verifyParticipantConfirmationToken(token);
  if (!payload) throw new ValidationError("Tautan status tidak valid atau sudah kedaluwarsa. Buka Portal Asatidz atau hubungi panitia.");
  return payload;
}

async function hasRecordedCheckin(participantId: string) {
  const [record] = await getDbClient().select({ id: attendanceRecords.id }).from(attendanceRecords)
    .where(and(eq(attendanceRecords.participantId, participantId),
      inArray(attendanceRecords.attendanceStatus, ["PRESENT", "LATE"]))).limit(1);
  return Boolean(record);
}

async function findStatusRegistration(payload: ParticipantConfirmationPayload) {
  const [row] = await getDbClient().select({
    participantId: eventParticipants.id, eventId: eventParticipants.eventId,
    participantCode: eventParticipants.participantCode, qrTokenVersion: eventParticipants.qrTokenVersion,
    qrRotatedAt: eventParticipants.qrRotatedAt, ustadzId: eventParticipants.ustadzId,
    approvalStatus: eventParticipants.approvalStatus, confirmationStatus: eventParticipants.confirmationStatus,
    confirmedAt: eventParticipants.confirmedAt,
    participantName: ustadzProfiles.fullName, email: ustadzProfiles.email,
    profileStatus: ustadzProfiles.profileStatus, deletedAt: ustadzProfiles.deletedAt, mergedIntoId: ustadzProfiles.mergedIntoId,
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
  if (row.profileStatus !== "ACTIVE" || row.deletedAt || row.mergedIntoId) throw new NotFoundError("Pendaftaran tidak ditemukan. Hubungi panitia.");
  return row;
}

function hasPrivateAccess(payload: ParticipantConfirmationPayload, row: { ustadzId: string; email: string | null; qrRotatedAt: Date | null }) {
  return payload.purpose === "PRIVATE_ACCESS" && !!row.email &&
    payload.binding === participantPrivateLinkBinding(row.ustadzId, row.email, row.qrRotatedAt);
}

export async function requestPrivateParticipantAccessService(token: string, email: string, requestId: string) {
  const row = await findStatusRegistration(readToken(token));
  const eligible = ["READY", "AWAITING_CONFIRMATION"].includes(registrationStage(row));
  const activeEvent = { ...row, status: row.eventStatus };
  const canAccess = isAttendanceEventOpen(activeEvent) || (registrationStage(row) === "READY" && await isAttendanceQrEventOpen(row.eventId, activeEvent));
  if (eligible && canAccess && row.email && row.email.trim().toLowerCase() === email.trim().toLowerCase()) {
    if (!checkRateLimit(`participant_private_link_${row.participantId}`, 2, 600_000).allowed) {
      throw new AppError("Tunggu sebelum meminta tautan lain. Periksa email atau masuk ke Portal Asatidz.", 429, "TOO_MANY_REQUESTS");
    }
    const statusLink = registrationStatusUrl({ ...row, id: row.participantId, email: row.email });
    const result = await sendImmediateTransactionalTemplate({ templateCode: "REGISTRATION_STATUS_ACCESS", recipientEmail: row.email,
      recipientName: row.participantName, variables: { ustadzName: row.participantName, eventName: row.eventName,
        registrationStatusLink: statusLink, expiresMinutes: PRIVATE_REGISTRATION_LINK_MINUTES }, requestId });
    if (!result.success) throw new AppError("Email belum dapat dikirim. Coba lagi atau masuk ke Portal Asatidz.", 503, "EMAIL_UNAVAILABLE");
  }
  return { message: "Jika email cocok dengan pendaftaran dan akses sudah tersedia, tautan pribadi dikirim ke email Ustadz. Periksa juga folder spam." };
}

export async function getPublicParticipantConfirmationService(token: string) {
  const payload = readToken(token);
  const row = await findStatusRegistration(payload);
  const privateAccess = hasPrivateAccess(payload, row);
  const activeEvent = { ...row, status: row.eventStatus };
  const decisionsOpen = isAttendanceEventOpen(activeEvent);
  const stage = registrationStage(row);
  const qrEventOpen = stage === "READY" && (decisionsOpen || await isAttendanceQrEventOpen(row.eventId, activeEvent));
  const eventOpen = decisionsOpen || qrEventOpen;
  const approved = row.approvalStatus === "APPROVED";
  const active = !["CANCELLED", "REPLACED"].includes(row.confirmationStatus);
  const deadlinePassed = Boolean(row.attendanceConfirmationDeadline && new Date() > row.attendanceConfirmationDeadline);
  const canConfirm = Boolean(privateAccess && decisionsOpen && approved && active && row.attendanceConfirmationRequired && row.confirmationStatus !== "CONFIRMED" &&
    (!deadlinePassed || row.lateConfirmationPolicy !== "BLOCK"));
  const canDecline = Boolean(privateAccess && decisionsOpen && approved && active && !(await hasRecordedCheckin(row.participantId)));
  const [cancellation] = row.confirmationStatus === "CANCELLED"
    ? await getDbClient().select({ reason: participantStatusHistories.reason }).from(participantStatusHistories)
      .where(and(eq(participantStatusHistories.participantId, row.participantId),
        eq(participantStatusHistories.statusType, "CONFIRMATION_STATUS"), eq(participantStatusHistories.toStatus, "CANCELLED")))
      .orderBy(desc(participantStatusHistories.changedAt), desc(participantStatusHistories.id)).limit(1)
    : [];
  const qrToken = privateAccess && qrEventOpen
    ? signCardForParticipant({ id: row.participantId, eventId: row.eventId, qrTokenVersion: row.qrTokenVersion }) : null;
  return { participantName: row.participantName, participantCode: row.participantCode,
    approvalStatus: row.approvalStatus, confirmationStatus: row.confirmationStatus,
    confirmedAt: row.confirmedAt, eventName: row.eventName, eventSlug: row.eventSlug,
    eventStatus: row.eventStatus, eventOpen, startDate: row.startDate, endDate: row.endDate,
    timezone: row.timezone, venueName: row.venueName, publicContactWhatsapp: row.publicContactWhatsapp,
    attendanceConfirmationRequired: row.attendanceConfirmationRequired,
    attendanceConfirmationDeadline: row.attendanceConfirmationDeadline,
    lateConfirmationPolicy: row.lateConfirmationPolicy,
    privateAccess, canRequestPrivateLink: !privateAccess && eventOpen && approved && active && !!row.email,
    canConfirm, canDecline, stage, qrToken, cardUrl: qrToken ? cardPath(qrToken) : null,
    cancellationKind: cancellation?.reason?.startsWith("Mengundurkan diri melalui tautan pribadi") ? "WITHDRAWN"
      : cancellation?.reason?.startsWith("Berhalangan melalui tautan pribadi") ? "DECLINED" : null };
}

export async function submitPublicParticipantConfirmationService(token: string, decision: PublicConfirmationDecision, requestId: string) {
  const payload = readToken(token);
  if (payload.purpose !== "PRIVATE_ACCESS") throw new ForbiddenError("Buka tautan pribadi terbaru dari email Ustadz untuk mengubah keputusan.");
  if (!["CONFIRM", "DECLINE"].includes(decision)) throw new ValidationError("Pilih konfirmasi hadir atau berhalangan.");
  const outcome = await withTransaction(async (tx) => {
    const event = await lockRegistrationEvent(tx, payload.eventId);
    if (!isAttendanceEventOpen(event)) throw new ConflictError("Konfirmasi tidak tersedia untuk acara ini. Hubungi panitia bila data perlu diperbaiki.");
    const [participant] = await tx.select().from(eventParticipants)
      .where(and(eq(eventParticipants.id, payload.participantId), eq(eventParticipants.eventId, payload.eventId)))
      .limit(1).for("update");
    if (!participant) throw new NotFoundError("Pendaftaran tidak ditemukan.");
    const [profile] = await tx.select({ email: ustadzProfiles.email, status: ustadzProfiles.profileStatus,
      deletedAt: ustadzProfiles.deletedAt, mergedIntoId: ustadzProfiles.mergedIntoId }).from(ustadzProfiles)
      .where(eq(ustadzProfiles.id, participant.ustadzId)).limit(1).for("share");
    if (!profile || profile.status !== "ACTIVE" || profile.deletedAt || profile.mergedIntoId ||
      !hasPrivateAccess(payload, { ...participant, email: profile.email })) {
      throw new ForbiddenError("Akses pribadi telah berubah. Minta tautan baru atau masuk ke Portal Asatidz.");
    }
    if (participant.approvalStatus !== "APPROVED") throw new ConflictError("Tunggu persetujuan admin sebelum mengonfirmasi kehadiran.");
    if (["CANCELLED", "REPLACED"].includes(participant.confirmationStatus)) {
      if (decision === "DECLINE" && participant.confirmationStatus === "CANCELLED") return { changed: false, withdrawn: false, event, participant };
      throw new ConflictError("Pendaftaran sudah tidak aktif. Hubungi panitia bila rencana berubah.");
    }
    if (decision === "CONFIRM" && participant.confirmationStatus === "CONFIRMED") return { changed: false, withdrawn: false, event, participant };
    if (decision === "CONFIRM" && !event.attendanceConfirmationRequired) {
      throw new ConflictError("Acara ini tidak mewajibkan konfirmasi hadir. Lihat kartu presensi pada halaman status.");
    }
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
      confirmationStatus: toStatus, updatedAt: now, qrTokenVersion: sql`${eventParticipants.qrTokenVersion} + 1`, qrIssuedAt: null,
      ...(decision === "CONFIRM" ? { confirmedAt: now, ...(late ? { approvalStatus: "PENDING_REVIEW", approvedAt: null, approvedBy: null } : {}) }
        : { cancelledAt: now }),
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
      queueParticipantConfirmationOutcomeEmail(outcome.event, outcome.participant, outcome.withdrawn ? "WITHDRAW" : decision),
    ]);
    for (const [index, result] of sideEffects.entries()) if (result.status === "rejected") {
      logError(requestId, index === 0 ? "Audit konfirmasi peserta gagal disimpan" : "Email konfirmasi peserta gagal diantrekan", result.reason);
    }
  }
  return getPublicParticipantConfirmationService(token);
}
