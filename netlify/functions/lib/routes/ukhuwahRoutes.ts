import type { HandlerEvent } from "@netlify/functions";
import type { UserContext } from "../middleware/rbac";
import { buildErrorResponse, buildSuccessResponse } from "../utils/response";
import { validateRequestData } from "../utils/validator";
import { checkRateLimit } from "../utils/rateLimiter";
import { ValidationError } from "../utils/errors";
import { idSchema } from "../validations/ukhuwahValidation";
import { authorizeUkhuwah, listUkhuwahLocations, getUkhuwahLocation, saveUkhuwahLocation, listUkhuwahInstitutions,
  listUkhuwahReports, getUkhuwahReport, saveUkhuwahReport, submitUkhuwahReport, moderateUkhuwahReport, followupUkhuwahReport } from "../services/ukhuwahService";

export async function handleUkhuwahRoute(event: HandlerEvent, path: string, method: string, session: UserContext | null, requestId: string) {
  const admin = path === "/admin/ukhuwah" || path.startsWith("/admin/ukhuwah/");
  if (!admin && path !== "/ukhuwah" && !path.startsWith("/ukhuwah/")) return null;
  const actor = authorizeUkhuwah(session, admin);
  const route = path.slice((admin ? "/admin/ukhuwah" : "/ukhuwah").length);
  const body = () => { try { return event.body ? JSON.parse(event.body) : {}; } catch { throw new ValidationError("JSON tidak valid."); } };
  const query = () => event.queryStringParameters || {};
  const success = (data: unknown, status = 200) => {
    const result = buildSuccessResponse(data, requestId, null, status);
    return { ...result, headers: { ...result.headers, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } };
  };
  if (["POST", "PATCH"].includes(method) && !checkRateLimit(`ukhuwah_${actor.userId}`, 40, 600000).allowed) return buildErrorResponse("TOO_MANY_REQUESTS", "Terlalu banyak perubahan. Coba lagi nanti.", requestId, 429);
  if (route === "/institutions" && admin && method === "GET") return success(await listUkhuwahInstitutions(actor, query()));
  if (route === "/locations" && method === "GET") return success(await listUkhuwahLocations(actor, admin, query()));
  if (route === "/locations" && admin && method === "POST") return success(await saveUkhuwahLocation(actor, null, body(), requestId), 201);
  const location = route.match(/^\/locations\/([^/]+)$/);
  if (location) {
    const id = validateRequestData(idSchema, location[1]);
    if (method === "GET") return success(await getUkhuwahLocation(actor, admin, id));
    if (method === "PATCH" && admin) return success(await saveUkhuwahLocation(actor, id, body(), requestId));
  }
  if (["/reports", "/my-reports"].includes(route) && method === "GET") return success(await listUkhuwahReports(actor, admin, { ...query(), ...(route === "/my-reports" ? { mine: "true" } : {}) }));
  if (route === "/reports" && method === "POST") return success(await saveUkhuwahReport(actor, admin, null, body(), requestId), 201);
  const report = route.match(/^\/reports\/([^/]+)(?:\/(submit|moderate|followup))?$/);
  if (report) {
    const id = validateRequestData(idSchema, report[1]); const action = report[2];
    if (!action && method === "GET") return success(await getUkhuwahReport(actor, admin, id));
    if (!action && method === "PATCH") return success(await saveUkhuwahReport(actor, admin, id, body(), requestId));
    if (action === "submit" && method === "POST") return success(await submitUkhuwahReport(actor, admin, id, body(), requestId));
    if (admin && action === "moderate" && method === "POST") return success(await moderateUkhuwahReport(actor, id, body(), requestId));
    if (admin && action === "followup" && method === "PATCH") return success(await followupUkhuwahReport(actor, id, body(), requestId));
  }
  return buildErrorResponse("NOT_FOUND", "Halaman Peta Ukhuwah tidak ditemukan.", requestId, 404);
}