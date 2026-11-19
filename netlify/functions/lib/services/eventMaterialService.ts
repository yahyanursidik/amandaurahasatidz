import { and, asc, desc, eq, exists, inArray, isNull, notInArray, or, sql } from "drizzle-orm";
import { getDbClient } from "../db/client";
import { attendanceRecords, eventDays, eventMaterialProgress, eventParticipants, eventRecordings, eventSessions, events, ustadzProfiles } from "../db/schema";
import { portalProfileOwnership } from "../repositories/portalProfileRepository";
import { ConflictError, NotFoundError, ValidationError } from "../utils/errors";
import { createAuditLog } from "./auditService";
import { ATTENDED_STATUSES } from "./attendanceModel";
import { INACTIVE_CONFIRMATION_STATUSES } from "../../../../src/lib/registrationStatus";
import { materialStorageHosts, parseMaterialSource, type EventMaterial, type MaterialKind, type MaterialSession, type PortalMaterialGroup } from "../../../../src/lib/eventMaterial";
import type { PortalRecordingGroup } from "../../../../src/lib/eventRecording";

type Database = ReturnType<typeof getDbClient>;
type Item = Pick<typeof eventRecordings.$inferSelect, "id" | "title" | "url" | "kind" | "alternateUrls" | "sessionId" | "published">;
type MaterialWrite = { title: string; urls: string[]; published: boolean; kind: MaterialKind; sessionId?: string | null };

const recording = { id: eventRecordings.id, title: eventRecordings.title, url: eventRecordings.url };
const adminRecording = { ...recording, published: eventRecordings.published };
const item = { ...adminRecording, kind: eventRecordings.kind, alternateUrls: eventRecordings.alternateUrls, sessionId: eventRecordings.sessionId };
const eventSummary = { id: events.id, name: events.name, startDate: events.startDate, endDate: events.endDate };

export const allowedMaterialStorage = () => materialStorageHosts(process.env.MATERIAL_PDF_HOSTS);

function toMaterial(row: Item, session: MaterialSession | null, storageHosts: string[]): EventMaterial {
  const urls = new Set([row.url, ...row.alternateUrls]);
  const sources = [...urls].map((url) => parseMaterialSource(row.kind, url, storageHosts)).filter((source) => source !== null);
  return { id: row.id, title: row.title, kind: row.kind, sources, session };
}

function eventSessionQuery(db: Database) {
  return db.select({ id: eventSessions.id, title: eventSessions.title, date: eventDays.date, eventId: eventDays.eventId, startAt: eventSessions.startAt })
    .from(eventSessions).innerJoin(eventDays, eq(eventSessions.eventDayId, eventDays.id));
}

async function findMaterialEvent(eventId: string) {
  const [event] = await getDbClient().select(eventSummary).from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) throw new NotFoundError("Event tidak ditemukan.");
  return event;
}

export async function getEventMaterials(eventId: string) {
  const db = getDbClient();
  const [event, rows, eventSessionsList] = await Promise.all([
    findMaterialEvent(eventId),
    db.select(item).from(eventRecordings).where(eq(eventRecordings.eventId, eventId))
      .orderBy(asc(eventRecordings.createdAt), asc(eventRecordings.id)),
    eventSessionQuery(db).where(eq(eventDays.eventId, eventId)).orderBy(asc(eventSessions.startAt), asc(eventSessions.id)),
  ]);
  const storageHosts = allowedMaterialStorage();
  const sessions = eventSessionsList.map(({ id, title, date }) => ({ id, title, date }));
  const bySession = new Map(sessions.map((session) => [session.id, session]));
  return { event, sessions, storageHosts, materials: rows.map((row) => ({
    ...toMaterial(row, row.sessionId ? bySession.get(row.sessionId) ?? null : null, storageHosts), published: row.published,
  })) };
}

export async function getEventRecordings(eventId: string) {
  const event = await findMaterialEvent(eventId);
  const recordings = await getDbClient().select(adminRecording).from(eventRecordings)
    .where(and(eq(eventRecordings.eventId, eventId), eq(eventRecordings.kind, "VIDEO")))
    .orderBy(asc(eventRecordings.createdAt), asc(eventRecordings.id));
  return { event, recordings };
}

export async function saveEventMaterial(
  eventId: string, materialId: string | undefined, values: MaterialWrite, actorUserId: string, requestId: string, legacy = false,
) {
  const db = getDbClient();
  const [url, ...alternateUrls] = values.urls;
  let session: MaterialSession | null = null;
  if (values.sessionId) {
    const [match] = await eventSessionQuery(db).where(and(eq(eventDays.eventId, eventId), eq(eventSessions.id, values.sessionId))).limit(1);
    if (!match) throw new ValidationError("Pilih sesi dari jadwal event ini.");
    session = { id: match.id, title: match.title, date: match.date };
  }

  const changes = { title: values.title, url, published: values.published,
    ...(!legacy && { kind: values.kind, alternateUrls, sessionId: session?.id ?? null }) };
  let saved: Item | undefined;
  try {
    if (materialId) {
      [saved] = await db.update(eventRecordings).set({ ...changes, updatedAt: new Date() })
        .where(and(eq(eventRecordings.id, materialId), eq(eventRecordings.eventId, eventId),
          legacy ? eq(eventRecordings.kind, "VIDEO") : undefined)).returning(item);
      if (!saved) throw new NotFoundError("Materi tidak ditemukan pada event ini.");
    } else {
      await findMaterialEvent(eventId);
      [saved] = await db.insert(eventRecordings).values({ eventId, ...changes })
        .onConflictDoNothing({ target: [eventRecordings.eventId, eventRecordings.url] }).returning(item);
      if (!saved) throw new ConflictError("Tautan utama sudah tersimpan pada event ini.");
    }
  } catch (cause) {
    const error = cause as { code?: string; cause?: { code?: string } };
    const code = error?.code ?? error?.cause?.code;
    if (code === "23505") throw new ConflictError("Tautan utama sudah tersimpan pada event ini.");
    if (code === "23503") throw new ValidationError("Event atau sesi berubah. Muat ulang daftar sebelum menyimpan.");
    throw cause;
  }
  await createAuditLog({
    actorUserId, eventId, requestId, resourceId: saved.id, resourceType: legacy ? "EVENT_RECORDING" : "EVENT_MATERIAL",
    action: legacy ? materialId ? "EVENT_RECORDING_UPDATED" : "EVENT_RECORDING_CREATED"
      : materialId ? "EVENT_MATERIAL_UPDATED" : "EVENT_MATERIAL_CREATED",
    afterData: { kind: saved.kind, published: saved.published, sessionId: saved.sessionId },
  });
  return legacy ? { id: saved.id, title: saved.title, url: saved.url, published: saved.published }
    : { ...toMaterial(saved, session, allowedMaterialStorage()), published: saved.published };
}

function portalMaterialAccess(db: Database, userId: string) {
  const attended = db.select({ id: attendanceRecords.id }).from(attendanceRecords).where(and(
    eq(attendanceRecords.eventId, events.id), eq(attendanceRecords.participantId, eventParticipants.id),
    inArray(attendanceRecords.attendanceStatus, ATTENDED_STATUSES),
  ));
  const participation = db.select({ id: eventParticipants.id }).from(eventParticipants)
    .innerJoin(ustadzProfiles, eq(ustadzProfiles.id, eventParticipants.ustadzId))
    .where(and(
      eq(eventParticipants.eventId, events.id), portalProfileOwnership(userId),
      eq(ustadzProfiles.profileStatus, "ACTIVE"), isNull(ustadzProfiles.deletedAt), isNull(ustadzProfiles.mergedIntoId),
      eq(eventParticipants.approvalStatus, "APPROVED"), isNull(eventParticipants.cancelledAt),
      notInArray(eventParticipants.confirmationStatus, INACTIVE_CONFIRMATION_STATUSES),
      or(eq(eventParticipants.confirmationStatus, "CONFIRMED"), eq(events.attendanceConfirmationRequired, false), exists(attended)),
    ));
  return and(eq(eventRecordings.published, true), notInArray(events.status, ["DRAFT", "CANCELLED"]),
    sql`${events.startDate} <= timezone(${events.timezone}, current_timestamp)::date`, exists(participation));
}

export async function getOwnPortalMaterials(userId: string, videosOnly = false) {
  const db = getDbClient();
  const sessions = eventSessionQuery(db).as("material_session");
  const rows = await db.select({ event: eventSummary, item, session: { id: sessions.id, title: sessions.title, date: sessions.date },
    completedAt: eventMaterialProgress.completedAt }).from(eventRecordings)
    .innerJoin(events, eq(events.id, eventRecordings.eventId))
    .leftJoin(sessions, and(eq(sessions.id, eventRecordings.sessionId), eq(sessions.eventId, eventRecordings.eventId)))
    .leftJoin(eventMaterialProgress, and(eq(eventMaterialProgress.recordingId, eventRecordings.id), eq(eventMaterialProgress.userId, userId)))
    .where(and(portalMaterialAccess(db, userId), videosOnly ? eq(eventRecordings.kind, "VIDEO") : undefined))
    .orderBy(desc(events.startDate), asc(events.name), asc(events.id), asc(sessions.startAt), asc(eventRecordings.createdAt), asc(eventRecordings.id));

  const storageHosts = allowedMaterialStorage();
  const groups = new Map<string, PortalMaterialGroup>();
  for (const row of rows) {
    const material = { ...toMaterial(row.item, row.session, storageHosts), completedAt: row.completedAt?.toISOString() ?? null };
    const group = groups.get(row.event.id);
    if (group) group.materials.push(material);
    else groups.set(row.event.id, { ...row.event, materials: [material] });
  }
  return [...groups.values()];
}

export async function getOwnPortalRecordings(userId: string): Promise<PortalRecordingGroup[]> {
  const groups = await getOwnPortalMaterials(userId, true);
  return groups.map(({ materials, ...event }) => ({ ...event,
    recordings: materials.flatMap((material) => material.sources[0]
      ? [{ id: material.id, title: material.title, url: material.sources[0].url }] : []),
  })).filter((group) => group.recordings.length > 0);
}

export async function getOwnMaterialPdfSource(userId: string, materialId: string, url: string) {
  const db = getDbClient();
  const [row] = await db.select(item).from(eventRecordings)
    .innerJoin(events, eq(events.id, eventRecordings.eventId))
    .where(and(eq(eventRecordings.id, materialId), eq(eventRecordings.kind, "PDF"), portalMaterialAccess(db, userId))).limit(1);
  const source = row && toMaterial(row, null, allowedMaterialStorage()).sources.find((entry) => entry.provider === "S3" && entry.url === url);
  if (!source) throw new NotFoundError("PDF tidak tersedia.");
  return source;
}

export async function setMaterialCompletion(userId: string, materialId: string, completed: boolean) {
  const db = getDbClient();
  const eligible = db.select({ id: eventRecordings.id }).from(eventRecordings)
    .innerJoin(events, eq(events.id, eventRecordings.eventId))
    .where(and(eq(eventRecordings.id, materialId), portalMaterialAccess(db, userId)));

  const result = await db.execute(completed ? sql`
    INSERT INTO ${eventMaterialProgress} (user_id, recording_id)
    SELECT ${userId}::uuid, id FROM (${eligible}) AS eligible WHERE true
    ON CONFLICT (user_id, recording_id) DO UPDATE SET completed_at = ${eventMaterialProgress.completedAt}
    RETURNING completed_at AS "completedAt"
  ` : sql`
    WITH eligible AS (${eligible}), cleared AS (
      DELETE FROM ${eventMaterialProgress}
      WHERE ${eventMaterialProgress.userId} = ${userId}::uuid
        AND ${eventMaterialProgress.recordingId} IN (SELECT id FROM eligible)
    )
    SELECT NULL AS "completedAt" FROM eligible
  `);
  const row = result.rows[0] as { completedAt: Date | string | null } | undefined;
  if (!row) throw new NotFoundError("Materi tidak tersedia.");
  return { id: materialId, completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null };
}
