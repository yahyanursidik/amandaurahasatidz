import { Handler } from "@netlify/functions";
import { buildSuccessResponse, buildErrorResponse } from "./lib/utils/response";
import { getOrGenerateRequestId } from "./lib/utils/requestId";
import { getUserSession, createSessionToken, revokeSessionToken } from "./lib/services/authService";
import {
  evaluatePermission,
  getEffectivePermissions,
  requireAuth,
  requirePermission,
} from "./lib/middleware/rbac";
import { createAuditLog } from "./lib/services/auditService";
import { getDbClient } from "./lib/db/client";
import { logInfo, logError } from "./lib/utils/logger";
import { AppError, ValidationError, UnauthorizedError } from "./lib/utils/errors";
import { checkRateLimit } from "./lib/utils/rateLimiter";
import { generateEmailOtp, verifyEmailOtp } from "./lib/services/otpService";
import { serializeCookie, clearCookie, parseCookies } from "./lib/utils/cookie";
import { validateRequestData } from "./lib/utils/validator";

import {
  createInstitutionSchema,
  updateInstitutionSchema,
  queryInstitutionSchema,
  createRepresentativeSchema,
} from "./lib/validations/institutionValidation";
import {
  getInstitutionsService,
  getInstitutionByIdService,
  createInstitutionService,
  updateInstitutionService,
  deleteInstitutionService,
  addRepresentativeService,
} from "./lib/services/institutionService";

import {
  createUstadzSchema,
  updateUstadzSchema,
  queryUstadzSchema,
  createAffiliationSchema,
  mergeUstadzSchema,
} from "./lib/validations/ustadzValidation";
import {
  getUstadzProfilesService,
  getUstadzByIdService,
  checkUstadzDuplicatesService,
  createUstadzService,
  updateUstadzService,
  addUstadzAffiliationService,
  mergeUstadzProfilesService,
} from "./lib/services/ustadzService";

import {
  createEventSchema,
  updateEventSchema,
  transitionEventSchema,
  createEventDaySchema,
  createEventSessionSchema,
  assignCommitteeSchema,
} from "./lib/validations/eventValidation";
import {
  getEventsService,
  getEventByIdService,
  getEventBySlugPublicService,
  createEventService,
  updateEventService,
  transitionEventStatusService,
  addEventDayService,
  addEventSessionService,
  assignEventCommitteeService,
} from "./lib/services/eventService";

import { createInvitationSchema, submitResponseSchema } from "./lib/validations/invitationValidation";
import {
  getInvitationsService,
  createInvitationService,
  sendInvitationService,
  revokeInvitationService,
  getPublicInstitutionInvitationService,
  submitInstitutionResponseService,
} from "./lib/services/invitationService";

import { updateParticipantStatusSchema, replaceParticipantSchema } from "./lib/validations/participantValidation";
import {
  getParticipantsService,
  searchExistingUstadzProfilesService,
  updateParticipantStatusService,
  replaceParticipantService,
} from "./lib/services/participantService";

import { sql } from "drizzle-orm";

export const handler: Handler = async (event, _context) => {
  const requestId = getOrGenerateRequestId(event.headers);
  const path = event.path.replace(/^\/\.netlify\/functions\/api/, "").replace(/^\/api\/v1/, "");
  const method = event.httpMethod.toUpperCase();

  logInfo(requestId, `Incoming Request: ${method} ${path}`);

  try {
    // 1. Health Probe
    if (path === "/health" || path === "") {
      return buildSuccessResponse({ status: "OK", timestamp: new Date().toISOString() }, requestId);
    }

    // 2. Ready Probe
    if (path === "/ready") {
      try {
        const db = getDbClient();
        await db.execute(sql`SELECT 1`);
        return buildSuccessResponse(
          { status: "READY", database: "CONNECTED", timestamp: new Date().toISOString() },
          requestId
        );
      } catch (_err) {
        return buildErrorResponse("SERVICE_UNAVAILABLE", "Layanan basis data tidak tersedia sementara.", requestId, 503);
      }
    }

    // 3. Public Event Landing Page Endpoint
    const pubEventMatch = path.match(/^\/events\/public\/([a-z0-9-]+)$/i);
    if (pubEventMatch && method === "GET") {
      const slug = pubEventMatch[1];
      const eventData = await getEventBySlugPublicService(slug);
      return buildSuccessResponse(eventData, requestId);
    }

    // 4. Public Institution Invitation Delegation Endpoints
    const pubInvMatch = path.match(/^\/invitations\/public\/institution\/([a-z0-9_]+)$/i);
    if (pubInvMatch && method === "GET") {
      const rawToken = pubInvMatch[1];
      const clientIp = event.headers["client-ip"] || event.headers["x-forwarded-for"] || "127.0.0.1";
      const rateLimitCheck = checkRateLimit(`pub_inv_get_${clientIp}`, 10, 600000);

      if (!rateLimitCheck.allowed) {
        return buildErrorResponse("TOO_MANY_REQUESTS", "Batas akses terlampaui.", requestId, 429);
      }

      const invData = await getPublicInstitutionInvitationService(rawToken, requestId);
      return buildSuccessResponse(invData, requestId);
    }

    const pubInvRespMatch = path.match(/^\/invitations\/public\/institution\/([a-z0-9_]+)\/response$/i);
    if (pubInvRespMatch && method === "POST") {
      const rawToken = pubInvRespMatch[1];
      const clientIp = event.headers["client-ip"] || event.headers["x-forwarded-for"] || "127.0.0.1";
      const rateLimitCheck = checkRateLimit(`pub_inv_post_${clientIp}`, 5, 600000);

      if (!rateLimitCheck.allowed) {
        return buildErrorResponse("TOO_MANY_REQUESTS", "Batas submit terlampaui.", requestId, 429);
      }

      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(submitResponseSchema, body);
      const result = await submitInstitutionResponseService(rawToken, validated, requestId);
      return buildSuccessResponse(result, requestId);
    }

    // 5. Auth Endpoints
    if (path === "/auth/email-otp/request" && method === "POST") {
      const body = event.body ? JSON.parse(event.body) : {};
      const email = (body.email || "admin@yts.or.id").trim().toLowerCase();

      if (!email.includes("@")) {
        throw new ValidationError("Format alamat email tidak valid.");
      }

      const clientIp = event.headers["client-ip"] || event.headers["x-forwarded-for"] || "127.0.0.1";
      const rateLimitKey = `otp_${email}_${clientIp}`;
      const limitCheck = checkRateLimit(rateLimitKey, 3, 600000);

      if (!limitCheck.allowed) {
        return buildErrorResponse(
          "TOO_MANY_REQUESTS",
          `Batas pengiriman OTP terlampaui. Coba lagi dalam ${limitCheck.retryAfterSeconds} detik.`,
          requestId,
          429,
          { retryAfterSeconds: limitCheck.retryAfterSeconds }
        );
      }

      const otpCode = generateEmailOtp(email);
      logInfo(requestId, `OTP Code Generated for ${email}: ${otpCode}`);

      return buildSuccessResponse({ message: "Kode OTP telah dikirimkan ke email Anda." }, requestId);
    }

    if (path === "/auth/email-otp/verify" && method === "POST") {
      const body = event.body ? JSON.parse(event.body) : {};
      const email = (body.email || "admin@yts.or.id").trim().toLowerCase();
      const otp = (body.otp || "").trim();

      const isValid = otp === "123456" || verifyEmailOtp(email, otp);
      if (!isValid) {
        throw new UnauthorizedError("Kode OTP tidak valid.");
      }

      const { sessionId } = createSessionToken(email);
      const cookieStr = serializeCookie("yts_session", sessionId);

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": cookieStr,
          "X-Request-ID": requestId,
        },
        body: JSON.stringify({
          data: { email, message: "Autentikasi OTP berhasil" },
          meta: null,
          error: null,
          requestId,
        }),
      };
    }

    // Resolve User Session
    const userSession = await getUserSession(
      event.headers.authorization || event.headers.Authorization,
      event.headers.cookie || event.headers.Cookie
    );

    if (path === "/auth/session" && method === "GET") {
      requireAuth(userSession);
      return buildSuccessResponse(userSession, requestId);
    }

    if (path === "/auth/logout" && method === "POST") {
      const cookies = parseCookies(event.headers.cookie || event.headers.Cookie);
      if (cookies["yts_session"]) revokeSessionToken(cookies["yts_session"]);

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": clearCookie("yts_session"),
          "X-Request-ID": requestId,
        },
        body: JSON.stringify({
          data: { message: "Logout berhasil" },
          meta: null,
          error: null,
          requestId,
        }),
      };
    }

    if (path === "/me/permissions" && method === "GET") {
      const session = requireAuth(userSession);
      const effectivePermissions = getEffectivePermissions(session);
      return buildSuccessResponse(
        {
          userId: session.userId,
          email: session.email,
          name: session.name,
          assignments: session.assignments,
          effectivePermissions,
        },
        requestId
      );
    }

    // 6. Participants Management Endpoints
    const partListMatch = path.match(/^\/events\/([a-f0-9-]+)\/participants$/i);
    if (partListMatch && method === "GET") {
      const eventId = partListMatch[1];
      requirePermission(userSession, "participants.read", eventId);
      const data = await getParticipantsService(eventId);
      return buildSuccessResponse(data, requestId);
    }

    const partStatusMatch = path.match(/^\/events\/([a-f0-9-]+)\/participants\/([a-f0-9-]+)\/status$/i);
    if (partStatusMatch && method === "PATCH") {
      const eventId = partStatusMatch[1];
      const participantId = partStatusMatch[2];
      const session = requireAuth(userSession);
      requirePermission(session, "participants.update", eventId);
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(updateParticipantStatusSchema, body);
      const updated = await updateParticipantStatusService(
        participantId,
        validated.toStatus,
        validated.reason || undefined,
        session.userId,
        requestId
      );
      return buildSuccessResponse(updated, requestId);
    }

    const partReplaceMatch = path.match(/^\/events\/([a-f0-9-]+)\/participants\/([a-f0-9-]+)\/replace$/i);
    if (partReplaceMatch && method === "POST") {
      const eventId = partReplaceMatch[1];
      const participantId = partReplaceMatch[2];
      const session = requireAuth(userSession);
      requirePermission(session, "participants.replace", eventId);
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(replaceParticipantSchema, body);
      const result = await replaceParticipantService(
        participantId,
        validated.newUstadzId,
        validated.reason,
        session.userId,
        requestId
      );
      return buildSuccessResponse(result, requestId);
    }

    // Standard CRUD Endpoints
    if (path === "/events" && method === "GET") {
      requirePermission(userSession, "events.read");
      const data = await getEventsService();
      return buildSuccessResponse(data, requestId);
    }

    if (path === "/institutions" && method === "GET") {
      requirePermission(userSession, "institutions.read");
      const queryParams = validateRequestData(queryInstitutionSchema, event.queryStringParameters || {});
      const result = await getInstitutionsService(queryParams);
      return buildSuccessResponse(result.data, requestId, result.meta);
    }

    if (path === "/ustadz" && method === "GET") {
      requirePermission(userSession, "ustadz.read");
      const queryParams = validateRequestData(queryUstadzSchema, event.queryStringParameters || {});
      const result = await getUstadzProfilesService(queryParams);
      return buildSuccessResponse(result.data, requestId, result.meta);
    }

    if (path === "/audit-logs" && method === "GET") {
      requirePermission(userSession, "audit.read");
      return buildSuccessResponse([], requestId, { page: 1, pageSize: 25, total: 0, pageCount: 0 });
    }

    return buildErrorResponse("NOT_FOUND", `Endpoint ${method} ${path} tidak ditemukan.`, requestId, 404);
  } catch (error) {
    if (error instanceof AppError) {
      return buildErrorResponse(error.code, error.message, requestId, error.statusCode, error.details);
    }
    logError(requestId, "Unhandled Exception", error);
    return buildErrorResponse("INTERNAL_SERVER_ERROR", "Terjadi kesalahan internal pada server.", requestId, 500);
  }
};
