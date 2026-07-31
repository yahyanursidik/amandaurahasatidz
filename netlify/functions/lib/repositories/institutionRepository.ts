import { getDbClient } from "../db/client";
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
import { eq, ilike, and, or, isNull, count, desc } from "drizzle-orm";

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
      .leftJoin(invitationResponses, eq(invitationResponses.invitationId, invitations.id))
      .where(eq(invitations.institutionId, id))
      .orderBy(desc(events.startDate)),
    db
      .select({
        id: eventParticipants.id,
        participantCode: eventParticipants.participantCode,
        confirmationStatus: eventParticipants.confirmationStatus,
        approvalStatus: eventParticipants.approvalStatus,
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
  const db = getDbClient();
  const created = await db.insert(institutionRepresentatives).values(data).returning();
  return created[0];
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

export async function clearPrimaryRepresentativeRepository(institutionId: string) {
  const db = getDbClient();
  await db
    .update(institutionRepresentatives)
    .set({ isPrimary: false, updatedAt: new Date() })
    .where(eq(institutionRepresentatives.institutionId, institutionId));
}

export async function updateRepresentativeRepository(
  id: string,
  data: Partial<typeof institutionRepresentatives.$inferInsert>
) {
  const db = getDbClient();
  const rows = await db
    .update(institutionRepresentatives)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(institutionRepresentatives.id, id))
    .returning();
  return rows[0] || null;
}

export async function deleteRepresentativeRepository(id: string) {
  const db = getDbClient();
  const rows = await db
    .delete(institutionRepresentatives)
    .where(eq(institutionRepresentatives.id, id))
    .returning();
  return rows[0] || null;
}
