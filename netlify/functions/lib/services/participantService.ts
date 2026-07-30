import {
  findParticipantsRepository,
  findParticipantByIdRepository,
  countInstitutionParticipantsRepository,
  updateParticipantStatusRepository,
  replaceParticipantTxRepository,
} from "../repositories/participantRepository";
import { findDuplicateCandidatesRepository } from "../repositories/ustadzRepository";
import { NotFoundError, ValidationError } from "../utils/errors";
import { createAuditLog } from "./auditService";

export async function getParticipantsService(eventId: string) {
  return await findParticipantsRepository(eventId);
}

export async function searchExistingUstadzProfilesService(fullName: string, email?: string, phone?: string) {
  return await findDuplicateCandidatesRepository(fullName, email, phone);
}

export async function checkQuotaAvailableService(eventId: string, institutionId: string, maxQuota: number, requestedAddCount: number) {
  const currentCount = await countInstitutionParticipantsRepository(eventId, institutionId);
  const remainingQuota = maxQuota - currentCount;

  if (requestedAddCount > remainingQuota) {
    throw new ValidationError(
      `Sisa kuota pendaftaran lembaga Anda adalah ${remainingQuota} peserta. Tidak dapat menambah ${requestedAddCount} peserta.`
    );
  }

  return { currentCount, remainingQuota };
}

export async function updateParticipantStatusService(
  participantId: string,
  toStatus: string,
  reason?: string,
  actorUserId?: string,
  requestId?: string
) {
  const existing = await findParticipantByIdRepository(participantId);
  if (!existing) throw new NotFoundError(`Peserta ID ${participantId} tidak ditemukan.`);

  const updated = await updateParticipantStatusRepository(participantId, toStatus, reason, actorUserId);

  if (requestId) {
    await createAuditLog({
      actorUserId: actorUserId || null,
      action: "PARTICIPANT_STATUS_UPDATED",
      resourceType: "EVENT_PARTICIPANT",
      resourceId: participantId,
      eventId: existing.eventId,
      beforeData: { status: existing.confirmationStatus },
      afterData: { status: toStatus },
      reason,
      requestId,
    });
  }

  return updated;
}

export async function replaceParticipantService(
  oldParticipantId: string,
  newUstadzId: string,
  reason: string,
  actorUserId?: string,
  requestId?: string
) {
  return await replaceParticipantTxRepository(oldParticipantId, newUstadzId, reason, actorUserId, requestId);
}
