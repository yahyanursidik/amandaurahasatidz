import { getDbClient } from "../db/client";
import { withTransaction } from "../db/transaction";
import {
  eventParticipants,
  participantStatusHistories,
  ustadzProfiles,
  institutions,
  events,
  invitations,
  auditLogs,
  attendanceRecords,
  checkinLogs,
  announcementRecipients,
  emailJobs,
  roles,
  userRoleAssignments,
  users,
  ustadzInstitutionAffiliations,
} from "../db/schema";
import { eq, and, count, desc, inArray, notInArray, or, sql, isNull, ilike, notExists, asc } from "drizzle-orm";
import { normalizeEmail, normalizeName, normalizePhone } from "../utils/normalization";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../utils/errors";
import { lockRegistrationEvent, assertRegistrationCapacity } from "../services/registrationCapacity";
import { assertAttendanceConfirmationAllowed } from "../services/deadlineService";
import { isAttendanceEventOpen } from "../services/attendanceModel";
import { randomUUID } from "node:crypto";
import type { ParticipantPageQuery } from "../validations/participantValidation";
import { INSTITUTION_PARTICIPANT_SOURCES, INVITED_PARTICIPANT_SOURCES } from "../../../../src/lib/participantCatalog";
import { isActiveDelegationRegistration } from "../../../../src/lib/registrationStatus";
import { submittedWhatsAppForParticipant } from "../services/participantContactReview";

export async function countInstitutionParticipantsRepository(eventId: string, institutionId: string): Promise<number> {
  const db = getDbClient();
  const res = await db
    .select({ total: count() })
    .from(eventParticipants)
    .where(
      and(
        eq(eventParticipants.eventId, eventId),
        eq(eventParticipants.institutionId, institutionId),
        notInArray(eventParticipants.confirmationStatus, ["CANCELLED", "REPLACED"]),
        notInArray(eventParticipants.approvalStatus, ["DECLINED", "REJECTED"])
      )
    );

  return res[0]?.total || 0;
}

/** Remove only this event registration; master profiles and portal accounts remain available. */
export async function deleteParticipantTxRepository(
  eventId: string,
  participantId: string,
  reason: string,
  actorUserId: string,
  requestId: string,
) {
  return withTransaction(async (tx) => {
    // Use the same lock order as registration, quota changes and replacement.
    await lockRegistrationEvent(tx, eventId);
    const [participant] = await tx.select().from(eventParticipants)
      .where(and(eq(eventParticipants.id, participantId), eq(eventParticipants.eventId, eventId)))
      .limit(1).for("update");
    if (!participant) throw new NotFoundError("Peserta tidak ditemukan pada event ini.");

    let successorParticipantId: string | null = null;
    const group = participant.publicGroupId
      ? eq(eventParticipants.publicGroupId, participant.publicGroupId)
      : participant.invitationId && participant.institutionId
        ? and(eq(eventParticipants.invitationId, participant.invitationId), eq(eventParticipants.institutionId, participant.institutionId))
        : undefined;
    if (participant.isDelegationLead && group) {
      const [successor] = await tx.select({ id: eventParticipants.id }).from(eventParticipants)
        .where(and(eq(eventParticipants.eventId, eventId), group,
          sql`${eventParticipants.id} <> ${participantId}`,
          notInArray(eventParticipants.confirmationStatus, ["CANCELLED", "REPLACED"]),
          notInArray(eventParticipants.approvalStatus, ["DECLINED", "REJECTED", "CANCELLED"])))
        .orderBy(desc(eventParticipants.isDelegationLead), asc(eventParticipants.createdAt), asc(eventParticipants.id))
        .limit(1).for("update");
      if (successor) {
        successorParticipantId = successor.id;
        await tx.update(eventParticipants).set({ isDelegationLead: true, updatedAt: new Date() })
          .where(and(eq(eventParticipants.id, successor.id), eq(eventParticipants.eventId, eventId)));
      }
    }

    // Keep historical scan logs, including the former registration identity, without a dangling FK.
    await tx.update(checkinLogs).set({ participantId: null,
      metadata: sql`coalesce(${checkinLogs.metadata}, '{}'::jsonb) || ${JSON.stringify({
        deletedParticipantId: participantId, deletedParticipantCode: participant.participantCode,
      })}::jsonb`,
    }).where(eq(checkinLogs.participantId, participantId));
    await tx.delete(announcementRecipients).where(eq(announcementRecipients.participantId, participantId));
    // Older jobs embed the UUID in their idempotency key; newer jobs also carry payload.participantId.
    // Do not affect delivered mail or unrelated event messages addressed to the same email account.
    await tx.update(emailJobs).set({ status: "CANCELLED", lastError: "Pendaftaran peserta telah dihapus dari event.",
      lockedAt: null, lockedBy: null, updatedAt: new Date() })
      .where(and(eq(emailJobs.eventId, eventId),
        inArray(emailJobs.status, ["QUEUED", "PENDING", "FAILED", "DEAD_LETTER"]),
        or(sql`${emailJobs.payload}->>'participantId' = ${participantId}`,
          sql`strpos(${emailJobs.idempotencyKey}, ${participantId}) > 0`)));
    await tx.update(eventParticipants).set({ replacementForParticipantId: null, updatedAt: new Date() })
      .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.replacementForParticipantId, participantId)));

    // Status and attendance records cascade on participant deletion. The audit has no participant FK.
    await tx.insert(auditLogs).values({ actorUserId, action: "PARTICIPANT_DELETED", resourceType: "EVENT_PARTICIPANT",
      resourceId: participantId, eventId, beforeData: participant,
      afterData: { deleted: true, successorParticipantId }, reason, requestId });
    await tx.delete(eventParticipants)
      .where(and(eq(eventParticipants.id, participantId), eq(eventParticipants.eventId, eventId)));
    return { participantId, eventId, deleted: true as const, successorParticipantId };
  });
}

const participantColumns = {
      id: eventParticipants.id,
      eventId: eventParticipants.eventId,
      ustadzId: eventParticipants.ustadzId,
      ustadzName: ustadzProfiles.fullName,
      ustadzEmail: ustadzProfiles.email,
      ustadzPhone: ustadzProfiles.phone,
      ustadzWhatsapp: ustadzProfiles.whatsapp,
      pendingWhatsapp: submittedWhatsAppForParticipant,
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
      publicGroupId: eventParticipants.publicGroupId,
      registrationSource: eventParticipants.registrationSource,
      participantCode: eventParticipants.participantCode,
      eventParticipationCount: sql<number>`(select count(*)::int from event_participants other where other.ustadz_id = ${eventParticipants.ustadzId})`,
      isDelegationLead: eventParticipants.isDelegationLead,
      confirmationStatus: eventParticipants.confirmationStatus,
      approvalStatus: eventParticipants.approvalStatus,
      confirmationStatusReason: sql<string | null>`(select h.reason from participant_status_histories h
        where h.participant_id = ${eventParticipants.id} and h.status_type = 'CONFIRMATION_STATUS'
          and h.to_status = ${eventParticipants.confirmationStatus}
        order by h.changed_at desc, h.id desc limit 1)`,
      statusReason: sql<string | null>`(select h.reason from participant_status_histories h
        where h.participant_id = ${eventParticipants.id} and h.status_type = 'APPROVAL_STATUS'
          and h.to_status = ${eventParticipants.approvalStatus}
        order by h.changed_at desc, h.id desc limit 1)`,
      replacementForParticipantId: eventParticipants.replacementForParticipantId,
      registeredAt: eventParticipants.createdAt,
      portalUserId: ustadzProfiles.userId,
      portalAccountStatus: users.status,
      portalPasswordConfigured: sql<boolean>`${users.passwordHash} is not null`,
};

function participantReadQuery(db: ReturnType<typeof getDbClient>) {
  return db.select(participantColumns)
    .from(eventParticipants)
    .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .leftJoin(institutions, eq(eventParticipants.institutionId, institutions.id))
    .leftJoin(users, eq(ustadzProfiles.userId, users.id)).$dynamic();
}

/** Legacy complete list for explicit exports/older consumers; workspaces use the bounded page API. */
export async function findParticipantsRepository(eventId: string) {
  return participantReadQuery(getDbClient()).where(eq(eventParticipants.eventId, eventId))
    .orderBy(desc(eventParticipants.createdAt), desc(eventParticipants.id));
}

export async function findParticipantPageRepository(eventId: string, query: ParticipantPageQuery) {
  const db = getDbClient();
  const searchPattern = `%${query.search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
  const eligible = and(inArray(eventParticipants.approvalStatus, ["PENDING_REVIEW", "WAITLISTED"]),
    inArray(eventParticipants.confirmationStatus, ["INVITED", "CONFIRMED"]))!;
  const digits = sql`regexp_replace(regexp_replace(coalesce(nullif(${ustadzProfiles.whatsapp}, ''), ${ustadzProfiles.phone}, ''), '[^0-9]', '', 'g'), '^00', '')`;
  const whatsappValid = sql`(case when ${digits} like '0%' then '62' || substring(${digits} from 2)
    when ${digits} like '8%' then '62' || ${digits} else ${digits} end) ~ '^[1-9][0-9]{8,14}$'`;
  const completeContact = sql`(${whatsappValid} and btrim(coalesce(${ustadzProfiles.email}, '')) <> '' and btrim(coalesce(${ustadzProfiles.address}, '')) <> '')`;
  const needsAction = sql`(${eventParticipants.approvalStatus} = 'PENDING_REVIEW' or not ${completeContact} or ${users.passwordHash} is null or ${submittedWhatsAppForParticipant} is not null)`;
  const filter = and(
    eq(eventParticipants.eventId, eventId),
    query.search ? or(ilike(ustadzProfiles.fullName, searchPattern), ilike(eventParticipants.participantCode, searchPattern),
      ilike(institutions.name, searchPattern), ilike(ustadzProfiles.email, searchPattern),
      ilike(ustadzProfiles.phone, searchPattern), ilike(ustadzProfiles.whatsapp, searchPattern)) : undefined,
    query.institutionId ? eq(eventParticipants.institutionId, query.institutionId) : undefined,
    query.invitationId ? eq(eventParticipants.invitationId, query.invitationId) : undefined,
    query.source === "INSTITUTION" ? inArray(eventParticipants.registrationSource, INSTITUTION_PARTICIPANT_SOURCES)
      : query.source === "INDIVIDUAL" ? eq(eventParticipants.registrationSource, "INDIVIDUAL_INVITATION")
        : query.source === "REGULAR" ? notInArray(eventParticipants.registrationSource, INVITED_PARTICIPANT_SOURCES) : undefined,
    query.institution && query.institution !== "ALL" ? query.institution === "INDIVIDUAL" ? isNull(institutions.name) : eq(institutions.name, query.institution) : undefined,
    query.status === "ALL" ? undefined : query.status === "NEEDS_ACTION" ? needsAction
      : query.status === "AWAITING_CONFIRMATION" ? and(eq(eventParticipants.approvalStatus, "APPROVED"), eq(eventParticipants.confirmationStatus, "INVITED"))
      : query.status === "CANCELLED" ? eq(eventParticipants.confirmationStatus, "CANCELLED") : query.status === "DECLINED"
      ? inArray(eventParticipants.approvalStatus, ["DECLINED", "REJECTED"]) : eq(eventParticipants.approvalStatus, query.status),
    query.contact === "COMPLETE" ? completeContact : query.contact === "INCOMPLETE" ? sql`not ${completeContact}`
      : query.contact === "NO_WHATSAPP" ? sql`coalesce(nullif(${ustadzProfiles.whatsapp}, ''), ${ustadzProfiles.phone}, '') = ''`
        : query.contact === "NO_PORTAL" ? isNull(users.passwordHash) : undefined,
    query.eligible === "true" ? eligible : undefined,
  )!;
  const ordering = query.sort === "NAME" ? [asc(ustadzProfiles.fullName), asc(eventParticipants.id)]
    : query.sort === "OLDEST" ? [asc(eventParticipants.createdAt), asc(eventParticipants.id)]
      : query.sort === "PRIORITY" ? [sql`case ${eventParticipants.approvalStatus} when 'PENDING_REVIEW' then 0 when 'WAITLISTED' then 1 when 'APPROVED' then 2 when 'DECLINED' then 3 when 'CANCELLED' then 4 else 9 end`, desc(eventParticipants.createdAt), desc(eventParticipants.id)]
        : [desc(eventParticipants.createdAt), desc(eventParticipants.id)];
  const selectionQuery = db.select({ id: eventParticipants.id, ustadzName: ustadzProfiles.fullName,
    participantCode: eventParticipants.participantCode, approvalStatus: eventParticipants.approvalStatus,
    confirmationStatus: eventParticipants.confirmationStatus }).from(eventParticipants)
    .innerJoin(ustadzProfiles, eq(ustadzProfiles.id, eventParticipants.ustadzId))
    .leftJoin(institutions, eq(institutions.id, eventParticipants.institutionId))
    .leftJoin(users, eq(users.id, ustadzProfiles.userId)).where(filter)
    .orderBy(...ordering).limit(query.pageSize).offset((query.page - 1) * query.pageSize);
  const [data, [counts]] = await Promise.all([
    query.projection === "selection" ? selectionQuery : participantReadQuery(db).where(filter)
      .orderBy(...ordering).limit(query.pageSize).offset((query.page - 1) * query.pageSize),
    db.select({
      filteredTotal: sql<number>`count(*) filter (where ${filter})::int`,
      filteredEligible: sql<number>`count(*) filter (where ${filter} and ${eligible})::int`,
      filteredPendingEligible: sql<number>`count(*) filter (where ${filter} and ${eligible} and ${eventParticipants.approvalStatus} = 'PENDING_REVIEW')::int`,
      total: sql<number>`count(*)::int`,
      approved: sql<number>`count(*) filter (where ${eventParticipants.approvalStatus} = 'APPROVED')::int`,
      pending: sql<number>`count(*) filter (where ${eventParticipants.approvalStatus} = 'PENDING_REVIEW')::int`,
      institution: sql<number>`count(*) filter (where ${inArray(eventParticipants.registrationSource, INSTITUTION_PARTICIPANT_SOURCES)})::int`,
      pendingEligible: sql<number>`count(*) filter (where ${eventParticipants.approvalStatus} = 'PENDING_REVIEW' and ${eligible})::int`,
      completeContacts: sql<number>`count(*) filter (where ${completeContact})::int`,
      portalReady: sql<number>`count(*) filter (where ${users.passwordHash} is not null)::int`,
      ...(query.includeInstitutions === "true" ? { institutions: sql<string[]>`coalesce(jsonb_agg(distinct ${institutions.name}) filter (where ${institutions.name} is not null), '[]'::jsonb)` } : {}),
    }).from(eventParticipants).innerJoin(ustadzProfiles, eq(ustadzProfiles.id, eventParticipants.ustadzId))
      .leftJoin(institutions, eq(institutions.id, eventParticipants.institutionId))
      .leftJoin(users, eq(users.id, ustadzProfiles.userId)).where(eq(eventParticipants.eventId, eventId)),
  ]);
  const total = counts?.filteredTotal || 0;
  return { data, meta: { page: query.page, pageSize: query.pageSize, total,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)), filteredEligible: counts?.filteredEligible || 0, filteredPendingEligible: counts?.filteredPendingEligible || 0,
    summary: { total: counts?.total || 0, approved: counts?.approved || 0, pending: counts?.pending || 0,
      institution: counts?.institution || 0, pendingEligible: counts?.pendingEligible || 0,
      completeContacts: counts?.completeContacts || 0, portalReady: counts?.portalReady || 0 },
    ...(query.includeInstitutions === "true" ? { institutions: (counts?.institutions || []).sort((a, b) => a.localeCompare(b, "id-ID")) } : {}) } };
}

export async function provisionParticipantPortalAccountRepository(
  eventId: string,
  participantId: string,
  passwordHash: string,
  resetExisting: boolean,
  actorUserId: string | null,
) {
  return await withTransaction(async (tx) => {
    const target = (
      await tx
        .select({
          participantId: eventParticipants.id,
          institutionId: eventParticipants.institutionId,
          ustadzId: ustadzProfiles.id,
          fullName: ustadzProfiles.fullName,
          profileEmail: ustadzProfiles.email,
          profileUserId: ustadzProfiles.userId,
        })
        .from(eventParticipants)
        .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
        .where(and(eq(eventParticipants.id, participantId), eq(eventParticipants.eventId, eventId)))
        .limit(1)
    )[0];

    if (!target) throw new NotFoundError("Peserta tidak ditemukan pada event ini.");
    const normalizedEmail = normalizeEmail(target.profileEmail || "");
    if (!normalizedEmail) {
      throw new ValidationError(
        "Email peserta belum diisi. Lengkapi email profil asatidz sebelum membuat login portal.",
      );
    }

    let portalUser = target.profileUserId
      ? (await tx.select().from(users).where(eq(users.id, target.profileUserId)).limit(1))[0]
      : (await tx.select().from(users).where(eq(users.email, normalizedEmail)).limit(1))[0];

    if (target.profileUserId && !portalUser) {
      throw new ConflictError("Profil peserta terhubung ke akun yang sudah tidak tersedia.");
    }
    const existingAccountLinkedByEmail = Boolean(portalUser?.passwordHash && !resetExisting);
    let passwordUpdated = false;
    if (!portalUser) {
      portalUser = (
        await tx
          .insert(users)
          .values({
            email: normalizedEmail,
            name: target.fullName,
            passwordHash,
            status: "ACTIVE",
          })
          .returning()
      )[0];
      passwordUpdated = true;
    } else {
      const shouldUpdatePassword = !portalUser.passwordHash || resetExisting;
      portalUser = (
        await tx
          .update(users)
          .set({
            ...(shouldUpdatePassword ? { passwordHash } : {}),
            status: "ACTIVE",
            name: portalUser.name || target.fullName,
            updatedAt: new Date(),
          })
          .where(eq(users.id, portalUser.id))
          .returning()
      )[0];
      passwordUpdated = shouldUpdatePassword;
    }

    if (!target.profileUserId) {
      await tx
        .update(ustadzProfiles)
        .set({ userId: portalUser.id, email: portalUser.email, updatedAt: new Date() })
        .where(eq(ustadzProfiles.id, target.ustadzId));
    }

    const ustadzRole = (await tx.select().from(roles).where(eq(roles.code, "USTADZ")).limit(1))[0];
    if (!ustadzRole) throw new ConflictError("Role USTADZ belum tersedia pada database.");
    const roleAssignment = await tx
      .select({ id: userRoleAssignments.id })
      .from(userRoleAssignments)
      .where(
        and(
          eq(userRoleAssignments.userId, portalUser.id),
          eq(userRoleAssignments.roleId, ustadzRole.id),
          eq(userRoleAssignments.eventId, eventId),
        ),
      )
      .limit(1);
    if (!roleAssignment[0]) {
      await tx.insert(userRoleAssignments).values({
        userId: portalUser.id,
        roleId: ustadzRole.id,
        eventId,
        institutionId: target.institutionId,
        createdBy: actorUserId,
      });
    }

    return {
      participantId: target.participantId,
      participantName: target.fullName,
      userId: portalUser.id,
      email: portalUser.email,
      passwordUpdated,
      existingAccountLinkedByEmail,
    };
  });
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
  changedBy?: string | null,
  options: { requireApproved?: boolean } = {},
) {
  const hint = await findParticipantByIdRepository(participantId);
  if (!hint) throw new NotFoundError("Peserta tidak ditemukan.");
  return withTransaction(async (tx) => {
    const event = await lockRegistrationEvent(tx, hint.eventId);
    const [existing] = await tx.select().from(eventParticipants).where(eq(eventParticipants.id, participantId)).limit(1).for("update");
    if (!existing) throw new NotFoundError("Peserta tidak ditemukan.");
    if (toStatus === "CONFIRMED" && options.requireApproved && existing.approvalStatus !== "APPROVED") {
      throw new ForbiddenError("Tunggu persetujuan panitia sebelum mengonfirmasi kehadiran.");
    }
    if (existing.confirmationStatus === toStatus) return existing;
    if (toStatus === "CONFIRMED" && options.requireApproved && (!isAttendanceEventOpen(event) || !event.attendanceConfirmationRequired)) {
      throw new ConflictError("Konfirmasi hadir tidak tersedia atau tidak diwajibkan untuk acara ini.");
    }
    if (!["INVITED", "CONFIRMED"].includes(existing.confirmationStatus) || !["CONFIRMED", "CANCELLED"].includes(toStatus)) {
      throw new ConflictError("Status peserta sudah berubah atau tidak dapat diperbarui melalui aksi ini.");
    }
    if (toStatus === "CONFIRMED" && ["DECLINED", "REJECTED"].includes(existing.approvalStatus)) throw new ConflictError("Peserta ditolak tidak dapat dikonfirmasi hadir.");
    const now = new Date();
    const needsReview = toStatus === "CONFIRMED" && assertAttendanceConfirmationAllowed(event, now).needsReview;
    const [updated] = await tx.update(eventParticipants).set({ confirmationStatus: toStatus,
      ...(toStatus === "CONFIRMED" ? { confirmedAt: now } : { cancelledAt: now }),
      ...(needsReview && { approvalStatus: "PENDING_REVIEW", approvedAt: null, approvedBy: null }),
      qrTokenVersion: sql`${eventParticipants.qrTokenVersion} + 1`, qrIssuedAt: null,
      updatedAt: now,
    }).where(eq(eventParticipants.id, participantId)).returning();
    await tx.insert(participantStatusHistories).values({ participantId, statusType: "CONFIRMATION_STATUS",
      fromStatus: existing.confirmationStatus, toStatus, reason: reason || null, changedBy: changedBy || null });
    if (needsReview && existing.approvalStatus !== "PENDING_REVIEW") {
      await tx.insert(participantStatusHistories).values({ participantId, statusType: "APPROVAL_STATUS",
        fromStatus: existing.approvalStatus, toStatus: "PENDING_REVIEW",
        reason: "Konfirmasi melewati batas waktu; perlu peninjauan panitia.", changedBy: changedBy || null });
    }
    return updated;
  });
}

export async function replaceParticipantTxRepository(
  oldParticipantId: string,
  newUstadzId: string,
  reason: string,
  actorUserId?: string,
  requestId?: string
) {
  const hint = await findParticipantByIdRepository(oldParticipantId);
  if (!hint) throw new NotFoundError("Peserta yang diganti tidak ditemukan.");
  return await withTransaction(async (tx) => {
    await lockRegistrationEvent(tx, hint.eventId);
    const oldPart = await tx
      .select()
      .from(eventParticipants)
      .where(eq(eventParticipants.id, oldParticipantId))
      .limit(1).for("update");

    if (oldPart.length === 0) {
      throw new Error(`Peserta ID ${oldParticipantId} tidak ditemukan.`);
    }

    const oldRecord = oldPart[0];
    if (!["INVITED", "CONFIRMED"].includes(oldRecord.confirmationStatus) || ["REJECTED", "DECLINED"].includes(oldRecord.approvalStatus)) {
      throw new ConflictError("Peserta sudah tidak aktif atau telah ditolak; tidak dapat diganti.");
    }
    const [profile] = await tx.select().from(ustadzProfiles).where(eq(ustadzProfiles.id, newUstadzId)).limit(1);
    if (!profile || profile.profileStatus !== "ACTIVE" || profile.deletedAt || profile.mergedIntoId) throw new ValidationError("Pilih profil asatidz pengganti yang aktif.");
    const [duplicate] = await tx.select({ id: eventParticipants.id }).from(eventParticipants)
      .where(and(eq(eventParticipants.eventId, oldRecord.eventId), eq(eventParticipants.ustadzId, newUstadzId))).limit(1);
    if (duplicate) throw new ConflictError("Asatidz pengganti sudah terdaftar pada event ini.");
    const [attendance] = await tx.select({ id: attendanceRecords.id }).from(attendanceRecords).where(eq(attendanceRecords.participantId, oldParticipantId)).limit(1);
    if (attendance) throw new ConflictError("Peserta sudah memiliki presensi. Gunakan pembatalan agar riwayat kehadiran tidak dialihkan ke orang lain.");

    // 1. Mark old participant as REPLACED (Do NOT hard delete!)
    const updatedOld = await tx
      .update(eventParticipants)
      .set({
        confirmationStatus: "REPLACED",
        cancelledAt: new Date(),
        qrTokenVersion: sql`${eventParticipants.qrTokenVersion} + 1`,
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
    const newCode = `P-${randomUUID().replace(/-/g, "").toUpperCase()}`;
    const createdNew = await tx
      .insert(eventParticipants)
      .values({
        eventId: oldRecord.eventId,
        ustadzId: newUstadzId,
        institutionId: oldRecord.institutionId,
        invitationId: oldRecord.invitationId,
        publicGroupId: oldRecord.publicGroupId,
        registrationSource: oldRecord.registrationSource,
        participantCode: newCode,
        isDelegationLead: oldRecord.isDelegationLead,
        confirmationStatus: "CONFIRMED",
        approvalStatus: "PENDING_REVIEW",
        confirmedAt: new Date(),
        replacementForParticipantId: oldParticipantId,
        notes: `Pengganti untuk ${oldRecord.participantCode}`,
      })
      .returning();

    if (oldRecord.institutionId) {
      const [affiliation] = await tx.select({ id: ustadzInstitutionAffiliations.id }).from(ustadzInstitutionAffiliations)
        .where(and(eq(ustadzInstitutionAffiliations.ustadzId, newUstadzId), eq(ustadzInstitutionAffiliations.institutionId, oldRecord.institutionId))).limit(1);
      if (!affiliation) await tx.insert(ustadzInstitutionAffiliations).values({ ustadzId: newUstadzId, institutionId: oldRecord.institutionId, status: "ACTIVE", isPrimary: false });
    }

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

export async function replacePortalDelegationMemberTxRepository(
  actorUstadzId: string,
  actorUserId: string,
  actorParticipantId: string,
  payload: {
    targetParticipantId: string;
    fullName: string;
    email: string;
    phone?: string | null;
    whatsapp: string;
    address?: string | null;
    reason: string;
  },
  requestId: string,
) {
  const hint = await findParticipantByIdRepository(actorParticipantId);
  if (!hint) throw new NotFoundError("Pendaftaran kepala rombongan tidak ditemukan.");
  return withTransaction(async (tx) => {
    const event = await lockRegistrationEvent(tx, hint.eventId);
    const actorRows = await tx
      .select()
      .from(eventParticipants)
      .where(
        and(
          eq(eventParticipants.id, actorParticipantId),
          eq(eventParticipants.ustadzId, actorUstadzId),
        ),
      )
      .limit(1).for("update");
    const actor = actorRows[0];
    if (!actor || !actor.isDelegationLead || !actor.invitationId || !actor.institutionId || !isActiveDelegationRegistration(actor)) {
      throw new ForbiddenError("Hanya kepala rombongan dengan pendaftaran aktif yang dapat mengubah delegasi.");
    }
    const [invitation] = await tx.select({ status: invitations.status, responseDeadline: invitations.responseDeadline,
      registrationMode: invitations.registrationMode }).from(invitations)
      .where(and(eq(invitations.id, actor.invitationId), eq(invitations.eventId, actor.eventId), eq(invitations.institutionId, actor.institutionId))).limit(1);
    const now = new Date();
    const deadline = invitation?.responseDeadline || event.invitationResponseDeadline;
    if (!invitation || invitation.status === "REVOKED" || invitation.registrationMode === "INDIVIDUAL_SELF" ||
      !isAttendanceEventOpen(event, now) || deadline && deadline < now) {
      throw new ForbiddenError("Penggantian dari portal sudah ditutup. Hubungi panitia bila anggota perlu diganti.");
    }
    if (actor.id === payload.targetParticipantId) {
      throw new ValidationError(
        "Kepala rombongan tidak dapat mengganti dirinya sendiri. Hubungi panitia untuk memindahkan amanah kepala rombongan.",
      );
    }

    const targetRows = await tx
      .select()
      .from(eventParticipants)
      .where(eq(eventParticipants.id, payload.targetParticipantId))
      .limit(1).for("update");
    const target = targetRows[0];
    if (!target) throw new NotFoundError("Peserta yang akan diganti tidak ditemukan.");
    if (
      target.eventId !== actor.eventId ||
      target.institutionId !== actor.institutionId ||
      target.invitationId !== actor.invitationId
    ) {
      throw new ForbiddenError("Peserta tersebut bukan anggota rombongan yang Anda kelola.");
    }
    if (!isActiveDelegationRegistration(target)) {
      throw new ConflictError("Peserta ini sudah tidak aktif dan tidak dapat diganti lagi.");
    }
    const checkedIn = await tx
      .select({ id: attendanceRecords.id })
      .from(attendanceRecords)
      .where(eq(attendanceRecords.participantId, target.id))
      .limit(1);
    if (checkedIn[0]) {
      throw new ConflictError(
        "Peserta sudah memiliki catatan check-in. Perubahan setelah check-in harus dilakukan panitia.",
      );
    }

    const normalizedEmail = normalizeEmail(payload.email);
    const normalizedPhone = normalizePhone(payload.phone);
    const normalizedWhatsapp = normalizePhone(payload.whatsapp);
    const normalizedName = normalizeName(payload.fullName);
    if (!normalizedEmail || !normalizedWhatsapp) {
      throw new ValidationError("Email dan nomor WhatsApp pengganti wajib valid.");
    }

    let user = (await tx.select().from(users).where(eq(users.email, normalizedEmail)).limit(1))[0];
    if (user && user.status !== "ACTIVE") {
      throw new ConflictError("Email pengganti terhubung ke akun yang tidak aktif. Hubungi administrator.");
    }
    if (!user) {
      user = (
        await tx
          .insert(users)
          .values({ email: normalizedEmail, name: payload.fullName.trim(), status: "ACTIVE" })
          .returning()
      )[0];
    }

    const matchingProfiles = (
      await tx
        .select()
        .from(ustadzProfiles)
        .where(
          or(
            eq(ustadzProfiles.email, normalizedEmail),
            eq(ustadzProfiles.userId, user.id),
          ),
        )
        .limit(2)
    );
    let profile = matchingProfiles[0];
    if (matchingProfiles.length > 1 || profile && (profile.userId && profile.userId !== user.id ||
      profile.deletedAt || profile.mergedIntoId || profile.profileStatus !== "ACTIVE" ||
      normalizeName(profile.fullName) !== normalizedName || profile.email && normalizeEmail(profile.email) !== normalizedEmail)) {
      throw new ConflictError("Identitas pengganti tidak cocok dengan profil yang ada. Hubungi administrator.");
    }
    if (!profile) {
      profile = (
        await tx
          .insert(ustadzProfiles)
          .values({
            userId: user.id,
            fullName: payload.fullName.trim(),
            normalizedName,
            email: normalizedEmail,
            phone: normalizedPhone,
            whatsapp: normalizedWhatsapp,
            address: payload.address?.trim() || null,
            profileStatus: "ACTIVE",
          })
          .returning()
      )[0];
    } else if (!profile.userId) {
      profile = (
        await tx
          .update(ustadzProfiles)
          .set({
            userId: user.id,
            updatedAt: new Date(),
          })
          .where(eq(ustadzProfiles.id, profile.id))
          .returning()
      )[0];
    }
    if (profile.id === target.ustadzId) {
      throw new ValidationError("Data pengganti sama dengan peserta yang sedang terdaftar.");
    }

    const duplicateParticipation = await tx
      .select({ id: eventParticipants.id })
      .from(eventParticipants)
      .where(
        and(
          eq(eventParticipants.eventId, actor.eventId),
          eq(eventParticipants.ustadzId, profile.id),
        ),
      )
      .limit(1);
    if (duplicateParticipation[0]) {
      throw new ConflictError("Asatidz pengganti sudah terdaftar pada event yang sama.");
    }

    const ustadzRole = (await tx.select().from(roles).where(eq(roles.code, "USTADZ")).limit(1))[0];
    if (!ustadzRole) throw new ConflictError("Role USTADZ belum tersedia pada database.");
    const existingRole = await tx
      .select({ id: userRoleAssignments.id })
      .from(userRoleAssignments)
      .where(
        and(
          eq(userRoleAssignments.userId, user.id),
          eq(userRoleAssignments.roleId, ustadzRole.id),
          eq(userRoleAssignments.eventId, actor.eventId),
        ),
      )
      .limit(1);
    if (!existingRole[0]) {
      await tx.insert(userRoleAssignments).values({
        userId: user.id,
        roleId: ustadzRole.id,
        eventId: actor.eventId,
        institutionId: actor.institutionId,
        createdBy: actorUserId,
      });
    }

    const affiliation = await tx
      .select({ id: ustadzInstitutionAffiliations.id })
      .from(ustadzInstitutionAffiliations)
      .where(
        and(
          eq(ustadzInstitutionAffiliations.ustadzId, profile.id),
          eq(ustadzInstitutionAffiliations.institutionId, actor.institutionId),
        ),
      )
      .limit(1);
    if (!affiliation[0]) {
      await tx.insert(ustadzInstitutionAffiliations).values({
        ustadzId: profile.id,
        institutionId: actor.institutionId,
        status: "ACTIVE",
      });
    }

    await tx
      .update(eventParticipants)
      .set({ confirmationStatus: "REPLACED", cancelledAt: now, updatedAt: now,
        qrTokenVersion: sql`${eventParticipants.qrTokenVersion} + 1`, qrIssuedAt: null })
      .where(eq(eventParticipants.id, target.id));
    await tx.insert(participantStatusHistories).values({
      participantId: target.id,
      statusType: "CONFIRMATION_STATUS",
      fromStatus: target.confirmationStatus,
      toStatus: "REPLACED",
      reason: payload.reason,
      changedBy: actorUserId,
    });

    const participantCode = `ADA-RPL-${Date.now().toString(36).toUpperCase()}`;
    const created = (
      await tx
        .insert(eventParticipants)
        .values({
          eventId: actor.eventId,
          ustadzId: profile.id,
          institutionId: actor.institutionId,
          invitationId: actor.invitationId,
          registrationSource: "INSTITUTION_DELEGATION_REPLACEMENT",
          participantCode,
          isDelegationLead: false,
          confirmationStatus: "INVITED",
          approvalStatus: "PENDING_REVIEW",
          replacementForParticipantId: target.id,
          notes: `Pengganti ${target.participantCode}: ${payload.reason}`,
        })
        .returning()
    )[0];

    await tx.insert(participantStatusHistories).values({
      participantId: created.id,
      statusType: "APPROVAL_STATUS",
      fromStatus: null,
      toStatus: "PENDING_REVIEW",
      reason: `Diajukan kepala rombongan sebagai pengganti ${target.participantCode}.`,
      changedBy: actorUserId,
    });
    await tx.insert(auditLogs).values({
      actorUserId,
      action: "PORTAL_DELEGATION_MEMBER_REPLACED",
      resourceType: "EVENT_PARTICIPANT",
      resourceId: created.id,
      eventId: actor.eventId,
      beforeData: { participantId: target.id, ustadzId: target.ustadzId },
      afterData: { participantId: created.id, ustadzId: profile.id, email: normalizedEmail },
      reason: payload.reason,
      requestId,
    });

    return {
      participantId: created.id,
      participantCode: created.participantCode,
      fullName: profile.fullName,
      email: profile.email,
      approvalStatus: created.approvalStatus,
      confirmationStatus: created.confirmationStatus,
      accountNeedsActivation: !user.passwordHash,
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
        eq(eventParticipants.approvalStatus, "APPROVED"),
        notInArray(eventParticipants.confirmationStatus, ["CANCELLED", "REPLACED"]),
      )
    );

  return res[0]?.total || 0;
}

export async function countApprovedParticipantsBySourceRepository(eventId: string, regular: boolean): Promise<number> {
  const db = getDbClient();
  const sources = regular ? ["DIRECT_PUBLIC", "DIRECT_ADMIN_UPLOAD", "ADMIN_ENTRY"] : ["INSTITUTION_DELEGATION", "INSTITUTION_INVITATION", "INSTITUTION_DELEGATION_REPLACEMENT", "INDIVIDUAL_INVITATION"];
  const result = await db
    .select({ total: count() })
    .from(eventParticipants)
    .where(and(
      eq(eventParticipants.eventId, eventId),
      eq(eventParticipants.approvalStatus, "APPROVED"),
      notInArray(eventParticipants.confirmationStatus, ["CANCELLED", "REPLACED"]),
      inArray(eventParticipants.registrationSource, sources),
    ));
  return result[0]?.total || 0;
}

export async function updateParticipantApprovalStatusRepository(
  participantId: string,
  toApprovalStatus: string,
  reason?: string | null,
  changedBy?: string | null
) {
  const hint = await findParticipantByIdRepository(participantId);
  if (!hint) throw new NotFoundError("Peserta tidak ditemukan.");
  return withTransaction(async (tx) => {
    const event = await lockRegistrationEvent(tx, hint.eventId);
    const [existing] = await tx.select().from(eventParticipants).where(eq(eventParticipants.id, participantId)).limit(1).for("update");
    if (!existing) throw new NotFoundError("Peserta tidak ditemukan.");
    if (!["INVITED", "CONFIRMED"].includes(existing.confirmationStatus)) throw new ConflictError("Peserta sudah dibatalkan atau diganti.");
    if (existing.approvalStatus === toApprovalStatus) return existing;
    if (["DECLINED", "REJECTED"].includes(existing.approvalStatus)) throw new ConflictError("Peserta sudah ditolak. Tinjau data melalui pengelola sebelum mendaftar ulang.");
    if (!["APPROVED", "WAITLISTED", "DECLINED", "REJECTED", "PENDING_REVIEW"].includes(toApprovalStatus)) throw new ValidationError("Status persetujuan tidak valid.");
    if (toApprovalStatus === "APPROVED") await assertRegistrationCapacity(tx, event, existing.registrationSource, 1);
    const [updated] = await tx.update(eventParticipants).set({ approvalStatus: toApprovalStatus,
      approvedAt: toApprovalStatus === "APPROVED" ? new Date() : existing.approvedAt,
      ...(toApprovalStatus === "APPROVED" ? { approvedBy: changedBy || null } : {}),
      ...(existing.approvalStatus === "APPROVED" || toApprovalStatus === "APPROVED"
        ? { qrTokenVersion: sql`${eventParticipants.qrTokenVersion} + 1`, qrIssuedAt: null } : {}), updatedAt: new Date(),
    }).where(eq(eventParticipants.id, participantId)).returning();
    await tx.insert(participantStatusHistories).values({ participantId, statusType: "APPROVAL_STATUS", fromStatus: existing.approvalStatus,
      toStatus: toApprovalStatus, reason: reason || null, changedBy: changedBy || null });
    return updated;
  });
}

export async function findReplacementCandidatesRepository(eventId: string, search: string) {
  const db = getDbClient();
  const registered = db.select({ id: eventParticipants.id }).from(eventParticipants)
    .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.ustadzId, ustadzProfiles.id)));
  return db.select({ id: ustadzProfiles.id, fullName: ustadzProfiles.fullName, email: ustadzProfiles.email })
    .from(ustadzProfiles).where(and(eq(ustadzProfiles.profileStatus, "ACTIVE"), isNull(ustadzProfiles.deletedAt), isNull(ustadzProfiles.mergedIntoId),
      or(ilike(ustadzProfiles.fullName, `%${search}%`), ilike(ustadzProfiles.email, `%${search}%`)), notExists(registered)))
    .orderBy(asc(ustadzProfiles.fullName), asc(ustadzProfiles.id)).limit(20);
}
