import type { HandlerEvent } from "@netlify/functions";
import { z } from "zod";
import { requireAuth, requirePermission, type UserContext } from "../middleware/rbac";
import { buildSuccessResponse, buildErrorResponse } from "../utils/response";
import { validateRequestData } from "../utils/validator";
import { checkRateLimit } from "../utils/rateLimiter";
import {
  listMyThreads, createThread, getThread, addReply, listAdminThreads,
  updateThread, listExperienceBoard, listGreetings, saveGreeting,
} from "../services/ruangAsatidzService";
import {
  createRuangThreadSchema, ruangReplySchema, updateRuangThreadSchema,
  ruangGreetingSchema, ruangListQuerySchema,
} from "../validations/ruangAsatidzValidation";

const pagingSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
const idSchema = z.string().uuid("ID Ruang Asatidz tidak valid.");

export async function handleRuangAsatidzRoute(
  event: HandlerEvent, path: string, method: string, userSession: UserContext | null, requestId: string,
) {
  const admin = path === "/admin/ruang-asatidz" || path.startsWith("/admin/ruang-asatidz/");
  if (!admin && path !== "/ruang-asatidz" && !path.startsWith("/ruang-asatidz/")) return null;
  const session = requireAuth(userSession);
  requirePermission(session, admin ? "ruang_asatidz.manage" : "ruang_asatidz.access");
  const prefix = admin ? "/admin/ruang-asatidz" : "/ruang-asatidz";
  const route = path.slice(prefix.length);
  const query = () => validateRequestData(ruangListQuerySchema, event.queryStringParameters || {});
  const paging = () => validateRequestData(pagingSchema, event.queryStringParameters || {});
  const body = () => {
    try { return event.body ? JSON.parse(event.body) : {}; }
    catch { return validateRequestData(z.never(), undefined); }
  };
  const success = (data: unknown, status = 200) => {
    const response = buildSuccessResponse(data, requestId, null, status);
    return { ...response, headers: { ...response.headers, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } };
  };
  if (["POST", "PATCH"].includes(method)) {
    const rate = checkRateLimit(`ruang_asatidz_${session.userId}`, 40, 600000);
    if (!rate.allowed) return buildErrorResponse("TOO_MANY_REQUESTS", "Terlalu banyak pesan atau perubahan. Coba lagi beberapa menit lagi.", requestId, 429);
  }
  if (route === "/threads" && method === "GET") return success(admin ? await listAdminThreads(query()) : await listMyThreads(session.userId, query()));
  if (route === "/threads" && method === "POST" && !admin) {
    const input = validateRequestData(createRuangThreadSchema, body());
    return success(await createThread(session.userId, input, requestId), 201);
  }
  if (route === "/experiences" && method === "GET" && !admin) return success(await listExperienceBoard(paging()));
  if (route === "/greetings" && method === "GET") return success(await listGreetings(admin, paging()));
  if (route === "/greetings" && method === "POST" && admin) {
    const input = validateRequestData(ruangGreetingSchema, body());
    return success(await saveGreeting(session.userId, null, input, requestId), 201);
  }
  const threadMatch = route.match(/^\/threads\/([^/]+)$/);
  if (threadMatch && ["GET", "PATCH"].includes(method)) {
    const threadId = validateRequestData(idSchema, threadMatch[1]);
    if (method === "GET") return success(await getThread(threadId, session.userId, admin));
    if (admin) {
      const input = validateRequestData(updateRuangThreadSchema, body());
      return success(await updateThread(threadId, session.userId, input, requestId));
    }
  }
  const replyMatch = route.match(/^\/threads\/([^/]+)\/replies$/);
  if (replyMatch && method === "POST") {
    const threadId = validateRequestData(idSchema, replyMatch[1]);
    const input = validateRequestData(ruangReplySchema, body());
    return success(await addReply(threadId, session.userId, admin, input, requestId), 201);
  }
  const greetingMatch = route.match(/^\/greetings\/([^/]+)$/);
  if (greetingMatch && method === "PATCH" && admin) {
    const greetingId = validateRequestData(idSchema, greetingMatch[1]);
    const input = validateRequestData(ruangGreetingSchema, body());
    return success(await saveGreeting(session.userId, greetingId, input, requestId));
  }
  return buildErrorResponse("NOT_FOUND", "Halaman Ruang Asatidz tidak ditemukan.", requestId, 404);
}