import { getDbClient } from "../db/client";
import { randomBytes } from "node:crypto";
import {
  invitations,
  invitationLinks,
  invitationResponses,
  institutions,
  events,
  ustadzProfiles,
  ustadzInstitutionAffiliations,
  eventParticipants,
  roles,
  userRoleAssignments,
  users,
} from "../db/schema";
import { eq, and, desc, sql, isNull, ne, inArray, notInArray, ilike, asc, or } from "drizzle-orm";
import { normalizeEmail, normalizeName, normalizePhone } from "../utils/normalization";
import { withTransaction } from "../db/transaction";
import { resolveRegistrationInstitution } from "../services/registrationInstitutionService";
import { hashPassword } from "../utils/password";
import { canIssueImmediatePassword, generateMemorableTemporaryPassword } from "../utils/memorablePassword";
import { ConflictError, ForbiddenError, NotFoundError } from "../utils/errors";
import { lockRegistrationEvent, assertRegistrationCapacity } from "../services/registrationCapacity";
import { initialParticipantReviewState } from "../services/registrationReviewState";

export async function findInvitationsRepository(eventId?: string) {
  const db = getDbClient();
  const conditions = [];
  if (eventId) {
    conditions.push(eq(invitations.eventId, eventId));
  }

  return await db
    .select({
      id: invitations.id,
      eventId: invitations.eventId,
      eventName: events.name,
      invitationType: invitations.invitationType,
      registrationMode: invitations.registrationMode,
      institutionId: invitations.institutionId,
      institutionName: institutions.name,
      institutionCode: institutions.code,
      institutionEmail: institutions.email,
      institutionWhatsapp: institutions.whatsapp,
      institutionPhone: institutions.phone,
      ustadzId: invitations.ustadzId,
      ustadzName: ustadzProfiles.fullName,
      ustadzEmail: ustadzProfiles.email,
      ustadzWhatsapp: ustadzProfiles.whatsapp,
      ustadzPhone: ustadzProfiles.phone,
      invitationNumber: invitations.invitationNumber,
      quota: invitations.quota,
      status: invitations.status,
      sentAt: invitations.sentAt,
      respondedAt: invitations.respondedAt,
      responseDeadline: invitations.responseDeadline,
      updatedAt: invitations.updatedAt,
      eventResponseDeadline: events.invitationResponseDeadline,
      registeredCount: sql<number>`(select count(*)::int from event_participants p where p.invitation_id = ${invitations.id} and p.confirmation_status not in ('CANCELLED', 'REPLACED') and p.approval_status not in ('REJECTED', 'DECLINED'))`,
      responseNotes: sql<string | null>`(select r.notes from invitation_responses r where r.invitation_id = ${invitations.id} order by r.created_at desc limit 1)`,
    })
    .from(invitations)
    .innerJoin(events, eq(invitations.eventId, events.id))
    .leftJoin(institutions, eq(invitations.institutionId, institutions.id))
    .leftJoin(ustadzProfiles, eq(invitations.ustadzId, ustadzProfiles.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(invitations.createdAt));
}

export async function findInvitationUstadzOptionsRepository(search: string, page: number, pageSize: number) {
  const db = getDbClient();
  const term = search.trim().replace(/[\\%_]/g, "\\$&");
  const conditions = [eq(ustadzProfiles.profileStatus, "ACTIVE"), isNull(ustadzProfiles.deletedAt),
    isNull(ustadzProfiles.mergedIntoId)];
  if (term) {
    const pattern = `%${term}%`;
    conditions.push(or(ilike(ustadzProfiles.fullName, pattern), ilike(ustadzProfiles.email, pattern),
      ilike(ustadzProfiles.whatsapp, pattern), ilike(ustadzProfiles.phone, pattern))!);
  }
  return db.select({ id: ustadzProfiles.id, fullName: ustadzProfiles.fullName, email: ustadzProfiles.email,
    whatsapp: ustadzProfiles.whatsapp, phone: ustadzProfiles.phone })
    .from(ustadzProfiles).where(and(...conditions)).orderBy(asc(ustadzProfiles.fullName))
    .limit(pageSize).offset((page - 1) * pageSize);
}

export async function findInvitationUstadzRecipientRepository(id: string) {
  const [recipient] = await getDbClient().select({ id: ustadzProfiles.id, fullName: ustadzProfiles.fullName,
    email: ustadzProfiles.email, whatsapp: ustadzProfiles.whatsapp, phone: ustadzProfiles.phone,
    profileStatus: ustadzProfiles.profileStatus, deletedAt: ustadzProfiles.deletedAt,
    mergedIntoId: ustadzProfiles.mergedIntoId }).from(ustadzProfiles).where(eq(ustadzProfiles.id, id)).limit(1);
  return recipient || null;
}

export async function findOpenIndividualInvitationRepository(eventId: string, ustadzId: string, exceptId?: string) {
  const [invitation] = await getDbClient().select({ id: invitations.id, invitationNumber: invitations.invitationNumber })
    .from(invitations).where(and(eq(invitations.eventId, eventId), eq(invitations.ustadzId, ustadzId),
      eq(invitations.invitationType, "INDIVIDUAL"), inArray(invitations.status, ["DRAFT", "SENT", "OPENED"]),
      ...(exceptId ? [ne(invitations.id, exceptId)] : []))).limit(1);
  return invitation || null;
}

export async function findUstadzEventParticipationRepository(eventId: string, ustadzId: string) {
  const [participant] = await getDbClient().select({ id: eventParticipants.id })
    .from(eventParticipants).where(and(eq(eventParticipants.eventId, eventId),
      eq(eventParticipants.ustadzId, ustadzId))).limit(1);
  return participant || null;
}

export async function findInvitationByEventAndNumberRepository(eventId: string, invitationNumber: string) {
  const db = getDbClient();
  const found = await db
    .select({ id: invitations.id, status: invitations.status })
    .from(invitations)
    .where(and(eq(invitations.eventId, eventId), eq(invitations.invitationNumber, invitationNumber)))
    .limit(1);
  return found[0] || null;
}

export async function saveInstitutionDelegationRepository(
  invitationId: string,
  payload: {
    responseStatus: "ACCEPTED" | "DECLINED";
    notes?: string | null;
    institutionName?: string | null;
    isFinal: boolean;
    delegates?: Array<{
      fullName: string;
      email?: string | null;
      phone?: string | null;
      whatsapp?: string | null;
      address?: string | null;
      city?: string;
      province?: string;
      cityCode?: string | null;
      provinceCode?: string | null;
      isLead?: boolean;
    }>;
  },
  context: { eventId: string; tokenHash: string },
) {
  return await withTransaction(async (tx) => {
    const event = await lockRegistrationEvent(tx, context.eventId);
    const invitationRows = await tx
      .select()
      .from(invitations)
      .where(eq(invitations.id, invitationId))
      .limit(1).for("update");
    const invitation = invitationRows[0];
    if (!invitation || invitation.eventId !== context.eventId) throw new NotFoundError("Undangan tidak ditemukan pada event ini.");
    const selfRegistration = invitation.invitationType === "INSTITUTION" && invitation.registrationMode === "INDIVIDUAL_SELF";
    if (["ACCEPTED", "DECLINED", "REVOKED"].includes(invitation.status)) {
      throw new ConflictError("Undangan sudah dijawab atau dicabut. Muat ulang formulir.");
    }
    if (selfRegistration && (!payload.isFinal || payload.responseStatus !== "ACCEPTED" || payload.delegates?.length !== 1)) {
      throw new ConflictError("Tautan ini untuk pendaftaran mandiri satu asatidz. Isi data diri Anda dan kirim secara final.");
    }
    const limit = invitation.invitationType === "INDIVIDUAL" || selfRegistration ? 1 : invitation.quota || 1;
    if ((payload.delegates?.length || 0) > limit) throw new ConflictError(`Kuota undangan telah berubah. Maksimal ${limit} peserta.`);
    if (selfRegistration) {
      const [usage] = await tx.select({ total: sql<number>`count(*)::int` }).from(eventParticipants)
        .where(and(eq(eventParticipants.invitationId, invitationId),
          notInArray(eventParticipants.confirmationStatus, ["CANCELLED", "REPLACED"]),
          notInArray(eventParticipants.approvalStatus, ["REJECTED", "DECLINED"])));
      if (Number(usage?.total || 0) >= (invitation.quota || 1)) {
        throw new ConflictError("Kuota undangan lembaga sudah penuh. Hubungi panitia jika membutuhkan bantuan.");
      }
    }
    const [link] = await tx.select().from(invitationLinks).where(and(eq(invitationLinks.invitationId, invitationId),
      eq(invitationLinks.tokenHash, context.tokenHash), isNull(invitationLinks.revokedAt))).limit(1).for("update");
    const deadline = invitation.responseDeadline || event.invitationResponseDeadline;
    if (!link || link.expiresAt && link.expiresAt < new Date() || deadline && deadline < new Date() || event.status === "DRAFT") {
      throw new ForbiddenError("Tautan sudah dicabut, kedaluwarsa, atau event tidak menerima konfirmasi.");
    }
    if (payload.isFinal && payload.responseStatus === "ACCEPTED") {
      await assertRegistrationCapacity(tx, event, selfRegistration ? "INSTITUTION_INVITATION" : "INSTITUTION_DELEGATION", payload.delegates?.length || 0);
    }
    const participantInstitutionId = payload.isFinal && payload.responseStatus === "ACCEPTED"
      ? invitation.institutionId || await resolveRegistrationInstitution(tx, payload.institutionName)
      : invitation.institutionId;

    const responseRows = await tx
      .insert(invitationResponses)
      .values({
        invitationId,
        responseStatus: payload.responseStatus,
        notes: payload.notes || null,
        isFinal: payload.isFinal,
        submittedAt: new Date(),
      })
      .returning();

    const participantRows: Array<typeof eventParticipants.$inferSelect> = [];
    const portalCredentials: Array<{ participantId: string; temporaryPassword: string | null; passwordSetupRequired: boolean }> = [];
    if (payload.isFinal && payload.responseStatus === "ACCEPTED") {
      for (const delegate of payload.delegates || []) {
        const normalizedName = normalizeName(delegate.fullName);
        const normalizedEmail = normalizeEmail(delegate.email);
        const normalizedPhone = normalizePhone(delegate.phone);
        const normalizedWhatsapp = normalizePhone(delegate.whatsapp || delegate.phone);
        // Only an individual invitation targets a known profile. A public delegate
        // cannot choose another profile by sending a UUID or by sharing a name.
        let ustadzId = invitation.invitationType === "INDIVIDUAL" ? invitation.ustadzId : null;
        let createdNewProfile = false;
        if (!ustadzId) {
          const matches = normalizedEmail ? await tx
            .select({ id: ustadzProfiles.id, normalizedName: ustadzProfiles.normalizedName })
            .from(ustadzProfiles)
            .where(eq(ustadzProfiles.email, normalizedEmail))
            .limit(2) : [];
          if (matches.length > 1) throw new ConflictError(`Email ${normalizedEmail} terhubung ke beberapa profil. Hubungi panitia.`);
          if (matches[0] && matches[0].normalizedName !== normalizedName) {
            throw new ConflictError(`Nama untuk ${normalizedEmail} tidak cocok dengan profil yang sudah ada. Hubungi panitia.`);
          }
          ustadzId = matches[0]?.id || null;
          if (!ustadzId) {
            const created = await tx
              .insert(ustadzProfiles)
              .values({
                fullName: delegate.fullName.trim(),
                normalizedName,
                email: normalizedEmail,
                phone: normalizedPhone,
                whatsapp: normalizedWhatsapp,
                address: delegate.address?.trim() || null,
                cityCode: delegate.cityCode || delegate.city?.trim() || null,
                provinceCode: delegate.provinceCode || delegate.province?.trim() || null,
                profileStatus: "ACTIVE",
              })
              .returning({ id: ustadzProfiles.id });
            ustadzId = created[0].id;
            createdNewProfile = true;
          }
        }

        const existingProfile = (await tx.select().from(ustadzProfiles).where(eq(ustadzProfiles.id, ustadzId)).limit(1))[0];
        if (!existingProfile || normalizeName(existingProfile.fullName) !== normalizedName ||
          existingProfile.email && normalizeEmail(existingProfile.email) !== normalizedEmail ||
          existingProfile?.deletedAt || existingProfile?.mergedIntoId || existingProfile?.profileStatus !== "ACTIVE") {
          throw new ConflictError(`Identitas ${delegate.fullName} tidak cocok dengan profil asatidz. Hubungi panitia.`);
        }
        const alreadyRegistered = await tx.select({ id: eventParticipants.id }).from(eventParticipants)
          .where(and(eq(eventParticipants.eventId, invitation.eventId), eq(eventParticipants.ustadzId, ustadzId))).limit(1);
        if (alreadyRegistered.length) throw new ConflictError(`${delegate.fullName} sudah terdaftar pada event ini. Hubungi panitia; data pendaftaran lama tidak diubah.`);
        // Existing contact details are owned by the profile holder, not by a public invitation form.
        if (!existingProfile.email && normalizedEmail) {
          await tx.update(ustadzProfiles).set({ email: normalizedEmail, updatedAt: new Date() })
            .where(eq(ustadzProfiles.id, ustadzId));
        }

        let issuedPassword: string | null = null;
        let passwordSetupRequired = true;
        if (normalizedEmail) {
          const currentProfile = (
            await tx.select().from(ustadzProfiles).where(eq(ustadzProfiles.id, ustadzId)).limit(1)
          )[0];
          let portalUser = currentProfile?.userId
            ? (await tx.select().from(users).where(eq(users.id, currentProfile.userId)).limit(1))[0]
            : (await tx.select().from(users).where(eq(users.email, normalizedEmail)).limit(1))[0];
          if (portalUser && normalizeEmail(portalUser.email) !== normalizedEmail) {
            throw new ConflictError(`Email akun ${delegate.fullName} berbeda dengan data undangan. Hubungi panitia.`);
          }
          if (portalUser && portalUser.status !== "ACTIVE") throw new ConflictError("Akun peserta tidak aktif. Hubungi panitia.");
          if (portalUser && !currentProfile?.userId) {
            const linked = (await tx.select({ id: ustadzProfiles.id }).from(ustadzProfiles)
              .where(eq(ustadzProfiles.userId, portalUser.id)).limit(1))[0];
            if (linked && linked.id !== ustadzId) {
              throw new ConflictError(`Email ${normalizedEmail} sudah digunakan profil asatidz lain. Hubungi panitia.`);
            }
          }
          if (!portalUser) {
            // The invitation bearer can receive a password only for an entirely new identity.
            issuedPassword = canIssueImmediatePassword(false, !createdNewProfile)
              ? generateMemorableTemporaryPassword() : null;
            portalUser = (
              await tx
                .insert(users)
                .values({ email: normalizedEmail, name: delegate.fullName.trim(),
                  ...(issuedPassword ? { passwordHash: hashPassword(issuedPassword) } : {}), status: "ACTIVE" })
                .returning()
            )[0];
          }
          passwordSetupRequired = !portalUser.passwordHash;
          if (!currentProfile?.userId) {
            await tx
              .update(ustadzProfiles)
              .set({ userId: portalUser.id, updatedAt: new Date() })
              .where(eq(ustadzProfiles.id, ustadzId));
          }
          const ustadzRole = (
            await tx.select().from(roles).where(eq(roles.code, "USTADZ")).limit(1)
          )[0];
          if (ustadzRole) {
            const assignment = await tx
              .select({ id: userRoleAssignments.id })
              .from(userRoleAssignments)
              .where(
                and(
                  eq(userRoleAssignments.userId, portalUser.id),
                  eq(userRoleAssignments.roleId, ustadzRole.id),
                  eq(userRoleAssignments.eventId, invitation.eventId),
                ),
              )
              .limit(1);
            if (!assignment[0]) {
              await tx.insert(userRoleAssignments).values({
                userId: portalUser.id,
                roleId: ustadzRole.id,
                eventId: invitation.eventId,
                institutionId: invitation.institutionId,
              });
            }
          }
        }

        if (participantInstitutionId) {
          const existingAffiliation = await tx
            .select({ id: ustadzInstitutionAffiliations.id })
            .from(ustadzInstitutionAffiliations)
            .where(
              and(
                eq(ustadzInstitutionAffiliations.ustadzId, ustadzId),
                eq(ustadzInstitutionAffiliations.institutionId, participantInstitutionId)
              )
            )
            .limit(1);
          if (existingAffiliation.length === 0) {
            await tx.insert(ustadzInstitutionAffiliations).values({
              ustadzId,
              institutionId: participantInstitutionId,
              isPrimary: !selfRegistration && Boolean(delegate.isLead),
              status: "ACTIVE",
            });
          }
        }

        const code: string = `P-${randomBytes(4).toString("hex").toUpperCase()}`;
        const createdParticipant: Array<typeof eventParticipants.$inferSelect> = await tx
          .insert(eventParticipants)
          .values({
            eventId: invitation.eventId,
            ustadzId,
            institutionId: participantInstitutionId,
            invitationId,
            registrationSource: invitation.invitationType === "INDIVIDUAL" ? "INDIVIDUAL_INVITATION" : selfRegistration ? "INSTITUTION_INVITATION" : "INSTITUTION_DELEGATION",
            participantCode: code,
            isDelegationLead: !selfRegistration && Boolean(delegate.isLead),
            ...initialParticipantReviewState(event.attendanceConfirmationRequired),
          })
          .onConflictDoNothing({ target: [eventParticipants.eventId, eventParticipants.ustadzId] })
          .returning();
        if (!createdParticipant[0]) throw new ConflictError(`${delegate.fullName} baru saja didaftarkan. Hubungi panitia.`);
        participantRows.push(createdParticipant[0]);
        portalCredentials.push({ participantId: createdParticipant[0].id, temporaryPassword: issuedPassword, passwordSetupRequired });
      }
    }

    await tx
      .update(invitations)
      .set({
        status: selfRegistration ? "OPENED" : payload.isFinal
          ? payload.responseStatus === "ACCEPTED"
            ? "ACCEPTED"
            : "DECLINED"
          : "OPENED",
        respondedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(invitations.id, invitationId));

    return { response: responseRows[0], participants: participantRows, portalCredentials };
  });
}

export async function findInvitationByIdRepository(id: string) {
  const db = getDbClient();
  const found = await db.select().from(invitations).where(eq(invitations.id, id)).limit(1);
  return found[0] || null;
}

export async function markInvitationOpenedRepository(id: string) {
  await getDbClient().update(invitations).set({ status: "OPENED", updatedAt: new Date() })
    .where(and(eq(invitations.id, id), inArray(invitations.status, ["DRAFT", "SENT"])));
}

export async function countInvitationParticipantsRepository(id: string) {
  const rows = await getDbClient().select({ total: sql<number>`count(*)::int` }).from(eventParticipants)
    .where(and(eq(eventParticipants.invitationId, id),
      notInArray(eventParticipants.confirmationStatus, ["CANCELLED", "REPLACED"]),
      notInArray(eventParticipants.approvalStatus, ["REJECTED", "DECLINED"])));
  return Number(rows[0]?.total || 0);
}

export async function updateInvitationRepository(
  existing: typeof invitations.$inferSelect,
  changes: Partial<typeof invitations.$inferInsert>,
  replacementLink?: { tokenHash: string; expiresAt: Date | null },
) {
  return withTransaction(async (tx) => {
    await lockRegistrationEvent(tx, existing.eventId);
    if (existing.registrationMode === "INDIVIDUAL_SELF" && changes.quota != null) {
      const [usage] = await tx.select({ total: sql<number>`count(*)::int` }).from(eventParticipants)
        .where(and(eq(eventParticipants.invitationId, existing.id),
          notInArray(eventParticipants.confirmationStatus, ["CANCELLED", "REPLACED"]),
          notInArray(eventParticipants.approvalStatus, ["REJECTED", "DECLINED"])));
      if (Number(usage?.total || 0) > changes.quota) {
        throw new ConflictError("Kuota berubah saat formulir dibuka. Muat ulang; kuota tidak boleh di bawah jumlah pendaftar aktif.");
      }
    }
    if (existing.invitationType === "INDIVIDUAL" && changes.ustadzId && changes.ustadzId !== existing.ustadzId) {
      const [pending] = await tx.select({ id: invitations.id }).from(invitations)
        .where(and(eq(invitations.eventId, existing.eventId), eq(invitations.ustadzId, changes.ustadzId),
          eq(invitations.invitationType, "INDIVIDUAL"), inArray(invitations.status, ["DRAFT", "SENT", "OPENED"]),
          ne(invitations.id, existing.id))).limit(1);
      if (pending) throw new ConflictError("Penerima baru saja mendapat undangan aktif. Muat ulang daftar undangan.");
      const [participant] = await tx.select({ id: eventParticipants.id }).from(eventParticipants)
        .where(and(eq(eventParticipants.eventId, existing.eventId), eq(eventParticipants.ustadzId, changes.ustadzId))).limit(1);
      if (participant) throw new ConflictError("Penerima baru saja terdaftar pada event. Lihat data peserta.");
    }
    const rows = await tx.update(invitations).set({ ...changes, updatedAt: new Date() })
      .where(and(eq(invitations.id, existing.id), eq(invitations.eventId, existing.eventId),
        sql`date_trunc('milliseconds', ${invitations.updatedAt}) = ${existing.updatedAt.toISOString()}::timestamptz`,
        eq(invitations.status, existing.status))).returning();
    if (!rows[0]) throw new ConflictError("Undangan telah berubah. Muat ulang sebelum menyimpan kembali.");
    if (replacementLink) {
      await tx.update(invitationLinks).set({ revokedAt: new Date() })
        .where(and(eq(invitationLinks.invitationId, existing.id), isNull(invitationLinks.revokedAt)));
      await tx.insert(invitationLinks).values({ invitationId: existing.id, ...replacementLink });
    } else if ("responseDeadline" in changes) {
      await tx.update(invitationLinks).set({ expiresAt: changes.responseDeadline || (existing.registrationMode === "INDIVIDUAL_SELF" ? null : new Date(Date.now() + 14 * 86400000)) })
        .where(and(eq(invitationLinks.invitationId, existing.id), isNull(invitationLinks.revokedAt)));
    }
    return rows[0];
  });
}

export async function findInvitationByTokenHashRepository(tokenHash: string) {
  const db = getDbClient();

  const link = await db
    .select()
    .from(invitationLinks)
    .where(eq(invitationLinks.tokenHash, tokenHash))
    .limit(1);

  if (link.length === 0) return null;

  const inv = await db
    .select({
      invitation: invitations,
      event: events,
      institution: institutions,
    })
    .from(invitations)
    .innerJoin(events, eq(invitations.eventId, events.id))
    .leftJoin(institutions, eq(invitations.institutionId, institutions.id))
    .where(eq(invitations.id, link[0].invitationId))
    .limit(1);

  if (inv.length === 0) return null;

  // Update last accessed time & use count
  await db
    .update(invitationLinks)
    .set({
      lastAccessedAt: new Date(),
      usedCount: sql`${invitationLinks.usedCount} + 1`,
    })
    .where(eq(invitationLinks.id, link[0].id));

  return {
    link: link[0],
    invitation: inv[0].invitation,
    event: inv[0].event,
    institution: inv[0].institution,
  };
}

/** Policy revalidation is intentionally read-only (no usedCount/status/audit writes). */
export async function findInvitationPolicyByTokenHashRepository(tokenHash: string) {
  const [result] = await getDbClient().select({
    link: { revokedAt: invitationLinks.revokedAt, expiresAt: invitationLinks.expiresAt },
    invitation: { id: invitations.id, invitationType: invitations.invitationType, registrationMode: invitations.registrationMode, invitationNumber: invitations.invitationNumber,
      quota: invitations.quota, status: invitations.status, responseDeadline: invitations.responseDeadline, updatedAt: invitations.updatedAt },
    event: { id: events.id, status: events.status, invitationResponseDeadline: events.invitationResponseDeadline },
  }).from(invitationLinks).innerJoin(invitations, eq(invitations.id, invitationLinks.invitationId))
    .innerJoin(events, eq(events.id, invitations.eventId)).where(eq(invitationLinks.tokenHash, tokenHash)).limit(1);
  return result || null;
}

export async function createInvitationRepository(
  invData: typeof invitations.$inferInsert,
  tokenHash: string
) {
  return withTransaction(async (tx) => {
    if (invData.invitationType === "INDIVIDUAL" && invData.ustadzId) {
      // Registration writers use the same event-row lock. Recheck inside it so
      // two admins cannot issue live personal links to one recipient concurrently.
      await lockRegistrationEvent(tx, invData.eventId);
      const [pending] = await tx.select({ id: invitations.id }).from(invitations)
        .where(and(eq(invitations.eventId, invData.eventId), eq(invitations.ustadzId, invData.ustadzId),
          eq(invitations.invitationType, "INDIVIDUAL"), inArray(invitations.status, ["DRAFT", "SENT", "OPENED"]))).limit(1);
      if (pending) throw new ConflictError("Asatidz ini baru saja mendapat undangan aktif. Muat ulang daftar undangan.");
      const [participant] = await tx.select({ id: eventParticipants.id }).from(eventParticipants)
        .where(and(eq(eventParticipants.eventId, invData.eventId), eq(eventParticipants.ustadzId, invData.ustadzId))).limit(1);
      if (participant) throw new ConflictError("Asatidz ini baru saja terdaftar pada event. Lihat data peserta.");
    }
    const createdInv = await tx.insert(invitations).values(invData).returning();
    const createdLink = await tx
      .insert(invitationLinks)
      .values({
        invitationId: createdInv[0].id,
        tokenHash,
        expiresAt: invData.responseDeadline
          ? new Date(invData.responseDeadline)
          : invData.registrationMode === "INDIVIDUAL_SELF" ? null : new Date(Date.now() + 14 * 86400000),
      })
      .returning();

    return {
      invitation: createdInv[0],
      link: createdLink[0],
    };
  });
}

export async function rotateInvitationLinkRepository(
  invitationId: string,
  tokenHash: string,
  expiresAt: Date | null,
) {
  const hint = await findInvitationByIdRepository(invitationId);
  if (!hint) throw new NotFoundError("Undangan tidak ditemukan.");
  return await withTransaction(async (tx) => {
    await lockRegistrationEvent(tx, hint.eventId);
    const [current] = await tx.select().from(invitations).where(eq(invitations.id, invitationId)).limit(1).for("update");
    if (!current || !["DRAFT", "SENT", "OPENED"].includes(current.status)) throw new ConflictError("Undangan sudah final atau dicabut.");
    const created = await tx
      .insert(invitationLinks)
      .values({
        invitationId,
        tokenHash,
        expiresAt,
      })
      .returning();

    await tx
      .update(invitationLinks)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(invitationLinks.invitationId, invitationId),
          ne(invitationLinks.id, created[0].id),
          isNull(invitationLinks.revokedAt),
        ),
      );

    return created[0];
  });
}

export async function updateInvitationStatusRepository(id: string, status: string, extra: Record<string, any> = {}) {
  const hint = await findInvitationByIdRepository(id);
  if (!hint) throw new NotFoundError("Undangan tidak ditemukan.");
  return withTransaction(async (tx) => {
    await lockRegistrationEvent(tx, hint.eventId);
    const [current] = await tx.select().from(invitations).where(eq(invitations.id, id)).limit(1).for("update");
    if (!current || !["DRAFT", "SENT", "OPENED"].includes(current.status)) throw new ConflictError("Undangan sudah final atau dicabut.");
    const [updated] = await tx.update(invitations).set({ ...extra,
      status: status === "SENT" && current.status === "OPENED" ? "OPENED" : status, updatedAt: new Date(),
    }).where(eq(invitations.id, id)).returning();
    return updated;
  });
}

export async function saveInvitationResponseRepository(
  invitationId: string,
  responseStatus: string,
  notes?: string | null,
  isFinal = false
) {
  const db = getDbClient();
  const created = await db
    .insert(invitationResponses)
    .values({
      invitationId,
      responseStatus,
      notes: notes || null,
      isFinal,
      submittedAt: new Date(),
    })
    .returning();

  await db
    .update(invitations)
    .set({
      status: responseStatus === "ACCEPTED" ? "ACCEPTED" : "DECLINED",
      respondedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(invitations.id, invitationId));

  return created[0];
}
