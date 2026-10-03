import { and, count, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import type { z } from "zod";
import { getDbClient } from "../db/client";
import { institutions, ukhuwahLocations as locations, ukhuwahReports as reports, users } from "../db/schema";
import { requireAuth, type UserContext } from "../middleware/rbac";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../utils/errors";
import { createAuditLog } from "./auditService";
import { listSchema, locationSchema, locationUpdateSchema, reportSchema, reportUpdateSchema, submitSchema, moderateSchema, followupSchema, submissionError } from "../validations/ukhuwahValidation";

function validateRequestData<S extends z.ZodTypeAny>(schema: S, value: unknown): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ValidationError(parsed.error.issues.map(issue => issue.message).join(" "));
  return parsed.data;
}

type LocationRow = typeof locations.$inferSelect;
type ReportRow = typeof reports.$inferSelect;
type Query = z.infer<typeof listSchema>;
export function authorizeUkhuwah(actor: UserContext | null, admin: boolean) {
  const session = requireAuth(actor); const now = new Date();
  const allowed = session.assignments.some(a => {
    if (a.startsAt && !(new Date(a.startsAt) <= now)) return false;
    if (a.endsAt && !(new Date(a.endsAt) >= now)) return false;
    return admin ? ["SUPER_ADMIN", "SYSTEM_ADMIN"].includes(a.roleCode) && !a.eventId && !a.institutionId : a.roleCode === "USTADZ";
  });
  if (!allowed) throw new ForbiddenError("Peta Ukhuwah memerlukan asatidz aktif atau pengelola global aktif sesuai halaman akses.");
  return session;
}
/** Never return raw rows with contact consent metadata to members. */
export function locationDto(row: LocationRow, admin: boolean) {
  const { createdBy: _created, updatedBy: _updated, officialPhone, picName, picPhone, officialContactShared, picContactShared,
    contactConsentConfirmed, contactConsentSource, contactConfirmedAt, ...safe } = row;
  if (admin) return { ...safe, officialPhone, picName, picPhone, officialContactShared, picContactShared, contactConsentConfirmed, contactConsentSource, contactConfirmedAt };
  return { ...safe, ...(contactConsentConfirmed && officialContactShared ? { officialPhone } : {}),
    ...(contactConsentConfirmed && picContactShared ? { picName, picPhone } : {}) };
}
export function reportDto(row: ReportRow, authorName: string | null, actorId: string, admin: boolean, locationVisible = true) {
  const { authorUserId, moderatedBy: _moderator, moderationReason, ...safe } = row;
  const isOwner = authorUserId === actorId;
  return { ...safe, locationId: locationVisible ? safe.locationId : null, isOwner,
    authorName: row.hideAuthor && !admin && !isOwner ? null : authorName,
    ...(admin || isOwner ? { moderationReason } : {}) };
}
export function reportVisibility(actorId: string, admin: boolean, mine = false) {
  if (mine) return eq(reports.authorUserId, actorId);
  if (admin) return undefined;
  return and(eq(reports.audience, "SHARED"), eq(reports.publicationStatus, "APPROVED"));
}
function reportAccess(id: string, actorId: string, admin: boolean) {
  return and(eq(reports.id, id), admin ? undefined : or(eq(reports.authorUserId, actorId), reportVisibility(actorId, false)));
}
const pattern = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;
function paged<T>(data: T[], total: number, query: Query) {
  return { data, meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
}
async function audit(actorId: string, action: string, id: string, version: number, requestId: string) {
  // Do not copy report body, private contacts, consent evidence or moderation reasons into audit logs.
  await createAuditLog({ actorUserId: actorId, action, resourceType: "ukhuwah", resourceId: id, afterData: { version }, requestId });
}
export async function listUkhuwahLocations(actor: UserContext, admin: boolean, input: unknown) {
  authorizeUkhuwah(actor, admin); const query = validateRequestData(listSchema, input); const db = getDbClient();
  const filter = and(admin ? undefined : eq(locations.isPublished, true), query.cityCode ? eq(locations.cityCode, query.cityCode) : undefined,
    query.district ? ilike(locations.district, query.district.replace(/[\\%_]/g, "\\$&")) : undefined,
    query.search ? or(ilike(locations.name, pattern(query.search)), ilike(locations.address, pattern(query.search))) : undefined);
  const [data, totals] = await Promise.all([
    db.select().from(locations).where(filter).orderBy(desc(locations.updatedAt), desc(locations.id)).limit(query.pageSize).offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(locations).where(filter),
  ]);
  return paged(data.map(row => locationDto(row, admin)), Number(totals[0]?.total ?? 0), query);
}
export async function getUkhuwahLocation(actor: UserContext, admin: boolean, id: string) {
  authorizeUkhuwah(actor, admin);
  const [row] = await getDbClient().select().from(locations).where(and(eq(locations.id, id), admin ? undefined : eq(locations.isPublished, true))).limit(1);
  if (!row) throw new NotFoundError(); return locationDto(row, admin);
}
export async function listUkhuwahInstitutions(actor: UserContext, input: unknown) {
  authorizeUkhuwah(actor, true); const query = validateRequestData(listSchema, input); const db = getDbClient();
  const filter = query.search ? ilike(institutions.name, pattern(query.search)) : undefined;
  const [data, totals] = await Promise.all([
    db.select({ id: institutions.id, name: institutions.name }).from(institutions).where(filter).orderBy(institutions.name, institutions.id).limit(query.pageSize).offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(institutions).where(filter),
  ]); return paged(data, Number(totals[0]?.total ?? 0), query);
}
export async function saveUkhuwahLocation(actor: UserContext, id: string | null, input: unknown, requestId: string) {
  authorizeUkhuwah(actor, true); const db = getDbClient();
  const parsed = id ? validateRequestData(locationUpdateSchema, input) : validateRequestData(locationSchema, input);
  const { expectedVersion: _expected, ...value } = parsed as typeof parsed & { expectedVersion?: number };
  if (value.institutionId) {
    const [institution] = await db.select({ id: institutions.id }).from(institutions).where(eq(institutions.id, value.institutionId)).limit(1);
    if (!institution) throw new ValidationError("Lembaga terafiliasi tidak ditemukan.");
  }
  const fields = { ...value, updatedBy: actor.userId, updatedAt: new Date(), contactConfirmedAt: value.contactConsentConfirmed ? new Date() : null };
  const rows = id ? await db.update(locations).set({ ...fields, version: sql`${locations.version} + 1` }).where(and(eq(locations.id, id), eq(locations.version, _expected!))).returning()
    : await db.insert(locations).values({ ...fields, createdBy: actor.userId }).returning();
  const row = rows[0]; if (!row) throw new ConflictError("Lokasi tidak ditemukan atau revisi berubah. Muat ulang sebelum menyimpan.");
  await audit(actor.userId, "UKHUWAH_LOCATION_SAVED", row.id, row.version, requestId); return locationDto(row, true);
}
export async function listUkhuwahReports(actor: UserContext, admin: boolean, input: unknown) {
  authorizeUkhuwah(actor, admin); const query = validateRequestData(listSchema, input); const db = getDbClient();
  const filter = and(reportVisibility(actor.userId, admin, query.mine === "true"),
    query.cityCode ? eq(reports.cityCode, query.cityCode) : undefined, query.district ? ilike(reports.district, query.district.replace(/[\\%_]/g, "\\$&")) : undefined,
    query.category ? eq(reports.category, query.category) : undefined, query.publicationStatus ? eq(reports.publicationStatus, query.publicationStatus) : undefined,
    query.workStatus ? eq(reports.workStatus, query.workStatus) : undefined,
    query.search ? or(ilike(reports.title, pattern(query.search)), ilike(reports.body, pattern(query.search))) : undefined);
  const [data, totals] = await Promise.all([
    db.select({ row: reports, authorName: users.name, locationPublished: locations.isPublished }).from(reports).leftJoin(users, eq(users.id, reports.authorUserId)).leftJoin(locations, eq(locations.id, reports.locationId)).where(filter)
      .orderBy(desc(reports.updatedAt), desc(reports.id)).limit(query.pageSize).offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(reports).where(filter),
  ]);
  return paged(data.map(({ row, authorName, locationPublished }) => reportDto(row, authorName, actor.userId, admin, admin || locationPublished === true)), Number(totals[0]?.total ?? 0), query);
}
export async function getUkhuwahReport(actor: UserContext, admin: boolean, id: string) {
  authorizeUkhuwah(actor, admin);
  const [data] = await getDbClient().select({ row: reports, authorName: users.name, locationPublished: locations.isPublished }).from(reports)
    .leftJoin(users, eq(users.id, reports.authorUserId)).leftJoin(locations, eq(locations.id, reports.locationId)).where(reportAccess(id, actor.userId, admin)).limit(1);
  if (!data) throw new NotFoundError();
  return reportDto(data.row, data.authorName, actor.userId, admin, admin || data.locationPublished === true);
}
export async function saveUkhuwahReport(actor: UserContext, admin: boolean, id: string | null, input: unknown, requestId: string) {
  authorizeUkhuwah(actor, admin); const db = getDbClient();
  const parsed = id ? validateRequestData(reportUpdateSchema, input) : validateRequestData(reportSchema, input);
  const { expectedVersion: _expected, ...value } = parsed as typeof parsed & { expectedVersion?: number };
  if (value.locationId) {
    const [location] = await db.select().from(locations).where(and(eq(locations.id, value.locationId), admin ? undefined : eq(locations.isPublished, true))).limit(1);
    if (!location || location.cityCode !== value.cityCode || (location.district && location.district.toLowerCase() !== value.district.toLowerCase())) throw new ValidationError("Lokasi terkait tidak tersedia atau berbeda wilayah/kecamatan.");
  }
  const fields = { ...value, updatedAt: new Date(), publicationStatus: "DRAFT", moderationReason: null, moderatedBy: null };
  const rows = id ? await db.update(reports).set({ ...fields, version: sql`${reports.version} + 1` }).where(and(eq(reports.id, id), eq(reports.authorUserId, actor.userId), eq(reports.version, _expected!), ne(reports.publicationStatus, "PENDING"))).returning()
    : await db.insert(reports).values({ ...fields, authorUserId: actor.userId }).returning();
  const row = rows[0]; if (!row) throw new ConflictError("Revisi berubah, pengajuan sedang ditinjau, atau laporan bukan milik Anda.");
  await audit(actor.userId, "UKHUWAH_REPORT_SAVED", row.id, row.version, requestId);
  return reportDto(row, actor.name ?? null, actor.userId, admin);
}
export async function submitUkhuwahReport(actor: UserContext, admin: boolean, id: string, input: unknown, requestId: string) {
  authorizeUkhuwah(actor, admin); const valid = validateRequestData(submitSchema, input); const db = getDbClient();
  const [existing] = await db.select().from(reports).where(and(eq(reports.id, id), eq(reports.authorUserId, actor.userId))).limit(1);
  if (!existing) throw new NotFoundError();
  if (existing.version !== valid.expectedVersion || !["DRAFT", "REJECTED"].includes(existing.publicationStatus)) throw new ConflictError("Revisi atau status laporan berubah.");
  const invalid = submissionError(existing); if (invalid) throw new ValidationError(invalid);
  const [row] = await db.update(reports).set({ publicationStatus: "PENDING", moderationReason: null, moderatedBy: null, updatedAt: new Date(), version: sql`${reports.version} + 1` })
    .where(and(eq(reports.id, id), eq(reports.authorUserId, actor.userId), eq(reports.version, valid.expectedVersion), eq(reports.publicationStatus, existing.publicationStatus))).returning();
  if (!row) throw new ConflictError("Revisi berubah.");
  await audit(actor.userId, "UKHUWAH_REPORT_SUBMITTED", id, row.version, requestId); return getUkhuwahReport(actor, admin, id);
}
export async function moderateUkhuwahReport(actor: UserContext, id: string, input: unknown, requestId: string) {
  authorizeUkhuwah(actor, true); const valid = validateRequestData(moderateSchema, input); const db = getDbClient();
  const [existing] = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  if (!existing) throw new NotFoundError();
  if (existing.version !== valid.expectedVersion) throw new ConflictError("Revisi berubah.");
  if (existing.publicationStatus === "DRAFT" || (valid.decision === "APPROVED" && existing.publicationStatus !== "PENDING")) throw new ConflictError("Pengajuan harus menunggu moderasi sebelum disetujui.");
  if (valid.decision === "APPROVED" && existing.authorUserId === actor.userId) throw new ForbiddenError("Tidak boleh menyetujui laporan sendiri.");
  if (valid.decision === "APPROVED") { const invalid = submissionError(existing); if (invalid) throw new ValidationError(invalid); }
  const [row] = await db.update(reports).set({ publicationStatus: valid.decision, moderationReason: valid.reason, moderatedBy: actor.userId, updatedAt: new Date(), version: sql`${reports.version} + 1` })
    .where(and(eq(reports.id, id), eq(reports.version, valid.expectedVersion))).returning();
  if (!row) throw new ConflictError("Revisi berubah.");
  await audit(actor.userId, "UKHUWAH_REPORT_MODERATED", id, row.version, requestId); return getUkhuwahReport(actor, true, id);
}
export async function followupUkhuwahReport(actor: UserContext, id: string, input: unknown, requestId: string) {
  authorizeUkhuwah(actor, true); const { expectedVersion, ...fields } = validateRequestData(followupSchema, input);
  const [row] = await getDbClient().update(reports).set({ ...fields, updatedAt: new Date(), version: sql`${reports.version} + 1` }).where(and(eq(reports.id, id), eq(reports.version, expectedVersion))).returning();
  if (!row) throw new ConflictError("Revisi berubah atau laporan tidak ditemukan.");
  await audit(actor.userId, "UKHUWAH_REPORT_FOLLOWUP", id, row.version, requestId); return getUkhuwahReport(actor, true, id);
}