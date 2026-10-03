import { and, count, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDbClient } from "../db/client";
import { ustadzProfiles, ustadzYtsNotes as notes, users } from "../db/schema";
import { requireAuth, type UserContext } from "../middleware/rbac";
import { ConflictError, ForbiddenError, NotFoundError } from "../utils/errors";
import { canAccessYtsNotes, type YtsNoteFlag } from "../../../../src/lib/ustadzNotes";
import { parseYtsNotes, ytsNoteArchive, ytsNoteCreate, ytsNoteList, ytsNoteSummaryQuery, ytsNoteUpdate } from "../validations/ustadzNotesValidation";
import { createAuditLog } from "./auditService";

export function requireYtsNotes(session: UserContext | null) {
  const actor = requireAuth(session);
  if (!canAccessYtsNotes(actor.assignments)) throw new ForbiddenError("Catatan internal YTS hanya untuk SUPER_ADMIN/SYSTEM_ADMIN global aktif.");
  return actor;
}
/** Retain original attribution on merged profiles, and include their notes on the target. UNION terminates cycles. */
export function ytsNoteProfileScope(id: string) {
  return sql`(WITH RECURSIVE related(id) AS (
    SELECT id FROM ustadz_profiles WHERE id = ${id}::uuid
    UNION SELECT p.id FROM ustadz_profiles p JOIN related r ON p.merged_into_id = r.id
  ) SELECT id FROM related)`;
}
async function profile(id: string) {
  const [row] = await getDbClient().select({ id: ustadzProfiles.id, deletedAt: ustadzProfiles.deletedAt, mergedIntoId: ustadzProfiles.mergedIntoId }).from(ustadzProfiles).where(eq(ustadzProfiles.id, id)).limit(1);
  if (!row) throw new NotFoundError("Profil asatidz tidak ditemukan.");
  return row;
}
const creator = alias(users, "yts_note_creator"), updater = alias(users, "yts_note_updater");
const selection = {
  id: notes.id, ustadzId: notes.ustadzId, title: notes.title, body: notes.body, flag: notes.flag, version: notes.version,
  archivedAt: notes.archivedAt, createdAt: notes.createdAt, updatedAt: notes.updatedAt,
  createdByName: creator.name, updatedByName: updater.name, sourceProfileName: ustadzProfiles.fullName,
};
function noteQuery() {
  return getDbClient().select(selection).from(notes).leftJoin(creator, eq(creator.id, notes.createdBy)).leftJoin(updater, eq(updater.id, notes.updatedBy)).innerJoin(ustadzProfiles, eq(ustadzProfiles.id, notes.ustadzId));
}
async function audit(actor: UserContext, action: string, id: string, version: number, requestId: string) {
  // No body, title, flag, source name or private evidence in general audit logs.
  await createAuditLog({ actorUserId: actor.userId, resourceType: "USTADZ_YTS_NOTE", resourceId: id, action, afterData: { version }, requestId });
}
export async function getYtsNoteSummaries(session: UserContext | null, input: unknown) {
  requireYtsNotes(session); const { ids } = parseYtsNotes(ytsNoteSummaryQuery, input);
  const db = getDbClient();
  const rows = await db.execute(sql`WITH RECURSIVE related(root_id, id) AS (
    SELECT id, id FROM ustadz_profiles WHERE id IN (${sql.join([...new Set(ids)].map(id => sql`${id}::uuid`), sql`, `)})
    UNION SELECT r.root_id, p.id FROM ustadz_profiles p JOIN related r ON p.merged_into_id = r.id
  ) SELECT r.root_id AS ustadz_id, count(n.id)::integer AS active_count,
    max(CASE n.flag WHEN 'RED' THEN 4 WHEN 'YELLOW' THEN 3 WHEN 'BLUE' THEN 2 WHEN 'GREEN' THEN 1 ELSE 0 END)::integer AS priority
    FROM related r LEFT JOIN ustadz_yts_notes n ON n.ustadz_id = r.id AND n.archived_at IS NULL GROUP BY r.root_id`);
  const flags: Array<YtsNoteFlag | null> = [null, "GREEN", "BLUE", "YELLOW", "RED"];
  return rows.rows.map(row => ({ ustadzId: String(row.ustadz_id), activeCount: Number(row.active_count), flag: flags[Number(row.priority)] ?? null }));
}
export async function listYtsNotes(session: UserContext | null, ustadzId: string, input: unknown) {
  requireYtsNotes(session); await profile(ustadzId); const q = parseYtsNotes(ytsNoteList, input);
  const where = and(inArray(notes.ustadzId, ytsNoteProfileScope(ustadzId)), q.archived === "true" ? isNotNull(notes.archivedAt) : isNull(notes.archivedAt), q.flag ? eq(notes.flag, q.flag) : undefined);
  const [data, totals] = await Promise.all([
    noteQuery().where(where).orderBy(desc(notes.updatedAt), desc(notes.id)).limit(q.pageSize).offset((q.page - 1) * q.pageSize),
    getDbClient().select({ total: count() }).from(notes).where(where),
  ]);
  const total = Number(totals[0]?.total ?? 0);
  return { data, meta: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.ceil(total / q.pageSize) } };
}
export async function createYtsNote(session: UserContext | null, ustadzId: string, input: unknown, requestId: string) {
  const actor = requireYtsNotes(session); const value = parseYtsNotes(ytsNoteCreate, input); const p = await profile(ustadzId);
  if (p.mergedIntoId) throw new ConflictError("Tambahkan catatan pada profil tujuan penggabungan.");
  const [row] = await getDbClient().insert(notes).values({ ...value, ustadzId, createdBy: actor.userId, updatedBy: actor.userId }).returning({ id: notes.id, version: notes.version });
  await audit(actor, "YTS_NOTE_CREATED", row.id, row.version, requestId);
  const [result] = await noteQuery().where(eq(notes.id, row.id)).limit(1); return result;
}
export async function updateYtsNote(session: UserContext | null, ustadzId: string, id: string, input: unknown, requestId: string, archive = false) {
  const actor = requireYtsNotes(session);
  const parsed = archive ? parseYtsNotes(ytsNoteArchive, input) : parseYtsNotes(ytsNoteUpdate, input);
  const { expectedVersion } = parsed;
  const patch = archive ? { archivedAt: (parsed as { archived: boolean }).archived ? new Date() : null }
    : { title: (parsed as { title: string }).title, body: (parsed as { body: string }).body, flag: (parsed as { flag: YtsNoteFlag }).flag };
  const desiredArchived = archive && (parsed as { archived: boolean }).archived;
  const [row] = await getDbClient().update(notes).set({ ...patch, updatedBy: actor.userId, updatedAt: new Date(), version: sql`${notes.version} + 1` })
    .where(and(eq(notes.id, id), inArray(notes.ustadzId, ytsNoteProfileScope(ustadzId)), eq(notes.version, expectedVersion), desiredArchived || !archive ? isNull(notes.archivedAt) : isNotNull(notes.archivedAt)))
    .returning({ id: notes.id, version: notes.version });
  if (!row) throw new ConflictError("Catatan tidak tersedia, status/revisi berubah, atau bukan milik profil ini. Muat ulang sebelum mencoba lagi.");
  await audit(actor, archive ? desiredArchived ? "YTS_NOTE_ARCHIVED" : "YTS_NOTE_RESTORED" : "YTS_NOTE_UPDATED", id, row.version, requestId);
  const [result] = await noteQuery().where(eq(notes.id, id)).limit(1); return result;
}