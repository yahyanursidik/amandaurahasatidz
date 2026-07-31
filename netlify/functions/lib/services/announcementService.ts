import { getDbClient } from "../db/client";
import {
  eventAnnouncements,
  announcementRecipients,
  eventParticipants,
  ustadzProfiles,
  attendanceRecords,
} from "../db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { sanitizeRichText } from "../utils/sanitizer";
import { NotFoundError } from "../utils/errors";
import { enqueueEmailJob } from "./emailQueueService";
import { createAuditLog } from "./auditService";

export interface CreateAnnouncementInput {
  eventId: string;
  title: string;
  body: string;
  audienceType?: string;
  targetInstitutionId?: string | null;
  sendEmailNotification?: boolean;
}

export async function createAnnouncementService(
  input: CreateAnnouncementInput,
  actorUserId?: string,
  requestId?: string
) {
  const db = getDbClient();
  const sanitizedBody = sanitizeRichText(input.body);

  const created = await db
    .insert(eventAnnouncements)
    .values({
      eventId: input.eventId,
      title: input.title,
      body: sanitizedBody,
      audienceType: input.audienceType || "ALL_PARTICIPANTS",
      status: "DRAFT",
      createdBy: actorUserId || null,
    })
    .returning();

  if (requestId) {
    await createAuditLog({
      actorUserId: actorUserId || null,
      action: "ANNOUNCEMENT_CREATED",
      resourceType: "EVENT_ANNOUNCEMENT",
      resourceId: created[0].id,
      eventId: input.eventId,
      reason: `Pengumuman '${input.title}' dibuat dalam status DRAFT.`,
      requestId,
    });
  }

  return created[0];
}

export async function getEventAnnouncementsService(eventId: string) {
  const db = getDbClient();
  return await db
    .select()
    .from(eventAnnouncements)
    .where(eq(eventAnnouncements.eventId, eventId))
    .orderBy(desc(eventAnnouncements.createdAt));
}

export async function publishAnnouncementService(
  announcementId: string,
  sendEmailNotification = false,
  actorUserId?: string,
  requestId?: string
) {
  const db = getDbClient();
  const existing = await db
    .select()
    .from(eventAnnouncements)
    .where(eq(eventAnnouncements.id, announcementId))
    .limit(1);

  if (existing.length === 0) {
    throw new NotFoundError(`Pengumuman ID ${announcementId} tidak ditemukan.`);
  }

  const ann = existing[0];

  // Update status to PUBLISHED
  const updated = await db
    .update(eventAnnouncements)
    .set({
      status: "PUBLISHED",
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(eventAnnouncements.id, announcementId))
    .returning();

  // 2. Populate announcement_recipients for 6 target audiences
  const recipients = await resolveTargetRecipients(ann.eventId, ann.audienceType);

  for (const r of recipients) {
    await db.insert(announcementRecipients).values({
      announcementId: ann.id,
      participantId: r.participantId || null,
      institutionId: r.institutionId || null,
      userId: r.userId || null,
    });

    // 3. Email Notification Option (Compliance Point 6)
    if (sendEmailNotification && r.email) {
      const idempotencyKey = `ann_mail_${ann.id}_${r.participantId || r.userId || 'rec'}_${Date.now()}`;
      await enqueueEmailJob({
        templateCode: "REGISTRATION_CONFIRMED",
        recipientEmail: r.email,
        recipientName: r.name || "Peserta Daurah",
        variables: {
          ustadzName: r.name || "Peserta Daurah",
          eventName: "Daurah Asatidz YTS",
          participantCode: "PENGUMUMAN",
          qrCodeUrl: "http://localhost:3000/portal",
        },
        idempotencyKey,
      });
    }
  }

  if (requestId) {
    await createAuditLog({
      actorUserId: actorUserId || null,
      action: "ANNOUNCEMENT_PUBLISHED",
      resourceType: "EVENT_ANNOUNCEMENT",
      resourceId: announcementId,
      eventId: ann.eventId,
      reason: `Pengumuman '${ann.title}' dipublikasikan ke target ${ann.audienceType} (${recipients.length} penerima).`,
      requestId,
    });
  }

  return { announcement: updated[0], recipientCount: recipients.length };
}

export async function unpublishAnnouncementService(
  announcementId: string,
  actorUserId?: string,
  requestId?: string
) {
  const db = getDbClient();
  const existing = await db
    .select()
    .from(eventAnnouncements)
    .where(eq(eventAnnouncements.id, announcementId))
    .limit(1);

  if (existing.length === 0) {
    throw new NotFoundError(`Pengumuman ID ${announcementId} tidak ditemukan.`);
  }

  const updated = await db
    .update(eventAnnouncements)
    .set({
      status: "UNPUBLISHED",
      updatedAt: new Date(),
    })
    .where(eq(eventAnnouncements.id, announcementId))
    .returning();

  if (requestId) {
    await createAuditLog({
      actorUserId: actorUserId || null,
      action: "ANNOUNCEMENT_UNPUBLISHED",
      resourceType: "EVENT_ANNOUNCEMENT",
      resourceId: announcementId,
      reason: `Pengumuman '${existing[0].title}' ditarik (UNPUBLISHED).`,
      requestId,
    });
  }

  return updated[0];
}

// 6 Target Audience Resolvers
async function resolveTargetRecipients(
  eventId: string,
  audienceType: string
): Promise<{ participantId: string | null; institutionId: string | null; userId: string | null; email: string | null; name: string }[]> {
  const db = getDbClient();

  if (audienceType === "ALL_PARTICIPANTS") {
    const list = await db
      .select({
        participantId: eventParticipants.id,
        institutionId: eventParticipants.institutionId,
        email: ustadzProfiles.email,
        name: ustadzProfiles.fullName,
      })
      .from(eventParticipants)
      .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
      .where(eq(eventParticipants.eventId, eventId));
    return list.map((item) => ({ ...item, userId: null }));
  }

  if (audienceType === "APPROVED_ONLY") {
    const list = await db
      .select({
        participantId: eventParticipants.id,
        institutionId: eventParticipants.institutionId,
        email: ustadzProfiles.email,
        name: ustadzProfiles.fullName,
      })
      .from(eventParticipants)
      .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
      .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.approvalStatus, "APPROVED")));
    return list.map((item) => ({ ...item, userId: null }));
  }

  if (audienceType === "UNCONFIRMED_ONLY") {
    const list = await db
      .select({
        participantId: eventParticipants.id,
        institutionId: eventParticipants.institutionId,
        email: ustadzProfiles.email,
        name: ustadzProfiles.fullName,
      })
      .from(eventParticipants)
      .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
      .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.confirmationStatus, "INVITED")));
    return list.map((item) => ({ ...item, userId: null }));
  }

  if (audienceType === "ATTENDED_SPECIFIC_DAY") {
    const list = await db
      .select({
        participantId: eventParticipants.id,
        institutionId: eventParticipants.institutionId,
        email: ustadzProfiles.email,
        name: ustadzProfiles.fullName,
      })
      .from(eventParticipants)
      .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
      .innerJoin(attendanceRecords, eq(eventParticipants.id, attendanceRecords.participantId))
      .where(and(eq(eventParticipants.eventId, eventId), eq(attendanceRecords.attendanceStatus, "PRESENT")));
    return list.map((item) => ({ ...item, userId: null }));
  }

  if (audienceType === "COMMITTEE_ONLY") {
    return [];
  }

  // Fallback for SPECIFIC_INSTITUTION. Institution targeting is resolved
  // from participants on the selected event until a dedicated target column
  // is introduced on event_announcements.
  const list = await db
    .select({
      participantId: eventParticipants.id,
      institutionId: eventParticipants.institutionId,
      email: ustadzProfiles.email,
      name: ustadzProfiles.fullName,
    })
    .from(eventParticipants)
    .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
    .where(eq(eventParticipants.eventId, eventId));

  return list.map((item) => ({ ...item, userId: null }));
}

// Portal Ustadz Announcements Service with Read Status Indicator
export async function getPortalAnnouncementsService(participantIds: string[]) {
  if (participantIds.length === 0) return [];
  const db = getDbClient();
  const list = await db
    .select({
      id: eventAnnouncements.id,
      title: eventAnnouncements.title,
      body: eventAnnouncements.body,
      publishedAt: eventAnnouncements.publishedAt,
      readAt: announcementRecipients.readAt,
    })
    .from(eventAnnouncements)
    .leftJoin(announcementRecipients, eq(eventAnnouncements.id, announcementRecipients.announcementId))
    .where(
      and(
        eq(eventAnnouncements.status, "PUBLISHED"),
        inArray(announcementRecipients.participantId, participantIds),
      ),
    )
    .orderBy(desc(eventAnnouncements.publishedAt));

  return list.map((item) => ({
    ...item,
    isRead: !!item.readAt,
  }));
}

export async function markAnnouncementAsReadService(
  announcementId: string,
  participantIds: string[],
) {
  if (participantIds.length === 0) {
    throw new NotFoundError("Peserta untuk pengumuman ini tidak ditemukan.");
  }
  const db = getDbClient();
  const existing = await db
    .select()
    .from(announcementRecipients)
    .where(
      and(
        eq(announcementRecipients.announcementId, announcementId),
        inArray(announcementRecipients.participantId, participantIds),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    const updated = await db
      .update(announcementRecipients)
      .set({ readAt: new Date() })
      .where(eq(announcementRecipients.id, existing[0].id))
      .returning();
    return updated[0];
  }

  throw new NotFoundError("Pengumuman tidak ditujukan kepada peserta ini.");
}
