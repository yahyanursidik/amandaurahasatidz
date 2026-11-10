import { getDbClient } from "../db/client";
import { withTransaction } from "../db/transaction";
import {
  institutions,
  institutionRepresentatives,
  invitations,
  invitationResponses,
  eventParticipants,
  events,
  ustadzProfiles,
  ustadzInstitutionAffiliations,
} from "../db/schema";
import { eq, ilike, and, or, isNull, count, desc, sql, inArray, asc } from "drizzle-orm";

/** Minimal master-data picker for event staff, without access to global histories. */
export async function findInvitationInstitutionOptionsRepository(page: number, pageSize: number) {
  const db = getDbClient();
  const rows = await db.select({
    id: institutions.id, code: institutions.code, name: institutions.name,
    email: institutions.email, phone: institutions.phone, whatsapp: institutions.whatsapp,
    address: institutions.address, cityCode: institutions.cityCode, provinceCode: institutions.provinceCode,
  }).from(institutions).where(and(eq(institutions.status, "ACTIVE"), isNull(institutions.deletedAt)))
    .orderBy(asc(institutions.name), asc(institutions.id)).limit(pageSize).offset((page - 1) * pageSize);
  if (!rows.length) return [];
  const representatives = await db.select({ institutionId: institutionRepresentatives.institutionId,
    name: institutionRepresentatives.name, email: institutionRepresentatives.email, phone: institutionRepresentatives.phone,
  }).from(institutionRepresentatives).where(inArray(institutionRepresentatives.institutionId, rows.map((row) => row.id)))
    .orderBy(desc(institutionRepresentatives.isPrimary), desc(institutionRepresentatives.createdAt));
  return rows.map((row) => {
    const contact = representatives.find((representative) => representative.institutionId === row.id);
    return { ...row, contactName: contact?.name || null, email: row.email || contact?.email || null,
      whatsapp: row.whatsapp || row.phone || contact?.phone || null };
  });
}

export interface InstitutionQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  provinceCode?: string;
  cityCode?: string;
  status?: string;
  verificationStatus?: string;
}

export async function findInstitutionsRepository(params: InstitutionQueryParams) {
  const db = getDbClient();
  const page = params.page || 1;
  const pageSize = params.pageSize || 25;
  const offset = (page - 1) * pageSize;

  const conditions = params.status === "INACTIVE" ? [] : [isNull(institutions.deletedAt)];

  if (params.search && params.search.trim() !== "") {
    const searchPattern = `%${params.search.trim()}%`;
    conditions.push(
      or(
        ilike(institutions.name, searchPattern),
        ilike(institutions.code, searchPattern),
        ilike(institutions.email, searchPattern),
        ilike(institutions.phone, searchPattern)
      )!
    );
  }

  if (params.provinceCode) {
    conditions.push(eq(institutions.provinceCode, params.provinceCode));
  }

  if (params.cityCode) {
    conditions.push(eq(institutions.cityCode, params.cityCode));
  }

  if (params.status) {
    conditions.push(eq(institutions.status, params.status));
  }

  if (params.verificationStatus) {
    conditions.push(eq(institutions.verificationStatus, params.verificationStatus));
  }

  const whereClause = and(...conditions);

  const [dataResult, countResult, summaryResult] = await Promise.all([
    db
      .select()
      .from(institutions)
      .where(whereClause)
      .orderBy(desc(institutions.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ total: count() })
      .from(institutions)
      .where(whereClause),
    db
      .select({
        status: institutions.status,
        verificationStatus: institutions.verificationStatus,
        total: count(),
      })
      .from(institutions)
      .groupBy(institutions.status, institutions.verificationStatus),
  ]);

  const total = countResult[0]?.total || 0;
  const pageCount = Math.ceil(total / pageSize);

  return {
    data: dataResult,
    meta: {
      page,
      pageSize,
      total,
      pageCount,
      summary: summaryResult,
    },
  };
}

export async function findInstitutionByCodeRepository(code: string) {
  const db = getDbClient();
  const rows = await db.select({ id: institutions.id }).from(institutions)
    .where(sql`lower(${institutions.code}) = lower(${code})`).limit(1);
  return rows[0] || null;
}

/** PIC mutations only need existence, not the institution's full event history. */
export async function findInstitutionIdentityRepository(id: string) {
  const [institution] = await getDbClient().select({ id: institutions.id }).from(institutions)
    .where(eq(institutions.id, id)).limit(1);
  return institution || null;
}

export async function findInstitutionByIdRepository(id: string) {
  const db = getDbClient();
  const inst = await db
    .select()
    .from(institutions)
    .where(eq(institutions.id, id))
    .limit(1);

  if (inst.length === 0) return null;

  const [reps, invitationHistory, participants, affiliations] = await Promise.all([
    db
      .select()
      .from(institutionRepresentatives)
      .where(eq(institutionRepresentatives.institutionId, id))
      .orderBy(desc(institutionRepresentatives.isPrimary), desc(institutionRepresentatives.createdAt)),
    db
      .select({
        id: invitations.id,
        invitationNumber: invitations.invitationNumber,
        status: invitations.status,
        quota: invitations.quota,
        responseDeadline: invitations.responseDeadline,
        sentAt: invitations.sentAt,
        respondedAt: invitations.respondedAt,
        eventId: events.id,
        eventName: events.name,
        eventCode: events.code,
        eventStartDate: events.startDate,
        eventStatus: events.status,
        responseStatus: invitationResponses.responseStatus,
        responseSubmittedAt: invitationResponses.submittedAt,
      })
      .from(invitations)
      .innerJoin(events, eq(invitations.eventId, events.id))
      .leftJoin(invitationResponses, and(eq(invitationResponses.invitationId, invitations.id), eq(invitationResponses.isFinal, true)))
      .where(eq(invitations.institutionId, id))
      .orderBy(desc(events.startDate)),
    db
      .select({
        id: eventParticipants.id,
        participantCode: eventParticipants.participantCode,
        confirmationStatus: eventParticipants.confirmationStatus,
        approvalStatus: eventParticipants.approvalStatus,
        registrationSource: eventParticipants.registrationSource,
        invitationId: eventParticipants.invitationId,
        isDelegationLead: eventParticipants.isDelegationLead,
        eventId: events.id,
        eventName: events.name,
        eventStartDate: events.startDate,
        ustadzId: ustadzProfiles.id,
        ustadzName: ustadzProfiles.fullName,
        ustadzEmail: ustadzProfiles.email,
      })
      .from(eventParticipants)
      .innerJoin(events, eq(eventParticipants.eventId, events.id))
      .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
      .where(eq(eventParticipants.institutionId, id))
      .orderBy(desc(events.startDate), ustadzProfiles.fullName),
    db
      .select({
        id: ustadzInstitutionAffiliations.id,
        position: ustadzInstitutionAffiliations.position,
        isPrimary: ustadzInstitutionAffiliations.isPrimary,
        status: ustadzInstitutionAffiliations.status,
        verifiedAt: ustadzInstitutionAffiliations.verifiedAt,
        ustadzId: ustadzProfiles.id,
        ustadzName: ustadzProfiles.fullName,
        ustadzEmail: ustadzProfiles.email,
        ustadzPhone: ustadzProfiles.phone,
      })
      .from(ustadzInstitutionAffiliations)
      .innerJoin(ustadzProfiles, eq(ustadzInstitutionAffiliations.ustadzId, ustadzProfiles.id))
      .where(eq(ustadzInstitutionAffiliations.institutionId, id))
      .orderBy(desc(ustadzInstitutionAffiliations.isPrimary), ustadzProfiles.fullName),
  ]);

  return {
    ...inst[0],
    representatives: reps,
    invitationHistory,
    participants,
    affiliations,
    relationSummary: {
      representativeCount: reps.length,
      invitationCount: invitationHistory.length,
      participantCount: participants.length,
      affiliationCount: affiliations.length,
    },
  };
}

export async function createInstitutionRepository(data: typeof institutions.$inferInsert) {
  const db = getDbClient();
  const created = await db.insert(institutions).values(data).returning();
  return created[0];
}

export async function updateInstitutionRepository(id: string, data: Partial<typeof institutions.$inferInsert>) {
  const db = getDbClient();
  const updated = await db
    .update(institutions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(institutions.id, id))
    .returning();
  return updated[0] || null;
}

export async function checkInstitutionHasHistoryRepository(id: string): Promise<boolean> {
  const db = getDbClient();
  const [invCount, partCount] = await Promise.all([
    db.select({ total: count() }).from(invitations).where(eq(invitations.institutionId, id)),
    db.select({ total: count() }).from(eventParticipants).where(eq(eventParticipants.institutionId, id)),
  ]);

  const totalHistory = (invCount[0]?.total || 0) + (partCount[0]?.total || 0);
  return totalHistory > 0;
}

export async function softDeleteInstitutionRepository(id: string) {
  const db = getDbClient();
  const updated = await db
    .update(institutions)
    .set({ deletedAt: new Date(), status: "INACTIVE", updatedAt: new Date() })
    .where(eq(institutions.id, id))
    .returning();
  return updated[0] || null;
}

export async function createRepresentativeRepository(data: typeof institutionRepresentatives.$inferInsert) {
  return withTransaction(async (tx) => {
    await tx.select({ id: institutions.id }).from(institutions)
      .where(eq(institutions.id, data.institutionId)).limit(1).for("update");
    const [primary] = await tx.select({ id: institutionRepresentatives.id }).from(institutionRepresentatives)
      .where(and(eq(institutionRepresentatives.institutionId, data.institutionId), eq(institutionRepresentatives.isPrimary, true))).limit(1);
    const makePrimary = Boolean(data.isPrimary || !primary);
    if (makePrimary && primary) await tx.update(institutionRepresentatives)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(eq(institutionRepresentatives.institutionId, data.institutionId));
    const [created] = await tx.insert(institutionRepresentatives).values({ ...data, isPrimary: makePrimary }).returning();
    return created;
  });
}

export async function findRepresentativeByIdRepository(id: string) {
  const db = getDbClient();
  const rows = await db
    .select()
    .from(institutionRepresentatives)
    .where(eq(institutionRepresentatives.id, id))
    .limit(1);
  return rows[0] || null;
}

export async function updateRepresentativeRepository(
  id: string,
  data: Partial<typeof institutionRepresentatives.$inferInsert>
) {
  return withTransaction(async (tx) => {
    const [target] = await tx.select({ institutionId: institutionRepresentatives.institutionId })
      .from(institutionRepresentatives).where(eq(institutionRepresentatives.id, id)).limit(1);
    if (!target) return null;
    await tx.select({ id: institutions.id }).from(institutions)
      .where(eq(institutions.id, target.institutionId)).limit(1).for("update");
    const [current] = await tx.select().from(institutionRepresentatives)
      .where(and(eq(institutionRepresentatives.id, id), eq(institutionRepresentatives.institutionId, target.institutionId))).limit(1);
    if (!current) return null;
    if (data.isPrimary === true) await tx.update(institutionRepresentatives)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(eq(institutionRepresentatives.institutionId, current.institutionId));
    if (data.isPrimary === false && current.isPrimary) {
      const [next] = await tx.select({ id: institutionRepresentatives.id }).from(institutionRepresentatives)
        .where(and(eq(institutionRepresentatives.institutionId, current.institutionId), sql`${institutionRepresentatives.id} <> ${id}`))
        .orderBy(asc(institutionRepresentatives.createdAt), asc(institutionRepresentatives.id)).limit(1);
      if (next) await tx.update(institutionRepresentatives).set({ isPrimary: true, updatedAt: new Date() })
        .where(eq(institutionRepresentatives.id, next.id));
      else data = { ...data, isPrimary: true };
    }
    const [updated] = await tx.update(institutionRepresentatives).set({ ...data, updatedAt: new Date() })
      .where(eq(institutionRepresentatives.id, id)).returning();
    return updated || null;
  });
}

export async function deleteRepresentativeRepository(id: string) {
  return withTransaction(async (tx) => {
    const [target] = await tx.select({ institutionId: institutionRepresentatives.institutionId })
      .from(institutionRepresentatives).where(eq(institutionRepresentatives.id, id)).limit(1);
    if (!target) return null;
    await tx.select({ id: institutions.id }).from(institutions)
      .where(eq(institutions.id, target.institutionId)).limit(1).for("update");
    const [current] = await tx.select().from(institutionRepresentatives)
      .where(and(eq(institutionRepresentatives.id, id), eq(institutionRepresentatives.institutionId, target.institutionId))).limit(1);
    if (!current) return null;
    const [deleted] = await tx.delete(institutionRepresentatives).where(eq(institutionRepresentatives.id, id)).returning();
    if (current.isPrimary) {
      const [next] = await tx.select({ id: institutionRepresentatives.id }).from(institutionRepresentatives)
        .where(eq(institutionRepresentatives.institutionId, current.institutionId))
        .orderBy(asc(institutionRepresentatives.createdAt), asc(institutionRepresentatives.id)).limit(1);
      if (next) await tx.update(institutionRepresentatives).set({ isPrimary: true, updatedAt: new Date() })
        .where(eq(institutionRepresentatives.id, next.id));
    }
    return deleted || null;
  });
}
