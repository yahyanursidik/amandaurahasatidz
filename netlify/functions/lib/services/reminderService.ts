import { getDbClient } from "../db/client";
import { attendanceRecords, eventDays, eventParticipants, events, ustadzProfiles } from "../db/schema";
import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { enqueueEmailJob } from "./emailQueueService";
import { NotFoundError, ValidationError } from "../utils/errors";

export type SegmentType = "APPROVED_PARTICIPANTS" | "ATTENDED_PREVIOUS_DAY";
export const REMINDER_SEGMENTS: SegmentType[] = ["APPROVED_PARTICIPANTS", "ATTENDED_PREVIOUS_DAY"];

export function convertEventTimeToUtc(dateStr: string, timeStr: string, timezone = "Asia/Jakarta"): Date {
  const offset = timezone === "Asia/Makassar" ? 8 : timezone === "Asia/Jayapura" ? 9 : 7;
  return new Date(`${dateStr}T${timeStr}:00+0${offset}:00`);
}

function jakartaDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export async function querySegmentTargetsService(segment: SegmentType, eventId: string, now = new Date()) {
  if (!REMINDER_SEGMENTS.includes(segment)) throw new ValidationError("Segmen pengingat tidak dikenal.");
  const db = getDbClient();
  const participants = await db.select({
    participantId: eventParticipants.id,
    participantCode: eventParticipants.participantCode,
    ustadzName: ustadzProfiles.fullName,
    email: ustadzProfiles.email,
  }).from(eventParticipants)
    .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
    .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.approvalStatus, "APPROVED")));
  if (segment === "APPROVED_PARTICIPANTS") return participants.filter((item) => item.email);

  // Hari acara dapat tidak berurutan; ambil hari terjadwal terakhir yang sudah berlalu.
  const previousDay = (await db.select({ id: eventDays.id }).from(eventDays)
    .where(and(eq(eventDays.eventId, eventId), lt(eventDays.date, jakartaDate(now))))
    .orderBy(desc(eventDays.date)).limit(1))[0];
  const dayIds = previousDay ? [previousDay.id] : [];
  if (!dayIds.length) return [];
  const attended = await db.select({ participantId: attendanceRecords.participantId }).from(attendanceRecords)
    .where(and(inArray(attendanceRecords.eventDayId, dayIds), eq(attendanceRecords.attendanceStatus, "PRESENT")));
  const attendedIds = new Set(attended.map((row) => row.participantId));
  return participants.filter((item) => item.email && attendedIds.has(item.participantId));
}

export async function processScheduledReminderService(segment: SegmentType, eventId: string, requestId = "req-reminder", now = new Date()) {
  if (!REMINDER_SEGMENTS.includes(segment)) throw new ValidationError("Segmen pengingat tidak dikenal.");
  const db = getDbClient();
  const event = (await db.select({ name: events.name, startDate: events.startDate, endDate: events.endDate, venueName: events.venueName })
    .from(events).where(eq(events.id, eventId)).limit(1))[0];
  if (!event) throw new NotFoundError("Program untuk pengingat tidak ditemukan.");
  const targets = await querySegmentTargetsService(segment, eventId, now);
  const eventDates = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(new Date(`${event.startDate}T00:00:00+07:00`));
  const daysRemaining = Math.max(0, Math.ceil((new Date(`${event.startDate}T00:00:00+07:00`).getTime() - now.getTime()) / 86_400_000));
  const upcomingDay = segment === "ATTENDED_PREVIOUS_DAY" ? (await db.select({ date: eventDays.date }).from(eventDays)
    .where(and(eq(eventDays.eventId, eventId), gte(eventDays.date, jakartaDate(now))))
    .orderBy(asc(eventDays.date)).limit(1))[0] : null;
  if (segment === "ATTENDED_PREVIOUS_DAY" && !upcomingDay) throw new ValidationError("Tidak ada hari acara berikutnya untuk dikirimkan pengingat.");
  const nextDate = upcomingDay ? new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(new Date(`${upcomingDay.date}T00:00:00+07:00`)) : "";
  let enqueuedCount = 0;
  for (const person of targets) {
    if (!person.email) continue;
    const result = await enqueueEmailJob({
      templateCode: segment === "ATTENDED_PREVIOUS_DAY" ? "EVENT_CONTINUATION_REMINDER" : "EVENT_REMINDER", recipientEmail: person.email, recipientName: person.ustadzName,
      variables: segment === "ATTENDED_PREVIOUS_DAY"
        ? { ustadzName: person.ustadzName, eventName: event.name, nextDate, eventVenue: event.venueName || "Lokasi menyusul", participantCode: person.participantCode, portalLink: `${process.env.APP_URL || ""}/portal/activities` }
        : { ustadzName: person.ustadzName, eventName: event.name, eventDates, eventVenue: event.venueName || "Lokasi menyusul", participantCode: person.participantCode, daysRemaining, portalLink: `${process.env.APP_URL || ""}/portal/activities` },
      idempotencyKey: `rem_${segment}_${eventId}_${person.participantId}_${jakartaDate(now)}`,
    });
    if (!result.isDuplicate) enqueuedCount++;
  }
  return { segment, eventId, targetsCount: targets.length, enqueuedCount };
}
