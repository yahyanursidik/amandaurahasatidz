import { getDbClient } from "../db/client";
import { institutions, institutionRepresentatives, invitations, eventParticipants } from "../db/schema";
import { eq, ilike, and, or, isNull, count, desc, sql } from "drizzle-orm";

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

  const conditions = [isNull(institutions.deletedAt)];

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

  const [dataResult, countResult] = await Promise.all([
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

export async function findInstitutionByIdRepository(id: string) {
  const db = getDbClient();
  const inst = await db
    .select()
    .from(institutions)
    .where(and(eq(institutions.id, id), isNull(institutions.deletedAt)))
    .limit(1);

  if (inst.length === 0) return null;

  const reps = await db
    .select()
    .from(institutionRepresentatives)
    .where(eq(institutionRepresentatives.institutionId, id));

  return {
    ...inst[0],
    representatives: reps,
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
    .where(and(eq(institutions.id, id), isNull(institutions.deletedAt)))
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
