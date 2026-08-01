import { getDbClient } from "../db/client";
import { withTransaction } from "../db/transaction";
import {
  eventParticipants,
  participantStatusHistories,
  ustadzProfiles,
  institutions,
  events,
  auditLogs,
  attendanceRecords,
  roles,
  userRoleAssignments,
  users,
  ustadzInstitutionAffiliations,
} from "../db/schema";
import { eq, and, count, desc, inArray, or, sql } from "drizzle-orm";
import { normalizeEmail, normalizeName, normalizePhone } from "../utils/normalization";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../utils/errors";

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
      registeredAt: eventParticipants.createdAt,
      portalUserId: ustadzProfiles.userId,
      portalAccountStatus: users.status,
      portalPasswordConfigured: sql<boolean>`${users.passwordHash} is not null`,
    })
    .from(eventParticipants)
    .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .leftJoin(institutions, eq(eventParticipants.institutionId, institutions.id))
    .leftJoin(users, eq(ustadzProfiles.userId, users.id))
    .where(eq(eventParticipants.eventId, eventId))
    .orderBy(desc(eventParticipants.createdAt));
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
  return withTransaction(async (tx) => {
    const actorRows = await tx
      .select()
      .from(eventParticipants)
      .where(
        and(
          eq(eventParticipants.id, actorParticipantId),
          eq(eventParticipants.ustadzId, actorUstadzId),
        ),
      )
      .limit(1);
    const actor = actorRows[0];
    if (!actor || !actor.isDelegationLead || !actor.invitationId || !actor.institutionId) {
      throw new ForbiddenError("Hanya kepala rombongan yang dapat mengubah delegasi lembaga ini.");
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
      .limit(1);
    const target = targetRows[0];
    if (!target) throw new NotFoundError("Peserta yang akan diganti tidak ditemukan.");
    if (
      target.eventId !== actor.eventId ||
      target.institutionId !== actor.institutionId ||
      target.invitationId !== actor.invitationId
    ) {
      throw new ForbiddenError("Peserta tersebut bukan anggota rombongan yang Anda kelola.");
    }
    if (["REPLACED", "CANCELLED"].includes(target.confirmationStatus)) {
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

    let profile = (
      await tx
        .select()
        .from(ustadzProfiles)
        .where(
          or(
            eq(ustadzProfiles.email, normalizedEmail),
            eq(ustadzProfiles.userId, user.id),
            eq(ustadzProfiles.normalizedName, normalizedName),
          ),
        )
        .limit(1)
    )[0];
    if (profile?.userId && profile.userId !== user.id) {
      throw new ConflictError("Profil pengganti sudah terhubung ke akun lain. Hubungi administrator.");
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
    } else {
      profile = (
        await tx
          .update(ustadzProfiles)
          .set({
            userId: user.id,
            fullName: payload.fullName.trim(),
            normalizedName,
            email: normalizedEmail,
            phone: normalizedPhone,
            whatsapp: normalizedWhatsapp,
            address: payload.address?.trim() || profile.address,
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
          inArray(eventParticipants.confirmationStatus, ["INVITED", "CONFIRMED", "APPROVED"]),
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
      .set({ confirmationStatus: "REPLACED", cancelledAt: new Date(), updatedAt: new Date() })
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
          confirmationStatus: "CONFIRMED",
          approvalStatus: "PENDING_REVIEW",
          confirmedAt: new Date(),
          replacementForParticipantId: target.id,
          notes: `Pengganti ${target.participantCode}: ${payload.reason}`,
        })
        .returning()
    )[0];

    await tx.insert(participantStatusHistories).values({
      participantId: created.id,
      statusType: "CONFIRMATION_STATUS",
      fromStatus: "INVITED",
      toStatus: "CONFIRMED",
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
