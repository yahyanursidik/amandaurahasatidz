import { getDbClient } from "../db/client";
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
import { eq, and, desc, sql, or, isNull } from "drizzle-orm";
import { normalizeEmail, normalizeName, normalizePhone } from "../utils/normalization";
import { withTransaction } from "../db/transaction";

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
      institutionId: invitations.institutionId,
      institutionName: institutions.name,
      invitationNumber: invitations.invitationNumber,
      quota: invitations.quota,
      status: invitations.status,
      sentAt: invitations.sentAt,
      respondedAt: invitations.respondedAt,
      responseDeadline: invitations.responseDeadline,
    })
    .from(invitations)
    .innerJoin(events, eq(invitations.eventId, events.id))
    .leftJoin(institutions, eq(invitations.institutionId, institutions.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(invitations.createdAt));
}

export async function saveInstitutionDelegationRepository(
  invitationId: string,
  payload: {
    responseStatus: "ACCEPTED" | "DECLINED";
    notes?: string | null;
    isFinal: boolean;
    delegates?: Array<{
      existingProfileId?: string | null;
      fullName: string;
      email?: string | null;
      phone?: string | null;
      whatsapp?: string | null;
      address?: string | null;
      isLead?: boolean;
    }>;
  }
) {
  return await withTransaction(async (tx) => {
    const invitationRows = await tx
      .select()
      .from(invitations)
      .where(eq(invitations.id, invitationId))
      .limit(1);
    const invitation = invitationRows[0];
    if (!invitation) throw new Error("Undangan tidak ditemukan.");

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
    if (payload.isFinal && payload.responseStatus === "ACCEPTED") {
      for (const delegate of payload.delegates || []) {
        const normalizedName = normalizeName(delegate.fullName);
        const normalizedEmail = normalizeEmail(delegate.email);
        const normalizedPhone = normalizePhone(delegate.phone);
        const normalizedWhatsapp = normalizePhone(delegate.whatsapp || delegate.phone);
        let ustadzId = delegate.existingProfileId || null;
        if (!ustadzId) {
          const matches = await tx
            .select({ id: ustadzProfiles.id })
            .from(ustadzProfiles)
            .where(
              or(
                eq(ustadzProfiles.normalizedName, normalizedName),
                ...(normalizedEmail ? [eq(ustadzProfiles.email, normalizedEmail)] : []),
                ...(normalizedPhone ? [eq(ustadzProfiles.phone, normalizedPhone)] : [])
              )
            )
            .limit(1);
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
                profileStatus: "ACTIVE",
              })
              .returning({ id: ustadzProfiles.id });
            ustadzId = created[0].id;
          }
        }

        const submittedContactData: Partial<typeof ustadzProfiles.$inferInsert> = {
          updatedAt: new Date(),
        };
        if (normalizedEmail) submittedContactData.email = normalizedEmail;
        if (normalizedPhone) submittedContactData.phone = normalizedPhone;
        if (normalizedWhatsapp) submittedContactData.whatsapp = normalizedWhatsapp;
        if (delegate.address?.trim()) submittedContactData.address = delegate.address.trim();
        await tx
          .update(ustadzProfiles)
          .set(submittedContactData)
          .where(eq(ustadzProfiles.id, ustadzId));

        if (normalizedEmail) {
          const currentProfile = (
            await tx.select().from(ustadzProfiles).where(eq(ustadzProfiles.id, ustadzId)).limit(1)
          )[0];
          let portalUser = currentProfile?.userId
            ? (await tx.select().from(users).where(eq(users.id, currentProfile.userId)).limit(1))[0]
            : (await tx.select().from(users).where(eq(users.email, normalizedEmail)).limit(1))[0];
          if (!portalUser) {
            portalUser = (
              await tx
                .insert(users)
                .values({ email: normalizedEmail, name: delegate.fullName.trim(), status: "ACTIVE" })
                .returning()
            )[0];
          }
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

        if (invitation.institutionId) {
          const existingAffiliation = await tx
            .select({ id: ustadzInstitutionAffiliations.id })
            .from(ustadzInstitutionAffiliations)
            .where(
              and(
                eq(ustadzInstitutionAffiliations.ustadzId, ustadzId),
                eq(ustadzInstitutionAffiliations.institutionId, invitation.institutionId)
              )
            )
            .limit(1);
          if (existingAffiliation.length === 0) {
            await tx.insert(ustadzInstitutionAffiliations).values({
              ustadzId,
              institutionId: invitation.institutionId,
              isPrimary: Boolean(delegate.isLead),
              status: "ACTIVE",
            });
          }
        }

        const code: string = `YTS-${invitation.id.slice(0, 6).toUpperCase()}-${ustadzId
          .slice(0, 6)
          .toUpperCase()}`;
        const createdParticipant: Array<typeof eventParticipants.$inferSelect> = await tx
          .insert(eventParticipants)
          .values({
            eventId: invitation.eventId,
            ustadzId,
            institutionId: invitation.institutionId,
            invitationId,
            registrationSource: "INSTITUTION_DELEGATION",
            participantCode: code,
            isDelegationLead: Boolean(delegate.isLead),
            confirmationStatus: "CONFIRMED",
            approvalStatus: "PENDING_REVIEW",
            confirmedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [eventParticipants.eventId, eventParticipants.ustadzId],
            set: {
              institutionId: invitation.institutionId,
              invitationId,
              isDelegationLead: Boolean(delegate.isLead),
              confirmationStatus: "CONFIRMED",
              updatedAt: new Date(),
            },
          })
          .returning();
        participantRows.push(createdParticipant[0]);
      }
    }

    await tx
      .update(invitations)
      .set({
        status: payload.isFinal
          ? payload.responseStatus === "ACCEPTED"
            ? "ACCEPTED"
            : "DECLINED"
          : "OPENED",
        respondedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(invitations.id, invitationId));

    return { response: responseRows[0], participants: participantRows };
  });
}

export async function findInvitationByIdRepository(id: string) {
  const db = getDbClient();
  const found = await db.select().from(invitations).where(eq(invitations.id, id)).limit(1);
  return found[0] || null;
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

export async function createInvitationRepository(
  invData: typeof invitations.$inferInsert,
  tokenHash: string
) {
  const db = getDbClient();

  const createdInv = await db.insert(invitations).values(invData).returning();
  const createdLink = await db
    .insert(invitationLinks)
    .values({
      invitationId: createdInv[0].id,
      tokenHash,
      expiresAt: invData.responseDeadline
        ? new Date(invData.responseDeadline)
        : new Date(Date.now() + 14 * 86400000),
    })
    .returning();

  return {
    invitation: createdInv[0],
    link: createdLink[0],
  };
}

export async function rotateInvitationLinkRepository(
  invitationId: string,
  tokenHash: string,
  expiresAt: Date,
) {
  return await withTransaction(async (tx) => {
    await tx
      .update(invitationLinks)
      .set({ revokedAt: new Date() })
      .where(and(eq(invitationLinks.invitationId, invitationId), isNull(invitationLinks.revokedAt)));

    const created = await tx
      .insert(invitationLinks)
      .values({
        invitationId,
        tokenHash,
        expiresAt,
      })
      .returning();

    return created[0];
  });
}

export async function updateInvitationStatusRepository(id: string, status: string, extra: Record<string, any> = {}) {
  const db = getDbClient();
  const updated = await db
    .update(invitations)
    .set({ status, ...extra, updatedAt: new Date() })
    .where(eq(invitations.id, id))
    .returning();

  return updated[0] || null;
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
