import { getDbClient } from "../db/client";
import { withTransaction } from "../db/transaction";
import {
  ustadzProfiles,
  ustadzInstitutionAffiliations,
  institutions,
  eventParticipants,
  events,
  attendanceRecords,
  auditLogs,
} from "../db/schema";
import { eq, ilike, and, or, isNull, count, desc, inArray } from "drizzle-orm";
import { normalizeName, normalizeEmail, normalizePhone } from "../utils/normalization";

export interface UstadzQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  cityCode?: string;
  provinceCode?: string;
  profileStatus?: string;
}

export async function findUstadzProfilesRepository(params: UstadzQueryParams) {
  const db = getDbClient();
  const page = params.page || 1;
  const pageSize = params.pageSize || 25;
  const offset = (page - 1) * pageSize;

  const conditions = [isNull(ustadzProfiles.deletedAt)];

  if (params.search && params.search.trim() !== "") {
    const searchPattern = `%${params.search.trim()}%`;
    const normSearch = `%${normalizeName(params.search)}%`;
    conditions.push(
      or(
        ilike(ustadzProfiles.fullName, searchPattern),
        ilike(ustadzProfiles.normalizedName, normSearch),
        ilike(ustadzProfiles.email, searchPattern),
        ilike(ustadzProfiles.phone, searchPattern)
      )!
    );
  }

  if (params.cityCode) {
    conditions.push(eq(ustadzProfiles.cityCode, params.cityCode));
  }

  if (params.provinceCode) {
    conditions.push(eq(ustadzProfiles.provinceCode, params.provinceCode));
  }

  if (params.profileStatus) {
    conditions.push(eq(ustadzProfiles.profileStatus, params.profileStatus));
  }

  const whereClause = and(...conditions);

  const [dataResult, countResult] = await Promise.all([
    db
      .select()
      .from(ustadzProfiles)
      .where(whereClause)
      .orderBy(desc(ustadzProfiles.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ total: count() })
      .from(ustadzProfiles)
      .where(whereClause),
  ]);

  const total = countResult[0]?.total || 0;
  const pageCount = Math.ceil(total / pageSize);
  const profileIds = dataResult.map((profile) => profile.id);
  const [affiliationRows, activeProfiles] = await Promise.all([
    profileIds.length
      ? db
          .select({
            ustadzId: ustadzInstitutionAffiliations.ustadzId,
            institutionId: institutions.id,
            institutionName: institutions.name,
            institutionCode: institutions.code,
            position: ustadzInstitutionAffiliations.position,
            isPrimary: ustadzInstitutionAffiliations.isPrimary,
            status: ustadzInstitutionAffiliations.status,
          })
          .from(ustadzInstitutionAffiliations)
          .innerJoin(institutions, eq(ustadzInstitutionAffiliations.institutionId, institutions.id))
          .where(
            and(
              inArray(ustadzInstitutionAffiliations.ustadzId, profileIds),
              eq(ustadzInstitutionAffiliations.status, "ACTIVE"),
            ),
          )
      : Promise.resolve([]),
    db
      .select({
        id: ustadzProfiles.id,
        normalizedName: ustadzProfiles.normalizedName,
        email: ustadzProfiles.email,
        phone: ustadzProfiles.phone,
        whatsapp: ustadzProfiles.whatsapp,
        address: ustadzProfiles.address,
        profileStatus: ustadzProfiles.profileStatus,
      })
      .from(ustadzProfiles)
      .where(isNull(ustadzProfiles.deletedAt)),
  ]);

  const data = dataResult.map((profile) => {
    const affiliations = affiliationRows.filter((row) => row.ustadzId === profile.id);
    const primaryInstitution = affiliations.find((row) => row.isPrimary) || affiliations[0] || null;
    const hasDuplicateAlert = activeProfiles.some(
      (candidate) =>
        candidate.id !== profile.id &&
        candidate.profileStatus === "ACTIVE" &&
        (
          candidate.normalizedName === profile.normalizedName ||
          (profile.email && candidate.email === profile.email) ||
          (profile.phone && candidate.phone === profile.phone)
        ),
    );
    const completenessFields = [
      profile.email,
      profile.whatsapp || profile.phone,
      profile.address,
      profile.cityCode,
      profile.provinceCode,
      profile.educationSummary,
      profile.expertiseSummary,
    ];
    return {
      ...profile,
      primaryInstitution,
      affiliationCount: affiliations.length,
      hasDuplicateAlert,
      completenessPercent: Math.round(
        (completenessFields.filter((value) => Boolean(String(value || "").trim())).length / completenessFields.length) * 100,
      ),
    };
  });

  const summary = {
    total: activeProfiles.length,
    active: activeProfiles.filter((profile) => profile.profileStatus === "ACTIVE").length,
    inactive: activeProfiles.filter((profile) => profile.profileStatus === "INACTIVE").length,
    merged: activeProfiles.filter((profile) => profile.profileStatus === "MERGED").length,
    incomplete: activeProfiles.filter(
      (profile) => !profile.email || !(profile.whatsapp || profile.phone) || !profile.address,
    ).length,
    duplicateCandidates: activeProfiles.filter((profile, index, source) =>
      source.some(
        (candidate, candidateIndex) =>
          candidateIndex !== index &&
          candidate.profileStatus === "ACTIVE" &&
          profile.profileStatus === "ACTIVE" &&
          (
            candidate.normalizedName === profile.normalizedName ||
            (profile.email && candidate.email === profile.email) ||
            (profile.phone && candidate.phone === profile.phone)
          ),
      ),
    ).length,
  };

  return {
    data,
    meta: {
      page,
      pageSize,
      total,
      pageCount,
      summary,
    },
  };
}

export async function findUstadzByIdRepository(id: string) {
  const db = getDbClient();
  const profile = await db
    .select()
    .from(ustadzProfiles)
    .where(and(eq(ustadzProfiles.id, id), isNull(ustadzProfiles.deletedAt)))
    .limit(1);

  if (profile.length === 0) return null;

  const affiliations = await db
    .select({
      id: ustadzInstitutionAffiliations.id,
      institutionId: ustadzInstitutionAffiliations.institutionId,
      institutionName: institutions.name,
      institutionCode: institutions.code,
      position: ustadzInstitutionAffiliations.position,
      isPrimary: ustadzInstitutionAffiliations.isPrimary,
      startDate: ustadzInstitutionAffiliations.startDate,
      endDate: ustadzInstitutionAffiliations.endDate,
      status: ustadzInstitutionAffiliations.status,
    })
    .from(ustadzInstitutionAffiliations)
    .innerJoin(institutions, eq(ustadzInstitutionAffiliations.institutionId, institutions.id))
    .where(eq(ustadzInstitutionAffiliations.ustadzId, id));

  const eventHistory = await db
    .select({
      participantId: eventParticipants.id,
      participantCode: eventParticipants.participantCode,
      confirmationStatus: eventParticipants.confirmationStatus,
      approvalStatus: eventParticipants.approvalStatus,
      eventId: events.id,
      eventCode: events.code,
      eventName: events.name,
      eventStatus: events.status,
      eventStartDate: events.startDate,
      eventEndDate: events.endDate,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .where(eq(eventParticipants.ustadzId, id))
    .orderBy(desc(events.startDate));

  const attendanceRows = eventHistory.length
    ? await db
        .select({
          participantId: attendanceRecords.participantId,
          total: count(),
        })
        .from(attendanceRecords)
        .where(inArray(attendanceRecords.participantId, eventHistory.map((item) => item.participantId)))
        .groupBy(attendanceRecords.participantId)
    : [];

  const activeAffiliations = affiliations.filter((affiliation) => affiliation.status === "ACTIVE");
  const primaryInstitution =
    activeAffiliations.find((affiliation) => affiliation.isPrimary) || activeAffiliations[0] || null;
  const completenessFields = [
    profile[0].email,
    profile[0].whatsapp || profile[0].phone,
    profile[0].address,
    profile[0].cityCode,
    profile[0].provinceCode,
    profile[0].educationSummary,
    profile[0].expertiseSummary,
  ];

  return {
    ...profile[0],
    affiliations,
    primaryInstitution,
    affiliationCount: activeAffiliations.length,
    completenessPercent: Math.round(
      (completenessFields.filter((value) => Boolean(String(value || "").trim())).length /
        completenessFields.length) *
        100,
    ),
    eventHistory: eventHistory.map((item) => ({
      ...item,
      attendanceCount: attendanceRows.find((row) => row.participantId === item.participantId)?.total || 0,
    })),
  };
}

export async function createUstadzRepository(data: typeof ustadzProfiles.$inferInsert) {
  const db = getDbClient();
  const created = await db.insert(ustadzProfiles).values(data).returning();
  return created[0];
}

export async function updateUstadzRepository(id: string, data: Partial<typeof ustadzProfiles.$inferInsert>) {
  const db = getDbClient();
  const updated = await db
    .update(ustadzProfiles)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(ustadzProfiles.id, id), isNull(ustadzProfiles.deletedAt)))
    .returning();
  return updated[0] || null;
}

export async function findDuplicateCandidatesRepository(fullName: string, email?: string | null, phone?: string | null) {
  const db = getDbClient();
  const normName = normalizeName(fullName);
  const normEmail = normalizeEmail(email);
  const normPhone = normalizePhone(phone);

  const conditions = [isNull(ustadzProfiles.deletedAt), eq(ustadzProfiles.profileStatus, "ACTIVE")];
  const orConditions = [eq(ustadzProfiles.normalizedName, normName)];

  if (normEmail) {
    orConditions.push(eq(ustadzProfiles.email, normEmail));
  }
  if (normPhone) {
    orConditions.push(eq(ustadzProfiles.phone, normPhone));
  }

  conditions.push(or(...orConditions)!);

  return await db.select().from(ustadzProfiles).where(and(...conditions));
}

export async function addAffiliationRepository(ustadzId: string, institutionId: string, position?: string | null, isPrimary = false) {
  const db = getDbClient();

  if (isPrimary) {
    // Reset all other active affiliations to isPrimary = false
    await db
      .update(ustadzInstitutionAffiliations)
      .set({ isPrimary: false })
      .where(eq(ustadzInstitutionAffiliations.ustadzId, ustadzId));
  }

  const created = await db
    .insert(ustadzInstitutionAffiliations)
    .values({
      ustadzId,
      institutionId,
      position: position || null,
      isPrimary,
      status: "ACTIVE",
    })
    .returning();

  return created[0];
}

export async function updateAffiliationRepository(
  ustadzId: string,
  affiliationId: string,
  data: {
    position?: string | null;
    isPrimary?: boolean;
    startDate?: string | null;
    endDate?: string | null;
    status?: string;
  },
) {
  const db = getDbClient();
  if (data.isPrimary) {
    await db
      .update(ustadzInstitutionAffiliations)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(eq(ustadzInstitutionAffiliations.ustadzId, ustadzId));
  }
  const updated = await db
    .update(ustadzInstitutionAffiliations)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(ustadzInstitutionAffiliations.id, affiliationId),
        eq(ustadzInstitutionAffiliations.ustadzId, ustadzId),
      ),
    )
    .returning();
  return updated[0] || null;
}

export async function mergeUstadzProfilesTxRepository(
  sourceId: string,
  targetId: string,
  actorUserId: string,
  requestId: string,
  notes: string,
) {
  return await withTransaction(async (tx) => {
    // 1. Re-link affiliations to target Ustadz
    await tx
      .update(ustadzInstitutionAffiliations)
      .set({ ustadzId: targetId })
      .where(eq(ustadzInstitutionAffiliations.ustadzId, sourceId));

    // 2. Re-link event participants to target Ustadz
    await tx
      .update(eventParticipants)
      .set({ ustadzId: targetId })
      .where(eq(eventParticipants.ustadzId, sourceId));

    // 3. Mark source Ustadz as MERGED
    const updatedSource = await tx
      .update(ustadzProfiles)
      .set({
        profileStatus: "MERGED",
        mergedIntoId: targetId,
        updatedAt: new Date(),
      })
      .where(eq(ustadzProfiles.id, sourceId))
      .returning();

    // 4. Write audit log entry
    await tx.insert(auditLogs).values({
      actorUserId,
      action: "USTADZ_PROFILES_MERGED",
      resourceType: "USTADZ_PROFILE",
      resourceId: targetId,
      reason: `${notes} (Profil sumber ${sourceId} digabungkan ke ${targetId}.)`,
      requestId,
    });

    return updatedSource[0];
  });
}
