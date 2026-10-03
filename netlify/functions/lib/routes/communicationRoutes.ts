import type { HandlerEvent } from "@netlify/functions";
import { z } from "zod";
import { requireAuth, requirePermission, type UserContext } from "../middleware/rbac";
import { buildSuccessResponse } from "../utils/response";
import { NotFoundError, ValidationError } from "../utils/errors";
import { validateRequestData } from "../utils/validator";
import { createAnnouncementSchema, publishAnnouncementSchema, communicationTemplateSchema,
  updateCommunicationTemplateSchema } from "../validations/announcementValidation";
import { createAnnouncementService, getEventAnnouncementsService, previewAnnouncementService, previewSavedAnnouncementService,
  publishAnnouncementService, unpublishAnnouncementService, updateAnnouncementService, listCommunicationInstitutionsService } from "../services/announcementService";
import { listCommunicationTemplatesService, saveCommunicationTemplateService, archiveCommunicationTemplateService } from "../services/communicationTemplateService";

export async function handleCommunicationRoute(event: HandlerEvent, path: string, method: string, userSession: UserContext | null, requestId: string) {
  const match = path.match(/^\/events\/([^/]+)\/(announcements|communication-templates)(?:\/(.*))?$/);
  if (!match) return null;
  const session = requireAuth(userSession);
  const eventId = validateRequestData(z.string().uuid(), match[1]);
  const resource = match[2];
  const suffix = match[3] || "";
  const savedPreview = resource === "announcements" && /^[^/]+\/preview$/.test(suffix) && method === "POST";
  // Participant read permission grants access to their portal, never the admin draft/recipient inbox.
  const staffSession = { ...session, assignments: session.assignments.filter((assignment) =>
    !["USTADZ", "INSTITUTION_REPRESENTATIVE"].includes(assignment.roleCode)) };
  requirePermission(staffSession, method === "GET" || savedPreview ? "announcements.read"
    : /\/(publish|unpublish)$/.test(`/${suffix}`) ? "announcements.publish" : "announcements.manage", eventId);
  const body = () => {
    try { return event.body ? JSON.parse(event.body) : {}; }
    catch { throw new ValidationError("JSON tidak valid."); }
  };
  const success = (data: unknown) => {
    const response = buildSuccessResponse(data, requestId);
    return { ...response, headers: { ...response.headers, "Cache-Control": "no-store" } };
  };
  if (resource === "communication-templates") {
    if (!suffix && method === "GET") return success(await listCommunicationTemplatesService(eventId));
    if (!suffix && method === "POST") return success(await saveCommunicationTemplateService(eventId, null,
      validateRequestData(communicationTemplateSchema, body()), session.userId, requestId));
    if (suffix && !suffix.includes("/")) {
      const templateId = validateRequestData(z.string().uuid(), suffix);
      if (method === "PATCH") return success(await saveCommunicationTemplateService(eventId, templateId,
        validateRequestData(updateCommunicationTemplateSchema, body()), session.userId, requestId));
      if (method === "DELETE") return success(await archiveCommunicationTemplateService(eventId, templateId, session.userId, requestId));
    }
  } else {
    if (suffix === "institutions" && method === "GET") return success(await listCommunicationInstitutionsService(eventId));
    if (!suffix && method === "GET") return success(await getEventAnnouncementsService(eventId));
    if (!suffix && method === "POST") return success(await createAnnouncementService({
      ...validateRequestData(createAnnouncementSchema, body()), eventId,
    }, session.userId, requestId));
    if (suffix === "preview" && method === "POST") return success(await previewAnnouncementService({
      ...validateRequestData(createAnnouncementSchema, body()), eventId,
    }));
    const action = suffix.match(/^([^/]+)(?:\/(preview|publish|unpublish))?$/);
    if (action) {
      const id = validateRequestData(z.string().uuid(), action[1]);
      if (!action[2] && method === "PATCH") return success(await updateAnnouncementService(eventId, id,
        { ...validateRequestData(createAnnouncementSchema, body()), eventId }, session.userId, requestId));
      if (action[2] === "preview" && method === "POST") return success(await previewSavedAnnouncementService(eventId, id));
      if (action[2] === "publish" && method === "POST") {
        const input = validateRequestData(publishAnnouncementSchema, body());
        return success(await publishAnnouncementService(eventId, id, input.sendEmailNotification, session.userId, requestId, input.expectedUpdatedAt));
      }
      if (action[2] === "unpublish" && method === "POST") return success(await unpublishAnnouncementService(eventId, id, session.userId, requestId));
    }
  }
  throw new NotFoundError("Route komunikasi tidak ditemukan.");
}