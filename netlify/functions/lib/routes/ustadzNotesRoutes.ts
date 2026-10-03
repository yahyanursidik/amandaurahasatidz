import type { HandlerEvent } from "@netlify/functions";
import type { UserContext } from "../middleware/rbac";
import { buildErrorResponse, buildSuccessResponse } from "../utils/response";
import { ValidationError } from "../utils/errors";
import { checkRateLimit } from "../utils/rateLimiter";
import { parseYtsNotes, ytsNoteId } from "../validations/ustadzNotesValidation";
import { createYtsNote, getYtsNoteSummaries, listYtsNotes, requireYtsNotes, updateYtsNote } from "../services/ustadzNotesService";

export async function handleUstadzNotesRoute(event: HandlerEvent, path: string, method: string, session: UserContext | null, requestId: string) {
  if (path !== "/admin/ustadz-notes" && !path.startsWith("/admin/ustadz-notes/")) return null;
  const actor = requireYtsNotes(session);
  const success = (data: unknown, status = 200) => {
    const response = buildSuccessResponse(data, requestId, null, status);
    return { ...response, headers: { ...response.headers, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } };
  };
  if (path === "/admin/ustadz-notes/summary" && method === "GET") return success(await getYtsNoteSummaries(actor, event.queryStringParameters || {}));
  const match = path.match(/^\/admin\/ustadz-notes\/([^/]+)(?:\/([^/]+)(?:\/(archive))?)?$/);
  if (!match) return buildErrorResponse("NOT_FOUND", "Catatan YTS tidak ditemukan.", requestId, 404);
  const ustadzId = parseYtsNotes(ytsNoteId, match[1]); const id = match[2] ? parseYtsNotes(ytsNoteId, match[2]) : null;
  if (!id && method === "GET") return success(await listYtsNotes(actor, ustadzId, event.queryStringParameters || {}));
  if ((method === "POST" && !id) || (method === "PATCH" && id)) {
    if (!checkRateLimit(`yts_notes_${actor.userId}`, 40, 600000).allowed) return buildErrorResponse("TOO_MANY_REQUESTS", "Terlalu banyak perubahan. Coba lagi nanti.", requestId, 429);
    let body: unknown; try { body = event.body ? JSON.parse(event.body) : {}; } catch { throw new ValidationError("JSON catatan tidak valid."); }
    return success(id ? await updateYtsNote(actor, ustadzId, id, body, requestId, match[3] === "archive") : await createYtsNote(actor, ustadzId, body, requestId), id ? 200 : 201);
  }
  return buildErrorResponse("NOT_FOUND", "Aksi catatan YTS tidak tersedia.", requestId, 404);
}