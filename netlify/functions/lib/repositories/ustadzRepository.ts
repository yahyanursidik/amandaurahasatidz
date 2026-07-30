import { getDbClient } from "../db/client";
import { withTransaction } from "../db/transaction";
import { ustadzProfiles, ustadzInstitutionAffiliations, institutions, eventParticipants, auditLogs } from "../db/schema";
import { eq, ilike, and, or, isNull, count, desc } from "drizzle-orm";
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

  return {
    data: dataResult,
    meta: {
      page,
      pageSize,
      total,
      pageCount,
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

  return {
    ...profile[0],
    affiliations,
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

export async function mergeUstadzProfilesTxRepository(
  sourceId: string,
  targetId: string,
  actorUserId: string,
  requestId: string
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
      reason: `Profil Ustadz ID ${sourceId} berhasil digabungkan (merged) ke Profil ID ${targetId}.`,
      requestId,
    });

    return updatedSource[0];
  });
}
