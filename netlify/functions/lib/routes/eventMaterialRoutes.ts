import type { HandlerEvent } from "@netlify/functions";
import { z } from "zod";
import { hasPortalAccess } from "../../../../src/config/portalAccess";
import { MATERIAL_KINDS, MATERIAL_SOURCE_LIMIT, materialSourceError, parseMaterialSource, type MaterialKind } from "../../../../src/lib/eventMaterial";
import { parseRecordingSource, RECORDING_TITLE_MAX, RECORDING_URL_ERROR, RECORDING_URL_MAX } from "../../../../src/lib/eventRecording";
import { requireAuth, requirePermission, type UserContext } from "../middleware/rbac";
import {
  allowedMaterialStorage, getEventMaterials, getEventRecordings, getOwnMaterialPdfSource, getOwnPortalMaterials, getOwnPortalRecordings, saveEventMaterial, setMaterialCompletion,
} from "../services/eventMaterialService";
import { getMaterialPdfPart } from "../services/materialPdfPreview";
import { ForbiddenError, ValidationError } from "../utils/errors";
import { buildSuccessResponse } from "../utils/response";
import { validateRequestData } from "../utils/validator";

const itemId = z.string().uuid("ID event, materi, atau sesi tidak valid.");
const title = z.string().trim().min(1, "Isi judul materi.").max(RECORDING_TITLE_MAX);
const url = z.string().trim().max(RECORDING_URL_MAX);
const base = { title, published: z.boolean() };
const legacyInput = z.object({ ...base, url }).strict();
const materialInput = z.object({
  ...base, kind: z.enum(MATERIAL_KINDS), sessionId: itemId.nullable().default(null),
  urls: z.array(url).min(1).max(MATERIAL_SOURCE_LIMIT),
}).strict();
const completionInput = z.object({ completed: z.boolean() }).strict();
const pdfPreviewInput = z.object({ url }).strict();

function privateResponse(data: unknown, requestId: string, status = 200) {
  const response = buildSuccessResponse(data, requestId, null, status);
  return { ...response, headers: { ...response.headers, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } };
}

function readWriteBody(request: HandlerEvent) {
  if (["cross-site", "same-site"].includes(request.headers["sec-fetch-site"] || "")) {
    throw new ForbiddenError("Perubahan materi harus dikirim dari portal.");
  }
  try {
    return JSON.parse(request.body || "{}") as unknown;
  } catch {
    throw new ValidationError("Data materi harus berformat JSON.");
  }
}

function requireAsatidz(userSession: UserContext | null) {
  const session = requireAuth(userSession);
  if (!hasPortalAccess("ustadz", session.assignments)) throw new ForbiddenError("Materi tersedia di Portal Asatidz.");
  return session;
}

function normalizeSources(kind: MaterialKind, urls: string[]) {
  const storageHosts = allowedMaterialStorage();
  const normalized = urls.map((value, index) => {
    const source = parseMaterialSource(kind, value, storageHosts);
    if (!source) throw new ValidationError(`Tautan sumber ${index + 1} belum valid. ${materialSourceError(kind, value)}`);
    return source.url;
  });
  if (new Set(normalized).size !== normalized.length) throw new ValidationError("Gunakan tautan yang berbeda untuk setiap sumber.");
  return normalized;
}

export async function handleEventMaterialRoute(
  request: HandlerEvent, path: string, method: string, userSession: UserContext | null, requestId: string,
) {
  if ((path === "/portal/materials" || path === "/portal/recordings") && method === "GET") {
    const { userId } = requireAsatidz(userSession);
    return privateResponse(await (path.endsWith("/materials") ? getOwnPortalMaterials(userId) : getOwnPortalRecordings(userId)), requestId);
  }
  const portalPdf = path.match(/^\/portal\/materials\/([^/]+)\/pdf-preview$/);
  if (portalPdf && method === "POST") {
    const { userId } = requireAsatidz(userSession);
    const materialId = validateRequestData(itemId, portalPdf[1]);
    const input = validateRequestData(pdfPreviewInput, readWriteBody(request));
    const source = await getOwnMaterialPdfSource(userId, materialId, input.url);
    return getMaterialPdfPart(source, request.headers.range || request.headers.Range, userId, requestId);
  }
  const adminPdf = path.match(/^\/events\/([^/]+)\/materials\/pdf-preview$/);
  if (adminPdf && method === "POST") {
    const { userId } = requireAuth(userSession);
    requirePermission(userSession, "events.update", validateRequestData(itemId, adminPdf[1]));
    const input = validateRequestData(pdfPreviewInput, readWriteBody(request));
    const source = parseMaterialSource("PDF", input.url, allowedMaterialStorage());
    if (source?.provider !== "S3") throw new ValidationError("Gunakan tautan PDF dari penyimpanan S3.");
    return getMaterialPdfPart(source, request.headers.range || request.headers.Range, userId, requestId);
  }
  const completion = path.match(/^\/portal\/materials\/([^/]+)\/completion$/);
  if (completion && method === "PUT") {
    const { userId } = requireAsatidz(userSession);
    const materialId = validateRequestData(itemId, completion[1]);
    const { completed } = validateRequestData(completionInput, readWriteBody(request));
    return privateResponse(await setMaterialCompletion(userId, materialId, completed), requestId);
  }

  const route = path.match(/^\/events\/([^/]+)\/(materials|recordings)(?:\/([^/]+))?$/);
  if (!route) return null;
  const [, eventParam, section, materialParam] = route;
  const listing = !materialParam && method === "GET";
  const creating = !materialParam && method === "POST";
  if (!listing && !creating && !(materialParam && method === "PATCH")) return null;

  const session = requireAuth(userSession);
  const eventId = validateRequestData(itemId, eventParam);
  requirePermission(session, "events.update", eventId);
  const legacy = section === "recordings";
  if (listing) return privateResponse(await (legacy ? getEventRecordings(eventId) : getEventMaterials(eventId)), requestId);

  const materialId = creating ? undefined : validateRequestData(itemId, materialParam);
  const body = readWriteBody(request);
  const status = creating ? 201 : 200;
  if (legacy) {
    const input = validateRequestData(creating ? legacyInput.extend({ published: z.boolean().default(false) }) : legacyInput, body);
    const source = parseRecordingSource(input.url);
    if (!source) throw new ValidationError(RECORDING_URL_ERROR);
    return privateResponse(await saveEventMaterial(eventId, materialId, { title: input.title, kind: "VIDEO",
      published: input.published, urls: [source.url] }, session.userId, requestId, true), requestId, status);
  }
  const input = validateRequestData(creating ? materialInput.extend({ published: z.boolean().default(false) }) : materialInput, body);
  return privateResponse(await saveEventMaterial(eventId, materialId, { ...input, urls: normalizeSources(input.kind, input.urls) },
    session.userId, requestId), requestId, status);
}
