import { getDbClient } from "../db/client";
import { eventAnnouncements, announcementRecipients, eventParticipants, events, ustadzProfiles, attendanceRecords,
  institutions, eventCommitteeAssignments, users } from "../db/schema";
import { eq, and, desc, inArray, asc, isNull, ne, or, lte, gte, sql } from "drizzle-orm";
import { ConflictError, NotFoundError, ValidationError } from "../utils/errors";
import { enqueueEmailJob } from "./emailQueueService";
import { createAuditLog } from "./auditService";
import { buildCommunicationPreview, communicationVariables, legacyCommunicationText, normalizeCommunicationEmail,
  renderFinalCommunication, type CommunicationRecipient } from "./communicationRendering";

export interface CreateAnnouncementInput {
  eventId: string;
  title: string;
  body: string;
  emailSubject?: string | null;
  audienceType?: string;
  targetInstitutionId?: string | null;
  sendEmailNotification?: boolean;
}

export async function requireCommunicationEvent(eventId: string) {
  const event = (await getDbClient().select().from(events).where(eq(events.id, eventId)).limit(1))[0];
  if (!event) throw new NotFoundError("Program pengumuman tidak ditemukan.");
  return event;
}

async function findScopedAnnouncement(eventId: string, announcementId: string) {
  const ann = (await getDbClient().select().from(eventAnnouncements)
    .where(and(eq(eventAnnouncements.id, announcementId), eq(eventAnnouncements.eventId, eventId))).limit(1))[0];
  if (!ann) throw new NotFoundError("Pengumuman tidak ditemukan dalam program ini.");
  return ann;
}

function draftFields(input: CreateAnnouncementInput) {
  return {
    title: input.title, body: input.body, emailSubject: input.emailSubject?.trim() || null,
    sendEmailNotification: input.sendEmailNotification ?? false,
    audienceType: input.audienceType || "ALL_PARTICIPANTS",
    targetInstitutionId: input.audienceType === "SPECIFIC_INSTITUTION" ? input.targetInstitutionId || null : null,
    contentFormat: "PLAIN_TEXT",
  };
}

// PostgreSQL defaults may contain microseconds; JS Date exposes milliseconds.
// Compare the same precision as the revision returned to the editor, including legacy rows.
function matchesAnnouncementRevision(updatedAt: Date) {
  return sql`date_trunc('milliseconds', ${eventAnnouncements.updatedAt}) = ${updatedAt.toISOString()}::timestamptz`;
}

function nextAnnouncementRevision(updatedAt: Date) {
  return new Date(Math.max(Date.now(), updatedAt.getTime() + 1));
}

export async function createAnnouncementService(input: CreateAnnouncementInput, actorUserId?: string, requestId?: string) {
  await requireCommunicationEvent(input.eventId);
  const now = new Date();
  const created = (await getDbClient().insert(eventAnnouncements).values({
    ...draftFields(input), eventId: input.eventId, status: "DRAFT", createdBy: actorUserId || null,
    createdAt: now, updatedAt: now,
  }).returning())[0];
  if (requestId) await createAuditLog({ actorUserId: actorUserId || null, action: "ANNOUNCEMENT_CREATED",
    resourceType: "EVENT_ANNOUNCEMENT", resourceId: created.id, eventId: input.eventId,
    reason: `Pengumuman '${input.title}' dibuat dalam status DRAFT.`, requestId });
  return created;
}

export async function getEventAnnouncementsService(eventId: string) {
  await requireCommunicationEvent(eventId);
  return getDbClient().select().from(eventAnnouncements).where(eq(eventAnnouncements.eventId, eventId))
    .orderBy(desc(eventAnnouncements.createdAt));
}

export async function listCommunicationInstitutionsService(eventId: string) {
  await requireCommunicationEvent(eventId);
  const rows = await getDbClient().select({ id: institutions.id, name: institutions.name })
    .from(eventParticipants).innerJoin(institutions, eq(eventParticipants.institutionId, institutions.id))
    .where(eq(eventParticipants.eventId, eventId)).orderBy(asc(institutions.name), asc(institutions.id));
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

export async function updateAnnouncementService(eventId: string, announcementId: string, input: CreateAnnouncementInput,
  actorUserId?: string, requestId?: string) {
  await requireCommunicationEvent(eventId);
  const existing = await findScopedAnnouncement(eventId, announcementId);
  if (!["DRAFT", "UNPUBLISHED"].includes(existing.status)) throw new ConflictError("Pengumuman terpublikasi atau sedang dipublikasikan tidak dapat diedit.");
  const updated = (await getDbClient().update(eventAnnouncements).set({ ...draftFields(input), updatedAt: nextAnnouncementRevision(existing.updatedAt) })
    .where(and(eq(eventAnnouncements.id, announcementId), eq(eventAnnouncements.eventId, eventId),
      eq(eventAnnouncements.status, existing.status), matchesAnnouncementRevision(existing.updatedAt))).returning())[0];
  if (!updated) throw new ConflictError("Pengumuman berubah. Muat ulang sebelum mengedit.");
  if (requestId) await createAuditLog({ actorUserId: actorUserId || null, action: "ANNOUNCEMENT_UPDATED",
    resourceType: "EVENT_ANNOUNCEMENT", resourceId: announcementId, eventId, requestId });
  return updated;
}

export async function previewAnnouncementService(input: CreateAnnouncementInput) {
  const event = await requireCommunicationEvent(input.eventId);
  const recipients = await resolveTargetRecipients(input.eventId, input.audienceType || "ALL_PARTICIPANTS", input.targetInstitutionId || null);
  return buildCommunicationPreview({ ...input, contentFormat: "PLAIN_TEXT" }, event, recipients);
}

export async function previewSavedAnnouncementService(eventId: string, announcementId: string) {
  const event = await requireCommunicationEvent(eventId);
  const ann = await findScopedAnnouncement(eventId, announcementId);
  const recipients = await resolveTargetRecipients(eventId, ann.audienceType, ann.targetInstitutionId);
  return { ...buildCommunicationPreview(ann, event, recipients), updatedAt: ann.updatedAt.toISOString(), expectedUpdatedAt: ann.updatedAt.toISOString() };
}

// Event id is required: a scoped URL must never operate on another event.
export async function publishAnnouncementService(eventId: string, announcementId: string, sendEmailNotification?: boolean,
  actorUserId?: string, requestId?: string, expectedUpdatedAt?: string) {
  const db = getDbClient();
  const event = await requireCommunicationEvent(eventId);
  const existing = await findScopedAnnouncement(eventId, announcementId);
  if (expectedUpdatedAt && existing.updatedAt.toISOString() !== expectedUpdatedAt) throw new ConflictError("Draft berubah setelah pratinjau. Pratinjau ulang sebelum publikasi.");
  if (existing.contentFormat === "PLAIN_TEXT") {
    if (!expectedUpdatedAt) throw new ValidationError("Pratinjau draft tersimpan sebelum publikasi.");
    if (sendEmailNotification !== undefined && sendEmailNotification !== existing.sendEmailNotification) {
      throw new ConflictError("Pilihan email berubah. Simpan draft dan pratinjau ulang sebelum publikasi.");
    }
  }
  if (!["DRAFT", "UNPUBLISHED"].includes(existing.status)) throw new ConflictError("Pengumuman sudah atau sedang dipublikasikan.");
  const ann = { ...existing, sendEmailNotification: sendEmailNotification ?? existing.sendEmailNotification };
  const recipients = await resolveTargetRecipients(eventId, ann.audienceType, ann.targetInstitutionId);
  const preview = buildCommunicationPreview(ann, event, recipients);
  if (!recipients.length) throw new ValidationError("Tidak ada penerima dalam audiens ini. Pilih audiens lain sebelum publikasi.");
  if (preview.unresolvedVariables.length) throw new ValidationError("Lengkapi variabel sebelum publikasi.", { unresolvedVariables: preview.unresolvedVariables });

  // Atomic compare-and-set protects concurrent publishes and edits between preview and publish.
  // Neon HTTP lacks interactive transactions: a partial failure keeps the claim locked to prevent double fan-out.
  const claimed = (await db.update(eventAnnouncements).set({ status: "PUBLISHING", sendEmailNotification: ann.sendEmailNotification, updatedAt: nextAnnouncementRevision(existing.updatedAt) })
    .where(and(eq(eventAnnouncements.id, announcementId), eq(eventAnnouncements.eventId, eventId),
      eq(eventAnnouncements.status, existing.status), matchesAnnouncementRevision(existing.updatedAt))).returning())[0];
  if (!claimed) throw new ConflictError("Pengumuman berubah atau publikasi sedang diproses. Muat ulang.");
  // An unpublished draft may change audience. Remove its old access grants before creating the new snapshot.
  await db.delete(announcementRecipients).where(eq(announcementRecipients.announcementId, announcementId));
  const mailedAddresses = new Set<string>();
  let emailEnqueuedCount = 0;
  let emailFailedCount = 0;
  for (const recipient of recipients) {
    const final = renderFinalCommunication(ann, communicationVariables(event, recipient));
    const recipientValues = { announcementId, participantId: recipient.participantId, institutionId: recipient.institutionId,
      userId: recipient.userId, renderedTitle: final.title, renderedBody: final.body };
    await db.insert(announcementRecipients).values(recipientValues).onConflictDoUpdate({
      target: recipient.participantId ? [announcementRecipients.announcementId, announcementRecipients.participantId]
        : [announcementRecipients.announcementId, announcementRecipients.userId],
      set: { renderedTitle: final.title, renderedBody: final.body, readAt: null },
    });
    const email = normalizeCommunicationEmail(recipient.email);
    if (ann.sendEmailNotification && email && !mailedAddresses.has(email)) {
      mailedAddresses.add(email);
      try {
        const queued = await enqueueEmailJob({ templateCode: "ANNOUNCEMENT_CUSTOM", eventId,
          recipientEmail: email, recipientName: recipient.name, variables: {},
          renderedContent: { subject: final.emailSubject, bodyText: `${final.title}\n\n${final.body}`, htmlBody: final.emailHtml },
          idempotencyKey: `ann_mail_${ann.id}_${email}` });
        if (!queued.isDuplicate) emailEnqueuedCount++;
      } catch { emailFailedCount++; }
    }
  }
  const published = (await db.update(eventAnnouncements).set({ status: "PUBLISHED", publishedAt: new Date(), updatedAt: nextAnnouncementRevision(claimed.updatedAt) })
    .where(and(eq(eventAnnouncements.id, announcementId), eq(eventAnnouncements.eventId, eventId), eq(eventAnnouncements.status, "PUBLISHING"))).returning())[0];
  if (!published) throw new ConflictError("Klaim publikasi berubah; hubungi administrator.");
  if (requestId) await createAuditLog({ actorUserId: actorUserId || null, action: "ANNOUNCEMENT_PUBLISHED",
    resourceType: "EVENT_ANNOUNCEMENT", resourceId: announcementId, eventId,
    reason: `Pengumuman '${ann.title}' dipublikasikan (${recipients.length} penerima).`, requestId });
  return { announcement: published, recipientCount: recipients.length, emailEnqueuedCount, emailFailedCount };
}

export async function unpublishAnnouncementService(eventId: string, announcementId: string, actorUserId?: string, requestId?: string) {
  await requireCommunicationEvent(eventId);
  const existing = await findScopedAnnouncement(eventId, announcementId);
  if (existing.status !== "PUBLISHED") throw new ConflictError("Hanya pengumuman terpublikasi dapat ditarik.");
  const updated = (await getDbClient().update(eventAnnouncements).set({ status: "UNPUBLISHED", updatedAt: nextAnnouncementRevision(existing.updatedAt) })
    .where(and(eq(eventAnnouncements.id, announcementId), eq(eventAnnouncements.eventId, eventId), eq(eventAnnouncements.status, "PUBLISHED"))).returning())[0];
  if (!updated) throw new ConflictError("Status pengumuman berubah. Muat ulang.");
  if (requestId) await createAuditLog({ actorUserId: actorUserId || null, action: "ANNOUNCEMENT_UNPUBLISHED",
    resourceType: "EVENT_ANNOUNCEMENT", resourceId: announcementId, eventId,
    reason: `Pengumuman '${existing.title}' ditarik. Email yang sudah dikirim tidak dapat ditarik.`, requestId });
  return updated;
}

export async function resolveTargetRecipients(eventId: string, audienceType: string, targetInstitutionId: string | null): Promise<CommunicationRecipient[]> {
  const db = getDbClient();
  if (audienceType === "COMMITTEE_ONLY") {
    const now = new Date();
    const rows = await db.select({ userId: users.id, email: users.email, name: users.name })
      .from(eventCommitteeAssignments).innerJoin(users, eq(eventCommitteeAssignments.userId, users.id))
      .where(and(eq(eventCommitteeAssignments.eventId, eventId), eq(users.status, "ACTIVE"),
        or(isNull(eventCommitteeAssignments.startsAt), lte(eventCommitteeAssignments.startsAt, now)),
        or(isNull(eventCommitteeAssignments.endsAt), gte(eventCommitteeAssignments.endsAt, now))))
      .orderBy(asc(users.id));
    return [...new Map(rows.map((row) => [row.userId, { ...row, name: row.name || "Panitia", participantId: null,
      institutionId: null, participantCode: null, institutionName: null }])).values()];
  }
  const filters = [eq(eventParticipants.eventId, eventId), isNull(eventParticipants.cancelledAt),
    ne(eventParticipants.approvalStatus, "CANCELLED"), ne(eventParticipants.approvalStatus, "DECLINED")];
  if (audienceType === "SPECIFIC_INSTITUTION") {
    if (!targetInstitutionId) throw new ValidationError("Pilih lembaga tujuan pengumuman.");
    const institution = (await db.select({ id: institutions.id }).from(institutions).where(eq(institutions.id, targetInstitutionId)).limit(1))[0];
    if (!institution) throw new NotFoundError("Lembaga tujuan tidak ditemukan.");
    filters.push(eq(eventParticipants.institutionId, targetInstitutionId));
  } else if (audienceType === "APPROVED_ONLY") filters.push(eq(eventParticipants.approvalStatus, "APPROVED"));
  else if (audienceType === "UNCONFIRMED_ONLY") filters.push(eq(eventParticipants.confirmationStatus, "INVITED"));
  else if (audienceType !== "ALL_PARTICIPANTS" && audienceType !== "ALL" && audienceType !== "ATTENDED_SPECIFIC_DAY") {
    throw new ValidationError("Audiens pengumuman tidak valid.");
  }
  const query = db.select({ participantId: eventParticipants.id, institutionId: eventParticipants.institutionId,
    email: ustadzProfiles.email, name: ustadzProfiles.fullName, participantCode: eventParticipants.participantCode,
    institutionName: institutions.name }).from(eventParticipants)
    .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
    .leftJoin(institutions, eq(eventParticipants.institutionId, institutions.id));
  const rows = audienceType === "ATTENDED_SPECIFIC_DAY"
    ? await query.innerJoin(attendanceRecords, eq(eventParticipants.id, attendanceRecords.participantId))
      .where(and(...filters, eq(attendanceRecords.attendanceStatus, "PRESENT"))).orderBy(asc(eventParticipants.id))
    : await query.where(and(...filters)).orderBy(asc(eventParticipants.id));
  return [...new Map(rows.map((row) => [row.participantId, { ...row, userId: null }])).values()];
}

export async function getPortalAnnouncementsService(participantIds: string[]) {
  if (!participantIds.length) return [];
  const rows = await getDbClient().select({ id: eventAnnouncements.id, title: eventAnnouncements.title,
    body: eventAnnouncements.body, contentFormat: eventAnnouncements.contentFormat,
    renderedTitle: announcementRecipients.renderedTitle, renderedBody: announcementRecipients.renderedBody,
    publishedAt: eventAnnouncements.publishedAt, readAt: announcementRecipients.readAt })
    .from(eventAnnouncements).innerJoin(announcementRecipients, eq(eventAnnouncements.id, announcementRecipients.announcementId))
    .where(and(eq(eventAnnouncements.status, "PUBLISHED"), inArray(announcementRecipients.participantId, participantIds)))
    .orderBy(desc(eventAnnouncements.publishedAt));
  return [...new Map(rows.map((row) => [row.id, {
    id: row.id, title: row.renderedTitle ?? row.title,
    body: row.renderedBody ?? (row.contentFormat === "LEGACY_HTML" ? legacyCommunicationText(row.body) : row.body),
    publishedAt: row.publishedAt, readAt: row.readAt, isRead: !!row.readAt,
  }])).values()];
}

export async function markAnnouncementAsReadService(announcementId: string, participantIds: string[]) {
  if (!participantIds.length) throw new NotFoundError("Peserta untuk pengumuman ini tidak ditemukan.");
  const db = getDbClient();
  const published = (await db.select({ id: eventAnnouncements.id }).from(eventAnnouncements)
    .where(and(eq(eventAnnouncements.id, announcementId), eq(eventAnnouncements.status, "PUBLISHED"))).limit(1))[0];
  if (!published) throw new NotFoundError("Pengumuman terpublikasi tidak ditemukan.");
  const rows = await db.update(announcementRecipients).set({ readAt: new Date() })
    .where(and(eq(announcementRecipients.announcementId, announcementId), inArray(announcementRecipients.participantId, participantIds))).returning();
  if (!rows.length) throw new NotFoundError("Pengumuman tidak ditujukan kepada peserta ini.");
  return rows[0];
}