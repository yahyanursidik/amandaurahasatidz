import { and, asc, desc, eq, exists, inArray, isNull, notInArray, or, sql } from "drizzle-orm";
import { getDbClient } from "../db/client";
import { attendanceRecords, eventParticipants, eventRecordings, events, ustadzProfiles } from "../db/schema";
import { portalProfileOwnership } from "../repositories/portalProfileRepository";
import { ConflictError, NotFoundError } from "../utils/errors";
import { createAuditLog } from "./auditService";
import { ATTENDED_STATUSES } from "./attendanceModel";
import { INACTIVE_CONFIRMATION_STATUSES } from "../../../../src/lib/registrationStatus";
import type { EventRecording, PortalRecordingGroup } from "../../../../src/lib/eventRecording";

const recording = { id: eventRecordings.id, title: eventRecordings.title, url: eventRecordings.url };
const adminRecording = { ...recording, published: eventRecordings.published };
const eventSummary = { id: events.id, name: events.name, startDate: events.startDate, endDate: events.endDate };

async function findRecordingEvent(eventId: string) {
  const [event] = await getDbClient().select(eventSummary).from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) throw new NotFoundError("Event tidak ditemukan.");
  return event;
}

export async function getEventRecordings(eventId: string) {
  const event = await findRecordingEvent(eventId);
  const recordings = await getDbClient().select(adminRecording).from(eventRecordings)
    .where(eq(eventRecordings.eventId, eventId)).orderBy(asc(eventRecordings.createdAt), asc(eventRecordings.id));
  return { event, recordings };
}

function duplicateRecording(): ConflictError {
  return new ConflictError("Tautan ini sudah tersimpan pada event yang sama.");
}

export async function saveEventRecording(
  eventId: string, recordingId: string | undefined, values: Omit<EventRecording, "id">, actorUserId: string, requestId: string,
) {
  const db = getDbClient();
  let saved: EventRecording | undefined;
  if (recordingId) {
    try {
      [saved] = await db.update(eventRecordings).set({ ...values, updatedAt: new Date() })
        .where(and(eq(eventRecordings.id, recordingId), eq(eventRecordings.eventId, eventId)))
        .returning(adminRecording);
    } catch (cause) {
      const error = cause as { code?: string; cause?: { code?: string } };
      if (error?.code === "23505" || error?.cause?.code === "23505") throw duplicateRecording();
      throw cause;
    }
    if (!saved) throw new NotFoundError("Rekaman tidak ditemukan pada event ini.");
  } else {
    await findRecordingEvent(eventId);
    [saved] = await db.insert(eventRecordings).values({ eventId, ...values })
      .onConflictDoNothing({ target: [eventRecordings.eventId, eventRecordings.url] }).returning(adminRecording);
    if (!saved) throw duplicateRecording();
  }
  await createAuditLog({
    actorUserId, eventId, requestId, resourceId: saved.id, resourceType: "EVENT_RECORDING",
    action: recordingId ? "EVENT_RECORDING_UPDATED" : "EVENT_RECORDING_CREATED",
    afterData: { published: saved.published },
  });
  return saved;
}

export async function getOwnPortalRecordings(userId: string) {
  const db = getDbClient();
  const attended = db.select({ id: attendanceRecords.id }).from(attendanceRecords).where(and(
    eq(attendanceRecords.eventId, events.id), eq(attendanceRecords.participantId, eventParticipants.id),
    inArray(attendanceRecords.attendanceStatus, ATTENDED_STATUSES),
  ));
  const participation = db.select({ id: eventParticipants.id }).from(eventParticipants)
    .innerJoin(ustadzProfiles, eq(ustadzProfiles.id, eventParticipants.ustadzId))
    .where(and(
      eq(eventParticipants.eventId, events.id), portalProfileOwnership(userId),
      eq(ustadzProfiles.profileStatus, "ACTIVE"), isNull(ustadzProfiles.deletedAt), isNull(ustadzProfiles.mergedIntoId),
      eq(eventParticipants.approvalStatus, "APPROVED"),
      notInArray(eventParticipants.confirmationStatus, INACTIVE_CONFIRMATION_STATUSES),
      or(eq(eventParticipants.confirmationStatus, "CONFIRMED"), eq(events.attendanceConfirmationRequired, false), exists(attended)),
    ));
  const rows = await db.select({ event: eventSummary, recording }).from(eventRecordings)
    .innerJoin(events, eq(events.id, eventRecordings.eventId))
    .where(and(
      eq(eventRecordings.published, true), notInArray(events.status, ["DRAFT", "CANCELLED"]),
      sql`${events.startDate} <= timezone(${events.timezone}, current_timestamp)::date`,
      exists(participation),
    ))
    .orderBy(desc(events.startDate), asc(events.name), asc(events.id), asc(eventRecordings.createdAt), asc(eventRecordings.id));

  const groups = new Map<string, PortalRecordingGroup>();
  for (const row of rows) {
    const group = groups.get(row.event.id);
    if (group) group.recordings.push(row.recording);
    else groups.set(row.event.id, { ...row.event, recordings: [row.recording] });
  }
  return [...groups.values()];
}
