import { getDbClient } from "../db/client";
import { withTransaction } from "../db/transaction";
import { eventParticipants, participantStatusHistories, ustadzProfiles, institutions, events, auditLogs } from "../db/schema";
import { eq, and, count, desc } from "drizzle-orm";

export async function countInstitutionParticipantsRepository(eventId: string, institutionId: string): Promise<number> {
  const db = getDbClient();
  const res = await db
    .select({ total: count() })
    .from(eventParticipants)
    .where(
      and(
        eq(eventParticipants.eventId, eventId),
        eq(eventParticipants.institutionId, institutionId),
        eq(eventParticipants.confirmationStatus, "CONFIRMED")
      )
    );

  return res[0]?.total || 0;
}

export async function findParticipantsRepository(eventId: string) {
  const db = getDbClient();
  return await db
    .select({
      id: eventParticipants.id,
      eventId: eventParticipants.eventId,
      ustadzId: eventParticipants.ustadzId,
      ustadzName: ustadzProfiles.fullName,
      ustadzEmail: ustadzProfiles.email,
      ustadzPhone: ustadzProfiles.phone,
      ustadzWhatsapp: ustadzProfiles.whatsapp,
      ustadzAddress: ustadzProfiles.address,
      ustadzCityCode: ustadzProfiles.cityCode,
      ustadzProvinceCode: ustadzProfiles.provinceCode,
      eventName: events.name,
      eventStartDate: events.startDate,
      eventEndDate: events.endDate,
      eventVenueName: events.venueName,
      eventVenueAddress: events.venueAddress,
      institutionId: eventParticipants.institutionId,
      institutionName: institutions.name,
      invitationId: eventParticipants.invitationId,
      registrationSource: eventParticipants.registrationSource,
      participantCode: eventParticipants.participantCode,
      isDelegationLead: eventParticipants.isDelegationLead,
      confirmationStatus: eventParticipants.confirmationStatus,
      approvalStatus: eventParticipants.approvalStatus,
      replacementForParticipantId: eventParticipants.replacementForParticipantId,
    })
    .from(eventParticipants)
    .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .leftJoin(institutions, eq(eventParticipants.institutionId, institutions.id))
    .where(eq(eventParticipants.eventId, eventId))
    .orderBy(desc(eventParticipants.createdAt));
}

export async function findParticipantByIdRepository(id: string) {
  const db = getDbClient();
  const found = await db.select().from(eventParticipants).where(eq(eventParticipants.id, id)).limit(1);
  return found[0] || null;
}

export async function recordStatusHistoryRepository(
  participantId: string,
  fromStatus: string | null,
  toStatus: string,
  reason?: string | null,
  changedBy?: string | null
) {
  const db = getDbClient();
  return await db
    .insert(participantStatusHistories)
    .values({
      participantId,
      statusType: "CONFIRMATION_STATUS",
      fromStatus: fromStatus || null,
      toStatus,
      reason: reason || null,
      changedBy: changedBy || null,
    })
    .returning();
}

export async function updateParticipantStatusRepository(
  participantId: string,
  toStatus: string,
  reason?: string | null,
  changedBy?: string | null
) {
  const db = getDbClient();
  const existing = await findParticipantByIdRepository(participantId);
  if (!existing) return null;

  const updated = await db
    .update(eventParticipants)
    .set({ confirmationStatus: toStatus, updatedAt: new Date() })
    .where(eq(eventParticipants.id, participantId))
    .returning();

  await recordStatusHistoryRepository(participantId, existing.confirmationStatus, toStatus, reason, changedBy);

  return updated[0];
}

export async function replaceParticipantTxRepository(
  oldParticipantId: string,
  newUstadzId: string,
  reason: string,
  actorUserId?: string,
  requestId?: string
) {
  return await withTransaction(async (tx) => {
    const oldPart = await tx
      .select()
      .from(eventParticipants)
      .where(eq(eventParticipants.id, oldParticipantId))
      .limit(1);

    if (oldPart.length === 0) {
      throw new Error(`Peserta ID ${oldParticipantId} tidak ditemukan.`);
    }

    const oldRecord = oldPart[0];

    // 1. Mark old participant as REPLACED (Do NOT hard delete!)
    const updatedOld = await tx
      .update(eventParticipants)
      .set({
        confirmationStatus: "REPLACED",
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(eventParticipants.id, oldParticipantId))
      .returning();

    // Record status history for old participant
    await tx.insert(participantStatusHistories).values({
      participantId: oldParticipantId,
      statusType: "CONFIRMATION_STATUS",
      fromStatus: oldRecord.confirmationStatus,
      toStatus: "REPLACED",
      reason: `Digantikan oleh Ustadz ID ${newUstadzId}. Alasan: ${reason}`,
      changedBy: actorUserId || null,
    });

    // 2. Create new participant record referencing oldParticipantId
    const newCode = `PAR-RPL-${Date.now().toString().substring(7)}`;
    const createdNew = await tx
      .insert(eventParticipants)
      .values({
        eventId: oldRecord.eventId,
        ustadzId: newUstadzId,
        institutionId: oldRecord.institutionId,
        invitationId: oldRecord.invitationId,
        participantCode: newCode,
        isDelegationLead: oldRecord.isDelegationLead,
        confirmationStatus: "CONFIRMED",
        approvalStatus: "PENDING_REVIEW",
        confirmedAt: new Date(),
        replacementForParticipantId: oldParticipantId,
        notes: `Pengganti untuk ${oldRecord.participantCode}`,
      })
      .returning();

    // Record status history for new participant
    await tx.insert(participantStatusHistories).values({
      participantId: createdNew[0].id,
      statusType: "CONFIRMATION_STATUS",
      fromStatus: "INVITED",
      toStatus: "CONFIRMED",
      reason: `Menggantikan peserta ID ${oldParticipantId}`,
      changedBy: actorUserId || null,
    });

    // Write audit log
    if (requestId) {
      await tx.insert(auditLogs).values({
        actorUserId: actorUserId || null,
        action: "PARTICIPANT_REPLACED",
        resourceType: "EVENT_PARTICIPANT",
        resourceId: createdNew[0].id,
        eventId: oldRecord.eventId,
        reason: `Peserta ${oldRecord.participantCode} digantikan oleh ${newCode}. Alasan: ${reason}`,
        requestId,
      });
    }

    return {
      oldParticipant: updatedOld[0],
      newParticipant: createdNew[0],
    };
  });
}

export async function countApprovedParticipantsForEventRepository(eventId: string): Promise<number> {
  const db = getDbClient();
  const res = await db
    .select({ total: count() })
    .from(eventParticipants)
    .where(
      and(
        eq(eventParticipants.eventId, eventId),
        eq(eventParticipants.approvalStatus, "APPROVED")
      )
    );

  return res[0]?.total || 0;
}

export async function updateParticipantApprovalStatusRepository(
  participantId: string,
  toApprovalStatus: string,
  reason?: string | null,
  changedBy?: string | null
) {
  const db = getDbClient();
  const existing = await findParticipantByIdRepository(participantId);
  if (!existing) return null;

  const updated = await db
    .update(eventParticipants)
    .set({
      approvalStatus: toApprovalStatus,
      approvedAt: toApprovalStatus === "APPROVED" ? new Date() : existing.approvedAt,
      updatedAt: new Date(),
    })
    .where(eq(eventParticipants.id, participantId))
    .returning();

  await db.insert(participantStatusHistories).values({
    participantId,
    statusType: "APPROVAL_STATUS",
    fromStatus: existing.approvalStatus,
    toStatus: toApprovalStatus,
    reason: reason || null,
    changedBy: changedBy || null,
  });

  return updated[0];
}
