import type { HandlerEvent } from "@netlify/functions";
import { z } from "zod";
import { hasPortalAccess } from "../../../../src/config/portalAccess";
import { parseRecordingSource, RECORDING_TITLE_MAX, RECORDING_URL_ERROR, RECORDING_URL_MAX } from "../../../../src/lib/eventRecording";
import { requireAuth, requirePermission, type UserContext } from "../middleware/rbac";
import { getEventRecordings, getOwnPortalRecordings, saveEventRecording } from "../services/eventRecordingService";
import { ForbiddenError, ValidationError } from "../utils/errors";
import { buildSuccessResponse } from "../utils/response";
import { validateRequestData } from "../utils/validator";

const itemId = z.string().uuid("ID event atau rekaman tidak valid.");
const saveInput = z.object({
  title: z.string().trim().min(1, "Isi judul rekaman.").max(RECORDING_TITLE_MAX),
  url: z.string().trim().max(RECORDING_URL_MAX),
  published: z.boolean(),
}).strict();

function privateResponse(data: unknown, requestId: string, status = 200) {
  const response = buildSuccessResponse(data, requestId, null, status);
  return { ...response, headers: { ...response.headers, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } };
}

export async function handleEventRecordingRoute(
  request: HandlerEvent, path: string, method: string, userSession: UserContext | null, requestId: string,
) {
  if (path === "/portal/recordings" && method === "GET") {
    const session = requireAuth(userSession);
    if (!hasPortalAccess("ustadz", session.assignments)) throw new ForbiddenError("Rekaman tersedia di Portal Asatidz.");
    return privateResponse(await getOwnPortalRecordings(session.userId), requestId);
  }

  const route = path.match(/^\/events\/([^/]+)\/recordings(?:\/([^/]+))?$/);
  if (!route) return null;
  const [, eventParam, recordingParam] = route;
  const listing = !recordingParam && method === "GET";
  const creating = !recordingParam && method === "POST";
  if (!listing && !creating && !(recordingParam && method === "PATCH")) return null;
  const session = requireAuth(userSession);
  const eventId = validateRequestData(itemId, eventParam);
  requirePermission(session, "events.update", eventId);
  if (listing) return privateResponse(await getEventRecordings(eventId), requestId);

  if (["cross-site", "same-site"].includes(request.headers["sec-fetch-site"] || "")) {
    throw new ForbiddenError("Perubahan rekaman harus dikirim dari Portal Admin.");
  }
  let body: unknown;
  try {
    body = JSON.parse(request.body || "{}");
  } catch {
    throw new ValidationError("Data rekaman harus berformat JSON.");
  }
  const input = validateRequestData(creating
    ? saveInput.extend({ published: z.boolean().default(false) })
    : saveInput, body);
  const source = parseRecordingSource(input.url);
  if (!source) throw new ValidationError(RECORDING_URL_ERROR);
  const recordingId = creating ? undefined : validateRequestData(itemId, recordingParam);
  const saved = await saveEventRecording(eventId, recordingId, { ...input, url: source.url }, session.userId, requestId);
  return privateResponse(saved, requestId, creating ? 201 : 200);
}
