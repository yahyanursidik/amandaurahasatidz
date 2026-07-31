import { getDbClient } from "../db/client";
import { invitations, invitationLinks, invitationResponses, eventParticipants, attendanceRecords, ustadzProfiles } from "../db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { enqueueEmailJob } from "./emailQueueService";
import { logInfo } from "../utils/logger";

export type SegmentType =
  | "UNOPENED_LINK"
  | "NO_RESPONSE"
  | "DRAFT_UNFINALIZED"
  | "APPROVED_PARTICIPANTS"
  | "ATTENDED_PREVIOUS_DAY";

// Timezone Conversion Helper (Compliance Point 2 & 3)
export function convertEventTimeToUtc(dateStr: string, timeStr: string, timezone = "Asia/Jakarta"): Date {
  let offsetHours = 7; // WIB (Asia/Jakarta)
  if (timezone === "Asia/Makassar") offsetHours = 8; // WITA
  if (timezone === "Asia/Jayapura") offsetHours = 9; // WIT

  const localIso = `${dateStr}T${timeStr}:00+0${offsetHours}:00`;
  return new Date(localIso);
}

export async function querySegmentTargetsService(segment: SegmentType, eventId: string) {
  const db = getDbClient();

  if (segment === "UNOPENED_LINK") {
    // 1. Link belum pernah dibuka (usedCount = 0)
    return await db
      .select({
        invitationId: invitations.id,
        invitationNumber: invitations.invitationNumber,
        linkId: invitationLinks.id,
      })
      .from(invitations)
      .innerJoin(invitationLinks, eq(invitations.id, invitationLinks.invitationId))
      .where(and(eq(invitations.eventId, eventId), eq(invitationLinks.usedCount, 0)));
  }

  if (segment === "NO_RESPONSE") {
    // 2. Undangan SENT belum direspon
    return await db
      .select({
        invitationId: invitations.id,
        invitationNumber: invitations.invitationNumber,
      })
      .from(invitations)
      .where(and(eq(invitations.eventId, eventId), eq(invitations.status, "SENT"), isNull(invitations.respondedAt)));
  }

  if (segment === "DRAFT_UNFINALIZED") {
    // 3. Respon draft belum final (isFinal = false)
    return await db
      .select({
        invitationId: invitations.id,
        invitationNumber: invitations.invitationNumber,
        responseId: invitationResponses.id,
      })
      .from(invitations)
      .innerJoin(invitationResponses, eq(invitations.id, invitationResponses.invitationId))
      .where(and(eq(invitations.eventId, eventId), eq(invitationResponses.isFinal, false)));
  }

  if (segment === "APPROVED_PARTICIPANTS") {
    // 4. Peserta status APPROVED
    return await db
      .select({
        participantId: eventParticipants.id,
        participantCode: eventParticipants.participantCode,
        ustadzName: ustadzProfiles.fullName,
        email: ustadzProfiles.email,
      })
      .from(eventParticipants)
      .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
      .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.approvalStatus, "APPROVED")));
  }

  if (segment === "ATTENDED_PREVIOUS_DAY") {
    // 5. Peserta hadir presensi hari sebelumnya
    return await db
      .select({
        participantId: eventParticipants.id,
        participantCode: eventParticipants.participantCode,
        ustadzName: ustadzProfiles.fullName,
        email: ustadzProfiles.email,
      })
      .from(eventParticipants)
      .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
      .innerJoin(attendanceRecords, eq(eventParticipants.id, attendanceRecords.participantId))
      .where(and(eq(eventParticipants.eventId, eventId), eq(attendanceRecords.attendanceStatus, "PRESENT")));
  }

  return [];
}

export async function processScheduledReminderService(segment: SegmentType, eventId: string, requestId = "req-reminder") {
  const targets = await querySegmentTargetsService(segment, eventId);
  logInfo(requestId, `Found ${targets.length} targets for segment '${segment}' on event ${eventId}`);

  let enqueuedCount = 0;

  for (const t of targets) {
    const email = (t as any).email || "perwakilan@yts.or.id";
    const name = (t as any).ustadzName || "Perwakilan Lembaga";
    const idempotencyKey = `rem_${segment}_${eventId}_${(t as any).participantId || (t as any).invitationId}_${Date.now()}`;

    await enqueueEmailJob({
      templateCode: segment === "APPROVED_PARTICIPANTS" ? "REGISTRATION_CONFIRMED" : "INVITATION_INDIVIDUAL",
      recipientEmail: email,
      recipientName: name,
      variables: {
        ustadzName: name,
        eventName: "Daurah Asatidz Nasional 2026",
        eventDates: "15-18 Agustus 2026",
        participantCode: (t as any).participantCode || "PAR-001",
        qrCodeUrl: "http://localhost:3000/portal",
        invitationLink: "http://localhost:3000/invitation",
      },
      idempotencyKey,
    });

    enqueuedCount++;
  }

  return { segment, eventId, targetsCount: targets.length, enqueuedCount };
}
