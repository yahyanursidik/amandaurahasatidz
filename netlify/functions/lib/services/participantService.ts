import {
  findParticipantsRepository,
  findParticipantByIdRepository,
  countInstitutionParticipantsRepository,
  countApprovedParticipantsForEventRepository,
  updateParticipantStatusRepository,
  updateParticipantApprovalStatusRepository,
  replaceParticipantTxRepository,
  provisionParticipantPortalAccountRepository,
} from "../repositories/participantRepository";
import { randomInt } from "node:crypto";
import { findEventByIdRepository } from "../repositories/eventRepository";
import { findDuplicateCandidatesRepository } from "../repositories/ustadzRepository";
import { NotFoundError, ValidationError } from "../utils/errors";
import { createAuditLog } from "./auditService";
import { assertAttendanceConfirmationAllowed, assertParticipantEligibleForCheckin } from "./deadlineService";
import { hashPassword } from "../utils/password";

function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const characters = ["A", "a", "7", "!"];
  for (let index = 0; index < 12; index += 1) {
    characters.push(alphabet[randomInt(0, alphabet.length)]);
  }
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }
  return characters.join("");
}

export async function getParticipantsService(eventId: string) {
  return await findParticipantsRepository(eventId);
}

export async function provisionParticipantPortalAccountService(
  eventId: string,
  participantId: string,
  resetExisting: boolean,
  actorUserId: string,
  requestId: string,
) {
  const temporaryPassword = generateTemporaryPassword();
  const account = await provisionParticipantPortalAccountRepository(
    eventId,
    participantId,
    hashPassword(temporaryPassword),
    resetExisting,
    actorUserId,
  );
  await createAuditLog({
    actorUserId,
    action: account.existingAccountLinkedByEmail
      ? "PARTICIPANT_PORTAL_ACCESS_LINKED"
      : resetExisting
        ? "PARTICIPANT_PORTAL_ACCESS_RESET"
        : "PARTICIPANT_PORTAL_ACCESS_CREATED",
    resourceType: "EVENT_PARTICIPANT",
    resourceId: participantId,
    eventId,
    afterData: { userId: account.userId, email: account.email, resetExisting },
    reason: account.existingAccountLinkedByEmail
      ? "Profil peserta ditautkan ke akun portal yang sudah tersedia."
      : resetExisting
        ? "Reset kredensial portal peserta oleh petugas berwenang."
        : "Pembuatan kredensial portal peserta oleh petugas berwenang.",
    requestId,
  });
  return {
    participantId,
    participantName: account.participantName,
    email: account.email,
    temporaryPassword: account.passwordUpdated ? temporaryPassword : null,
    loginUrl: "/login/ustadz",
    action: account.existingAccountLinkedByEmail
      ? "LINKED_EXISTING"
      : resetExisting
        ? "RESET"
        : "CREATED",
    shownOnce: account.passwordUpdated,
  };
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

// Check-in blocking guard (Compliance Point 5)
export async function checkCanCheckInService(participantId: string) {
  const participant = await findParticipantByIdRepository(participantId);
  if (!participant) throw new NotFoundError(`Peserta ID ${participantId} tidak ditemukan.`);

  const event = await findEventByIdRepository(participant.eventId);
  if (!event) throw new NotFoundError("Event peserta tidak ditemukan.");
  assertParticipantEligibleForCheckin(participant, event);

  return participant;
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

  let lateReview = false;
  if (toStatus === "CONFIRMED") {
    const event = await findEventByIdRepository(existing.eventId);
    if (!event) throw new NotFoundError("Event peserta tidak ditemukan.");
    lateReview = assertAttendanceConfirmationAllowed(event).needsReview;
  }

  const updated = await updateParticipantStatusRepository(participantId, toStatus, reason, actorUserId);
  if (lateReview) {
    await updateParticipantApprovalStatusRepository(participantId, "PENDING_REVIEW", "Konfirmasi melewati batas waktu; perlu peninjauan panitia.", actorUserId);
  }

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

// 1. Command approveParticipant (Checks Capacity)
export async function approveParticipantService(
  participantId: string,
  actorUserId?: string,
  requestId?: string,
  notes?: string
) {
  const participant = await findParticipantByIdRepository(participantId);
  if (!participant) throw new NotFoundError(`Peserta ID ${participantId} tidak ditemukan.`);

  const event = await findEventByIdRepository(participant.eventId);
  if (event && event.capacity) {
    const currentApproved = await countApprovedParticipantsForEventRepository(participant.eventId);
    if (currentApproved >= event.capacity) {
      throw new ValidationError(
        `Kapasitas event daurah (${event.capacity} peserta) telah penuh. Peserta disarankan dialihkan ke waitlist.`
      );
    }
  }

  const updated = await updateParticipantApprovalStatusRepository(participantId, "APPROVED", notes, actorUserId);

  if (requestId) {
    await createAuditLog({
      actorUserId: actorUserId || null,
      action: "PARTICIPANT_APPROVED",
      resourceType: "EVENT_PARTICIPANT",
      resourceId: participantId,
      eventId: participant.eventId,
      reason: notes || "Persetujuan kelayakan peserta daurah",
      requestId,
    });
  }

  return updated;
}

// 2. Command waitlistParticipant
export async function waitlistParticipantService(
  participantId: string,
  reason: string,
  actorUserId?: string,
  requestId?: string
) {
  const participant = await findParticipantByIdRepository(participantId);
  if (!participant) throw new NotFoundError(`Peserta ID ${participantId} tidak ditemukan.`);

  const updated = await updateParticipantApprovalStatusRepository(participantId, "WAITLISTED", reason, actorUserId);

  if (requestId) {
    await createAuditLog({
      actorUserId: actorUserId || null,
      action: "PARTICIPANT_WAITLISTED",
      resourceType: "EVENT_PARTICIPANT",
      resourceId: participantId,
      eventId: participant.eventId,
      reason,
      requestId,
    });
  }

  return updated;
}

// 3. Command declineParticipant
export async function declineParticipantService(
  participantId: string,
  reason: string,
  actorUserId?: string,
  requestId?: string
) {
  const participant = await findParticipantByIdRepository(participantId);
  if (!participant) throw new NotFoundError(`Peserta ID ${participantId} tidak ditemukan.`);

  const updated = await updateParticipantApprovalStatusRepository(participantId, "REJECTED", reason, actorUserId);

  if (requestId) {
    await createAuditLog({
      actorUserId: actorUserId || null,
      action: "PARTICIPANT_DECLINED",
      resourceType: "EVENT_PARTICIPANT",
      resourceId: participantId,
      eventId: participant.eventId,
      reason,
      requestId,
    });
  }

  return updated;
}

// 4. Command cancelParticipant
export async function cancelParticipantService(
  participantId: string,
  reason: string,
  actorUserId?: string,
  requestId?: string
) {
  const participant = await findParticipantByIdRepository(participantId);
  if (!participant) throw new NotFoundError(`Peserta ID ${participantId} tidak ditemukan.`);

  const updated = await updateParticipantStatusRepository(participantId, "CANCELLED", reason, actorUserId);

  if (requestId) {
    await createAuditLog({
      actorUserId: actorUserId || null,
      action: "PARTICIPANT_CANCELLED",
      resourceType: "EVENT_PARTICIPANT",
      resourceId: participantId,
      eventId: participant.eventId,
      reason,
      requestId,
    });
  }

  return updated;
}

// 5. Command replaceParticipant
export async function replaceParticipantService(
  oldParticipantId: string,
  newUstadzId: string,
  reason: string,
  actorUserId?: string,
  requestId?: string
) {
  return await replaceParticipantTxRepository(oldParticipantId, newUstadzId, reason, actorUserId, requestId);
}

// 6. Command bulkApproveParticipants (Returns per-item succeeded/failed breakdown)
export async function bulkApproveParticipantsService(
  participantIds: string[],
  actorUserId?: string,
  requestId?: string
) {
  const results: { participantId: string; status: "SUCCESS" | "FAILED"; message: string }[] = [];
  let succeededCount = 0;
  let failedCount = 0;

  for (const pid of participantIds) {
    try {
      await approveParticipantService(pid, actorUserId, requestId, "Bulk approval oleh panitia");
      results.push({ participantId: pid, status: "SUCCESS", message: "Peserta berhasil diapprove" });
      succeededCount++;
    } catch (err: any) {
      results.push({ participantId: pid, status: "FAILED", message: err.message || "Gagal approve peserta" });
      failedCount++;
    }
  }

  if (requestId) {
    await createAuditLog({
      actorUserId: actorUserId || null,
      action: "PARTICIPANTS_BULK_APPROVED",
      resourceType: "EVENT_PARTICIPANT",
      resourceId: participantIds.join(","),
      reason: `Bulk approval: ${succeededCount} sukses, ${failedCount} gagal dari total ${participantIds.length}`,
      requestId,
    });
  }

  return {
    summary: {
      total: participantIds.length,
      succeeded: succeededCount,
      failed: failedCount,
    },
    results,
  };
}
