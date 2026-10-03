import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDbClient } from "../db/client";
import { eventCommunicationTemplates } from "../db/schema";
import { NotFoundError } from "../utils/errors";
import { communicationTemplateSchema, updateCommunicationTemplateSchema } from "../validations/announcementValidation";
import { requireCommunicationEvent } from "./announcementService";
import { createAuditLog } from "./auditService";

export async function listCommunicationTemplatesService(eventId: string) {
  await requireCommunicationEvent(eventId);
  return getDbClient().select().from(eventCommunicationTemplates)
    .where(and(eq(eventCommunicationTemplates.eventId, eventId), isNull(eventCommunicationTemplates.archivedAt)))
    .orderBy(asc(eventCommunicationTemplates.name), asc(eventCommunicationTemplates.id));
}

export async function saveCommunicationTemplateService(eventId: string, templateId: string | null,
  input: z.infer<typeof communicationTemplateSchema> | z.infer<typeof updateCommunicationTemplateSchema>, actorUserId: string, requestId: string) {
  await requireCommunicationEvent(eventId);
  const db = getDbClient();
  const fields = { ...input, ...(input.emailSubject !== undefined ? { emailSubject: input.emailSubject?.trim() || null } : {}) };
  const saved = templateId
    ? (await db.update(eventCommunicationTemplates).set({ ...fields, updatedAt: new Date() })
      .where(and(eq(eventCommunicationTemplates.id, templateId), eq(eventCommunicationTemplates.eventId, eventId),
        isNull(eventCommunicationTemplates.archivedAt))).returning())[0]
    : (await db.insert(eventCommunicationTemplates).values({ ...fields as z.infer<typeof communicationTemplateSchema>, eventId,
      createdBy: actorUserId }).returning())[0];
  if (!saved) throw new NotFoundError("Template tidak ditemukan dalam program ini.");
  await createAuditLog({ actorUserId, action: templateId ? "COMMUNICATION_TEMPLATE_UPDATED" : "COMMUNICATION_TEMPLATE_CREATED",
    resourceType: "EVENT_COMMUNICATION_TEMPLATE", resourceId: saved.id, eventId, requestId });
  return saved;
}

export async function archiveCommunicationTemplateService(eventId: string, templateId: string, actorUserId: string, requestId: string) {
  await requireCommunicationEvent(eventId);
  const saved = (await getDbClient().update(eventCommunicationTemplates).set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(eventCommunicationTemplates.id, templateId), eq(eventCommunicationTemplates.eventId, eventId),
      isNull(eventCommunicationTemplates.archivedAt))).returning())[0];
  if (!saved) throw new NotFoundError("Template tidak ditemukan dalam program ini.");
  await createAuditLog({ actorUserId, action: "COMMUNICATION_TEMPLATE_ARCHIVED", resourceType: "EVENT_COMMUNICATION_TEMPLATE",
    resourceId: templateId, eventId, requestId });
  return saved;
}