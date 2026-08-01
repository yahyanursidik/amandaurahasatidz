import { Handler } from "@netlify/functions";
import { buildSuccessResponse, buildErrorResponse } from "./lib/utils/response";
import { getOrGenerateRequestId } from "./lib/utils/requestId";
import {
  getUserSession,
  createSessionToken,
  revokeSessionToken,
  authenticatePasswordService,
} from "./lib/services/authService";
import {
  evaluatePermission,
  getEffectivePermissions,
  requireAuth,
  requirePermission,
} from "./lib/middleware/rbac";
import { createAuditLog, getAuditLogsService } from "./lib/services/auditService";
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
  updateRepresentativeSchema,
} from "./lib/validations/institutionValidation";
import {
  getInstitutionsService,
  getInstitutionByIdService,
  createInstitutionService,
  updateInstitutionService,
  deleteInstitutionService,
  addRepresentativeService,
  updateRepresentativeService,
  deleteRepresentativeService,
} from "./lib/services/institutionService";

import {
  createUstadzSchema,
  updateUstadzSchema,
  updateUstadzSelfProfileSchema,
  queryUstadzSchema,
  createAffiliationSchema,
  updateAffiliationSchema,
  duplicateUstadzSchema,
  mergeUstadzSchema,
} from "./lib/validations/ustadzValidation";
import {
  getUstadzProfilesService,
  getUstadzByIdService,
  checkUstadzDuplicatesService,
  createUstadzService,
  updateUstadzService,
  updateUstadzSelfProfileService,
  addUstadzAffiliationService,
  updateUstadzAffiliationService,
  mergeUstadzProfilesService,
} from "./lib/services/ustadzService";

import {
  createEventSchema,
  updateEventSchema,
  transitionEventSchema,
  createEventDaySchema,
  createEventSessionSchema,
  assignCommitteeSchema,
  updateCommitteeAssignmentSchema,
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
} from "./lib/services/eventService";
import {
  createCommitteeMemberSchema,
  queryCommitteeSchema,
  updateCommitteeMemberSchema,
} from "./lib/validations/committeeValidation";
import {
  assignCommitteeService,
  createCommitteeMemberService,
  endCommitteeAssignmentService,
  getCommitteeContextService,
  getCommitteeDirectoryService,
  getCommitteeMemberService,
  updateCommitteeAssignmentService,
  updateCommitteeMemberService,
} from "./lib/services/committeeService";

import {
  createInvitationSchema,
  requestInvitationOtpSchema,
  submitResponseSchema,
  verifyInvitationOtpSchema,
  verifyInstitutionAccessCodeSchema,
} from "./lib/validations/invitationValidation";
import {
  getInvitationsService,
  createInvitationService,
  sendInvitationService,
  revokeInvitationService,
  regenerateInvitationLinkService,
  getPublicInstitutionInvitationService,
  getPublicIndividualInvitationService,
  submitInstitutionResponseService,
  submitIndividualResponseService,
  requestInstitutionInvitationOtpService,
  verifyInstitutionInvitationOtpService,
  verifyInstitutionInvitationAccessCodeService,
  getInstitutionInvitationAccessCodeService,
} from "./lib/services/invitationService";

import {
  updateParticipantStatusSchema,
  replaceParticipantSchema,
  approveParticipantSchema,
  waitlistParticipantSchema,
  declineParticipantSchema,
  cancelParticipantSchema,
  bulkApproveSchema,
  replacePortalDelegationMemberSchema,
  requestPasswordSetupSchema,
  completePasswordSetupSchema,
  provisionParticipantPortalAccountSchema,
} from "./lib/validations/participantValidation";
import {
  completePasswordSetupService,
  requestPasswordSetupService,
} from "./lib/services/accountPasswordService";
import {
  getParticipantsService,
  searchExistingUstadzProfilesService,
  updateParticipantStatusService,
  replaceParticipantService,
  approveParticipantService,
  waitlistParticipantService,
  declineParticipantService,
  cancelParticipantService,
  bulkApproveParticipantsService,
  provisionParticipantPortalAccountService,
} from "./lib/services/participantService";

import { enqueueEmailSchema, retryEmailJobSchema } from "./lib/validations/emailValidation";
import { emailWebhookPayloadSchema } from "./lib/validations/webhookValidation";
import {
  getEmailJobsDashboardService,
  processEmailQueueWorker,
  retryEmailJobService,
  enqueueEmailJob,
} from "./lib/services/emailQueueService";
import { processWebhookIdempotentService } from "./lib/services/webhookService";
import { processScheduledReminderService } from "./lib/services/reminderService";

import { createAnnouncementSchema, publishAnnouncementSchema } from "./lib/validations/announcementValidation";
import {
  createAnnouncementService,
  getEventAnnouncementsService,
  publishAnnouncementService,
  unpublishAnnouncementService,
  getPortalAnnouncementsService,
  markAnnouncementAsReadService,
} from "./lib/services/announcementService";

import { verifyQrTokenSchema } from "./lib/validations/qrValidation";
import {
  verifyQrTokenForCheckinService,
  rotateParticipantQrTokenService,
} from "./lib/services/participantQrService";
import {
  getPortalOverviewService,
  getPortalParticipantIdsService,
  getPortalParticipantQrService,
  getPortalDelegationService,
  replacePortalDelegationMemberService,
  resolvePortalUstadzIdService,
} from "./lib/services/portalService";

import { processCheckinSchema, queryCheckinLogsSchema } from "./lib/validations/attendanceValidation";
import {
  getActiveSessionService,
  processOnSiteCheckinService,
  getRecentCheckinLogsService,
} from "./lib/services/attendanceService";

import {
  getOrGenerateLocationQrTokenService,
  rotateLocationQrTokenService,
} from "./lib/services/dynamicQrService";
import { processSelfCheckinService } from "./lib/services/selfCheckinService";

import {
  manualMarkAttendanceSchema,
  correctAttendanceSchema,
} from "./lib/validations/attendanceValidation";
import {
  manualMarkAttendanceService,
  correctAttendanceRecordService,
  getAttendanceSummaryRecapService,
  getParticipantAttendanceReportService,
} from "./lib/services/attendanceReportService";

import {
  getAdminDashboardMetricsService,
  getCommitteeDashboardMetricsService,
} from "./lib/services/dashboardService";
import { getPaginatedReportService } from "./lib/services/reportService";
import { generateReportExportService } from "./lib/services/exportService";

import {
  processSpreadsheetImportDryRunService,
  commitSpreadsheetImportService,
} from "./lib/services/importService";

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

    // 4. Public Institution & Individual Invitation Delegation Endpoints
    const pubIndivMatch = path.match(/^\/invitations\/public\/individual\/([a-z0-9_]+)$/i);
    if (pubIndivMatch && method === "GET") {
      const rawToken = pubIndivMatch[1];
      const invData = await getPublicIndividualInvitationService(rawToken, requestId);
      return buildSuccessResponse(invData, requestId);
    }

    const pubIndivRespMatch = path.match(/^\/invitations\/public\/individual\/([a-z0-9_]+)\/response$/i);
    if (pubIndivRespMatch && method === "POST") {
      const rawToken = pubIndivRespMatch[1];
      const body = event.body ? JSON.parse(event.body) : {};
      const result = await submitIndividualResponseService(rawToken, body.responseStatus || "ACCEPTED", requestId);
      return buildSuccessResponse(result, requestId);
    }

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

    const pubInvOtpRequestMatch = path.match(
      /^\/invitations\/public\/institution\/([a-z0-9_]+)\/otp\/request$/i,
    );

    const pubInvCodeVerifyMatch = path.match(
      /^\/invitations\/public\/institution\/([a-z0-9_]+)\/code\/verify$/i,
    );
    if (pubInvCodeVerifyMatch && method === "POST") {
      const rawToken = pubInvCodeVerifyMatch[1];
      const clientIp = event.headers["client-ip"] || event.headers["x-forwarded-for"] || "127.0.0.1";
      const limitCheck = checkRateLimit(`pub_inv_code_${rawToken.slice(-12)}_${clientIp}`, 8, 600000);
      if (!limitCheck.allowed) {
        return buildErrorResponse(
          "TOO_MANY_REQUESTS",
          `Terlalu banyak percobaan kode. Coba lagi dalam ${limitCheck.retryAfterSeconds} detik.`,
          requestId,
          429,
          { retryAfterSeconds: limitCheck.retryAfterSeconds },
        );
      }
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(verifyInstitutionAccessCodeSchema, body);
      const result = await verifyInstitutionInvitationAccessCodeService(rawToken, validated.code, requestId);
      return buildSuccessResponse(result, requestId);
    }
    if (pubInvOtpRequestMatch && method === "POST") {
      const rawToken = pubInvOtpRequestMatch[1];
      const clientIp = event.headers["client-ip"] || event.headers["x-forwarded-for"] || "127.0.0.1";
      const limitCheck = checkRateLimit(`pub_inv_otp_${rawToken.slice(-12)}_${clientIp}`, 3, 600000);
      if (!limitCheck.allowed) {
        return buildErrorResponse(
          "TOO_MANY_REQUESTS",
          `Terlalu banyak permintaan kode. Coba lagi dalam ${limitCheck.retryAfterSeconds} detik.`,
          requestId,
          429,
          { retryAfterSeconds: limitCheck.retryAfterSeconds },
        );
      }
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(requestInvitationOtpSchema, body);
      const result = await requestInstitutionInvitationOtpService(rawToken, validated.email, requestId);
      return buildSuccessResponse(result, requestId);
    }

    const pubInvOtpVerifyMatch = path.match(
      /^\/invitations\/public\/institution\/([a-z0-9_]+)\/otp\/verify$/i,
    );
    if (pubInvOtpVerifyMatch && method === "POST") {
      const rawToken = pubInvOtpVerifyMatch[1];
      const clientIp = event.headers["client-ip"] || event.headers["x-forwarded-for"] || "127.0.0.1";
      const limitCheck = checkRateLimit(`pub_inv_otp_verify_${rawToken.slice(-12)}_${clientIp}`, 6, 600000);
      if (!limitCheck.allowed) {
        return buildErrorResponse(
          "TOO_MANY_REQUESTS",
          `Terlalu banyak percobaan kode. Coba lagi dalam ${limitCheck.retryAfterSeconds} detik.`,
          requestId,
          429,
          { retryAfterSeconds: limitCheck.retryAfterSeconds },
        );
      }
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(verifyInvitationOtpSchema, body);
      const result = await verifyInstitutionInvitationOtpService(rawToken, validated, requestId);
      return buildSuccessResponse(result, requestId);
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
    if (path === "/auth/password/setup/request" && method === "POST") {
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(requestPasswordSetupSchema, body);
      const clientIp = event.headers["client-ip"] || event.headers["x-forwarded-for"] || "127.0.0.1";
      const limit = checkRateLimit(`password_setup_${validated.email}_${clientIp}`, 3, 600000);
      if (!limit.allowed) {
        return buildErrorResponse(
          "TOO_MANY_REQUESTS",
          `Terlalu banyak permintaan aktivasi. Coba kembali dalam ${limit.retryAfterSeconds} detik.`,
          requestId,
          429,
        );
      }
      const result = await requestPasswordSetupService(
        validated.email,
        validated.portal,
        requestId,
      );
      return buildSuccessResponse(result, requestId);
    }

    if (path === "/auth/password/setup/complete" && method === "POST") {
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(completePasswordSetupSchema, body);
      const clientIp = event.headers["client-ip"] || event.headers["x-forwarded-for"] || "127.0.0.1";
      const limit = checkRateLimit(`password_setup_complete_${validated.email}_${clientIp}`, 6, 600000);
      if (!limit.allowed) {
        return buildErrorResponse(
          "TOO_MANY_REQUESTS",
          `Terlalu banyak percobaan kode. Coba kembali dalam ${limit.retryAfterSeconds} detik.`,
          requestId,
          429,
        );
      }
      const result = await completePasswordSetupService(validated, requestId);
      return buildSuccessResponse(result, requestId);
    }

    if (path === "/auth/password/login" && method === "POST") {
      const body = event.body ? JSON.parse(event.body) : {};
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const portal = String(body.portal || "admin") as "admin" | "committee" | "ustadz";
      if (!["admin", "committee", "ustadz"].includes(portal)) {
        throw new ValidationError("Portal login tidak valid.");
      }

      const authenticatedUser = await authenticatePasswordService(email, password, portal);
      const { sessionId } = createSessionToken(authenticatedUser.email, authenticatedUser);
      const cookieStr = serializeCookie("yts_session", sessionId);

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": cookieStr,
          "X-Request-ID": requestId,
        },
        body: JSON.stringify({
          data: {
            userId: authenticatedUser.userId,
            email: authenticatedUser.email,
            name: authenticatedUser.name,
            portal,
          },
          meta: null,
          error: null,
          requestId,
        }),
      };
    }

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
      await enqueueEmailJob({
        templateCode: "OTP_CODE",
        recipientEmail: email,
        variables: { otpCode, expiresMinutes: 5 },
        idempotencyKey: `auth_otp_${email}_${Date.now()}`,
      });
      logInfo(requestId, `OTP login queued for ${email}.`);

      return buildSuccessResponse({ message: "Kode OTP telah dikirimkan ke email Anda." }, requestId);
    }

    if (path === "/auth/email-otp/verify" && method === "POST") {
      const body = event.body ? JSON.parse(event.body) : {};
      const email = (body.email || "admin@yts.or.id").trim().toLowerCase();
      const otp = (body.otp || "").trim();

      const isValid = verifyEmailOtp(email, otp);
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

    if (path === "/portal/overview" && method === "GET") {
      const session = requireAuth(userSession);
      const overview = await getPortalOverviewService(session.userId, session.email);
      return buildSuccessResponse(overview, requestId);
    }

    if (path === "/portal/profile" && method === "PATCH") {
      const session = requireAuth(userSession);
      const ustadzId =
        session.ustadzId ||
        (await resolvePortalUstadzIdService(session.userId, session.email));
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(updateUstadzSelfProfileSchema, body);
      const updated = await updateUstadzSelfProfileService(ustadzId, validated, session.userId, requestId);
      return buildSuccessResponse(updated, requestId);
    }

    const portalDelegationMatch = path.match(
      /^\/portal\/delegations\/([a-f0-9-]+)$/i,
    );
    if (portalDelegationMatch && method === "GET") {
      const session = requireAuth(userSession);
      const delegation = await getPortalDelegationService(
        session.userId,
        session.email,
        portalDelegationMatch[1],
      );
      return buildSuccessResponse(delegation, requestId);
    }

    const portalDelegationReplaceMatch = path.match(
      /^\/portal\/delegations\/([a-f0-9-]+)\/replace$/i,
    );
    if (portalDelegationReplaceMatch && method === "POST") {
      const session = requireAuth(userSession);
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(replacePortalDelegationMemberSchema, body);
      const replaced = await replacePortalDelegationMemberService(
        session.userId,
        session.email,
        portalDelegationReplaceMatch[1],
        validated,
        requestId,
      );
      return buildSuccessResponse(replaced, requestId, null, 201);
    }

    // Event workspace CRUD and command endpoints
    if (path === "/events" && method === "POST") {
      const session = requireAuth(userSession);
      requirePermission(session, "events.create");
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(createEventSchema, body);
      const created = await createEventService(validated, session.userId, requestId);
      return buildSuccessResponse(created, requestId, null, 201);
    }

    const eventDetailMatch = path.match(/^\/events\/([a-f0-9-]+)$/i);
    if (eventDetailMatch && method === "GET") {
      const eventId = eventDetailMatch[1];
      requirePermission(userSession, "events.read", eventId);
      return buildSuccessResponse(await getEventByIdService(eventId), requestId);
    }

    if (eventDetailMatch && method === "PATCH") {
      const eventId = eventDetailMatch[1];
      const session = requireAuth(userSession);
      requirePermission(session, "events.update", eventId);
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(updateEventSchema, body);
      return buildSuccessResponse(
        await updateEventService(eventId, validated, session.userId, requestId),
        requestId
      );
    }

    const eventTransitionMatch = path.match(/^\/events\/([a-f0-9-]+)\/transition$/i);
    if (eventTransitionMatch && method === "POST") {
      const eventId = eventTransitionMatch[1];
      const session = requireAuth(userSession);
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(transitionEventSchema, body);
      const permission =
        validated.action === "CANCEL"
          ? "events.cancel"
          : validated.action === "ARCHIVE"
            ? "events.archive"
            : "events.publish";
      requirePermission(session, permission, eventId);
      return buildSuccessResponse(
        await transitionEventStatusService(eventId, validated.action, session.userId, requestId),
        requestId
      );
    }

    const eventDaysMatch = path.match(/^\/events\/([a-f0-9-]+)\/days$/i);
    if (eventDaysMatch && method === "POST") {
      const eventId = eventDaysMatch[1];
      const session = requireAuth(userSession);
      requirePermission(session, "schedule.manage", eventId);
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(createEventDaySchema, body);
      return buildSuccessResponse(
        await addEventDayService(eventId, validated, session.userId, requestId),
        requestId,
        null,
        201
      );
    }

    const eventSessionsMatch = path.match(/^\/events\/([a-f0-9-]+)\/sessions$/i);
    if (eventSessionsMatch && method === "POST") {
      const eventId = eventSessionsMatch[1];
      const session = requireAuth(userSession);
      requirePermission(session, "schedule.manage", eventId);
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(createEventSessionSchema, body);
      return buildSuccessResponse(
        await addEventSessionService(eventId, validated, session.userId, requestId),
        requestId,
        null,
        201
      );
    }

    if (path === "/committee-members" && method === "GET") {
      requirePermission(userSession, "users.read");
      const validated = validateRequestData(queryCommitteeSchema, event.queryStringParameters || {});
      return buildSuccessResponse(await getCommitteeDirectoryService(validated), requestId);
    }

    if (path === "/committee-members" && method === "POST") {
      const session = requireAuth(userSession);
      requirePermission(session, "users.manage");
      const validated = validateRequestData(createCommitteeMemberSchema, event.body ? JSON.parse(event.body) : {});
      return buildSuccessResponse(await createCommitteeMemberService(validated, session.userId, requestId), requestId, null, 201);
    }

    const committeeMemberMatch = path.match(/^\/committee-members\/([a-f0-9-]+)$/i);
    if (committeeMemberMatch && method === "GET") {
      requirePermission(userSession, "users.read");
      return buildSuccessResponse(await getCommitteeMemberService(committeeMemberMatch[1]), requestId);
    }
    if (committeeMemberMatch && method === "PATCH") {
      const session = requireAuth(userSession);
      requirePermission(session, "users.manage");
      const validated = validateRequestData(updateCommitteeMemberSchema, event.body ? JSON.parse(event.body) : {});
      return buildSuccessResponse(await updateCommitteeMemberService(committeeMemberMatch[1], validated, session.userId, requestId), requestId);
    }

    if (path === "/committee/context" && method === "GET") {
      const session = requireAuth(userSession);
      return buildSuccessResponse(await getCommitteeContextService(session.userId), requestId);
    }

    const eventCommitteeMatch = path.match(/^\/events\/([a-f0-9-]+)\/committee$/i);
    if (eventCommitteeMatch && method === "GET") {
      const eventId = eventCommitteeMatch[1];
      requirePermission(userSession, "events.read", eventId);
      const eventData = await getEventByIdService(eventId);
      return buildSuccessResponse(eventData.committee, requestId);
    }
    if (eventCommitteeMatch && method === "POST") {
      const eventId = eventCommitteeMatch[1];
      const session = requireAuth(userSession);
      requirePermission(session, "events.update", eventId);
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(assignCommitteeSchema, body);
      return buildSuccessResponse(
        await assignCommitteeService(eventId, validated, session.userId, requestId),
        requestId,
        null,
        201
      );
    }

    const eventCommitteeAssignmentMatch = path.match(/^\/events\/([a-f0-9-]+)\/committee\/([a-f0-9-]+)$/i);
    if (eventCommitteeAssignmentMatch && method === "PATCH") {
      const eventId = eventCommitteeAssignmentMatch[1];
      const session = requireAuth(userSession);
      requirePermission(session, "events.update", eventId);
      const validated = validateRequestData(updateCommitteeAssignmentSchema, event.body ? JSON.parse(event.body) : {});
      return buildSuccessResponse(await updateCommitteeAssignmentService(eventCommitteeAssignmentMatch[2], eventId, validated, session.userId, requestId), requestId);
    }
    if (eventCommitteeAssignmentMatch && method === "DELETE") {
      const eventId = eventCommitteeAssignmentMatch[1];
      const session = requireAuth(userSession);
      requirePermission(session, "events.update", eventId);
      return buildSuccessResponse(await endCommitteeAssignmentService(eventCommitteeAssignmentMatch[2], eventId, session.userId, requestId), requestId);
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

    const partApproveMatch = path.match(/^\/events\/([a-f0-9-]+)\/participants\/([a-f0-9-]+)\/approve$/i);
    if (partApproveMatch && method === "POST") {
      const eventId = partApproveMatch[1];
      const participantId = partApproveMatch[2];
      const session = requireAuth(userSession);
      requirePermission(session, "participants.approve", eventId);
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(approveParticipantSchema, body);
      const result = await approveParticipantService(participantId, session.userId, requestId, validated.notes || undefined);
      return buildSuccessResponse(result, requestId);
    }

    const partWaitlistMatch = path.match(/^\/events\/([a-f0-9-]+)\/participants\/([a-f0-9-]+)\/waitlist$/i);
    if (partWaitlistMatch && method === "POST") {
      const eventId = partWaitlistMatch[1];
      const participantId = partWaitlistMatch[2];
      const session = requireAuth(userSession);
      requirePermission(session, "participants.waitlist", eventId);
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(waitlistParticipantSchema, body);
      const result = await waitlistParticipantService(participantId, validated.reason, session.userId, requestId);
      return buildSuccessResponse(result, requestId);
    }

    const partDeclineMatch = path.match(/^\/events\/([a-f0-9-]+)\/participants\/([a-f0-9-]+)\/decline$/i);
    if (partDeclineMatch && method === "POST") {
      const eventId = partDeclineMatch[1];
      const participantId = partDeclineMatch[2];
      const session = requireAuth(userSession);
      requirePermission(session, "participants.approve", eventId);
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(declineParticipantSchema, body);
      const result = await declineParticipantService(participantId, validated.reason, session.userId, requestId);
      return buildSuccessResponse(result, requestId);
    }

    const partCancelMatch = path.match(/^\/events\/([a-f0-9-]+)\/participants\/([a-f0-9-]+)\/cancel$/i);
    if (partCancelMatch && method === "POST") {
      const eventId = partCancelMatch[1];
      const participantId = partCancelMatch[2];
      const session = requireAuth(userSession);
      requirePermission(session, "participants.cancel", eventId);
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(cancelParticipantSchema, body);
      const result = await cancelParticipantService(participantId, validated.reason, session.userId, requestId);
      return buildSuccessResponse(result, requestId);
    }

    const partBulkApproveMatch = path.match(/^\/events\/([a-f0-9-]+)\/participants\/bulk-approve$/i);
    if (partBulkApproveMatch && method === "POST") {
      const eventId = partBulkApproveMatch[1];
      const session = requireAuth(userSession);
      requirePermission(session, "participants.approve", eventId);
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(bulkApproveSchema, body);
      const result = await bulkApproveParticipantsService(validated.participantIds, session.userId, requestId);
      return buildSuccessResponse(result, requestId);
    }

    const invitationListMatch = path.match(/^\/events\/([a-f0-9-]+)\/invitations$/i);
    if (invitationListMatch && method === "GET") {
      const eventId = invitationListMatch[1];
      requirePermission(userSession, "invitations.read", eventId);
      return buildSuccessResponse(await getInvitationsService(eventId), requestId);
    }

    if (invitationListMatch && method === "POST") {
      const eventId = invitationListMatch[1];
      const session = requireAuth(userSession);
      requirePermission(session, "invitations.create", eventId);
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(createInvitationSchema, { ...body, eventId });
      return buildSuccessResponse(
        await createInvitationService(validated, session.userId, requestId),
        requestId,
        null,
        201
      );
    }

    const invitationSendMatch = path.match(/^\/events\/([a-f0-9-]+)\/invitations\/([a-f0-9-]+)\/send$/i);
    if (invitationSendMatch && method === "POST") {
      const eventId = invitationSendMatch[1];
      const invitationId = invitationSendMatch[2];
      const session = requireAuth(userSession);
      requirePermission(session, "invitations.send", eventId);
      return buildSuccessResponse(
        await sendInvitationService(invitationId, session.userId, requestId),
        requestId
      );
    }

    const invitationRevokeMatch = path.match(/^\/events\/([a-f0-9-]+)\/invitations\/([a-f0-9-]+)\/revoke$/i);
    if (invitationRevokeMatch && method === "POST") {
      const eventId = invitationRevokeMatch[1];
      const invitationId = invitationRevokeMatch[2];
      const session = requireAuth(userSession);
      requirePermission(session, "invitations.revoke", eventId);
      return buildSuccessResponse(
        await revokeInvitationService(invitationId, session.userId, requestId),
        requestId
      );
    }

    const invitationRegenerateLinkMatch = path.match(
      /^\/events\/([a-f0-9-]+)\/invitations\/([a-f0-9-]+)\/regenerate-link$/i
    );
    if (invitationRegenerateLinkMatch && method === "POST") {
      const eventId = invitationRegenerateLinkMatch[1];
      const invitationId = invitationRegenerateLinkMatch[2];
      const session = requireAuth(userSession);
      requirePermission(session, "invitations.create", eventId);
      return buildSuccessResponse(
        await regenerateInvitationLinkService(invitationId, session.userId, requestId),
        requestId
      );
    }

    const participantPortalAccountMatch = path.match(
      /^\/events\/([a-f0-9-]+)\/participants\/([a-f0-9-]+)\/portal-account$/i,
    );
    if (participantPortalAccountMatch && method === "POST") {
      const eventId = participantPortalAccountMatch[1];
      const participantId = participantPortalAccountMatch[2];
      const session = requireAuth(userSession);
      requirePermission(session, "participants.manage_portal_access", eventId);
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(provisionParticipantPortalAccountSchema, body);
      const result = await provisionParticipantPortalAccountService(
        eventId,
        participantId,
        validated.resetExisting ?? false,
        session.userId,
        requestId,
      );
      return buildSuccessResponse(result, requestId);
    }

    const invitationAccessCodeMatch = path.match(
      /^\/events\/([a-f0-9-]+)\/invitations\/([a-f0-9-]+)\/access-code$/i,
    );
    if (invitationAccessCodeMatch && method === "GET") {
      const eventId = invitationAccessCodeMatch[1];
      const invitationId = invitationAccessCodeMatch[2];
      const session = requireAuth(userSession);
      requirePermission(session, "invitations.create", eventId);
      return buildSuccessResponse(
        await getInstitutionInvitationAccessCodeService(eventId, invitationId, session.userId, requestId),
        requestId,
      );
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

    if (path === "/institutions" && method === "POST") {
      const session = requireAuth(userSession);
      requirePermission(session, "institutions.create");
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(createInstitutionSchema, body);
      return buildSuccessResponse(
        await createInstitutionService(validated, session.userId, requestId),
        requestId
      );
    }

    const institutionRepresentativeMatch = path.match(
      /^\/institutions\/([a-f0-9-]+)\/representatives\/([a-f0-9-]+)$/i
    );
    if (institutionRepresentativeMatch && method === "PATCH") {
      const session = requireAuth(userSession);
      requirePermission(session, "institutions.update");
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(updateRepresentativeSchema, body);
      return buildSuccessResponse(
        await updateRepresentativeService(
          institutionRepresentativeMatch[1],
          institutionRepresentativeMatch[2],
          validated,
          session.userId,
          requestId
        ),
        requestId
      );
    }
    if (institutionRepresentativeMatch && method === "DELETE") {
      const session = requireAuth(userSession);
      requirePermission(session, "institutions.update");
      return buildSuccessResponse(
        await deleteRepresentativeService(
          institutionRepresentativeMatch[1],
          institutionRepresentativeMatch[2],
          session.userId,
          requestId
        ),
        requestId
      );
    }

    const institutionRepresentativesMatch = path.match(/^\/institutions\/([a-f0-9-]+)\/representatives$/i);
    if (institutionRepresentativesMatch && method === "POST") {
      const session = requireAuth(userSession);
      requirePermission(session, "institutions.update");
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(createRepresentativeSchema, body);
      return buildSuccessResponse(
        await addRepresentativeService(
          institutionRepresentativesMatch[1],
          validated,
          session.userId,
          requestId
        ),
        requestId
      );
    }

    const institutionMatch = path.match(/^\/institutions\/([a-f0-9-]+)$/i);
    if (institutionMatch && method === "GET") {
      requirePermission(userSession, "institutions.read");
      return buildSuccessResponse(await getInstitutionByIdService(institutionMatch[1]), requestId);
    }
    if (institutionMatch && method === "PATCH") {
      const session = requireAuth(userSession);
      requirePermission(session, "institutions.update");
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(updateInstitutionSchema, body);
      return buildSuccessResponse(
        await updateInstitutionService(institutionMatch[1], validated, session.userId, requestId),
        requestId
      );
    }
    if (institutionMatch && method === "DELETE") {
      const session = requireAuth(userSession);
      requirePermission(session, "institutions.update");
      return buildSuccessResponse(
        await deleteInstitutionService(institutionMatch[1], session.userId, requestId),
        requestId
      );
    }

    if (path === "/ustadz" && method === "GET") {
      requirePermission(userSession, "ustadz.read");
      const queryParams = validateRequestData(queryUstadzSchema, event.queryStringParameters || {});
      const result = await getUstadzProfilesService(queryParams);
      return buildSuccessResponse(result.data, requestId, result.meta);
    }

    if (path === "/ustadz" && method === "POST") {
      const session = requireAuth(userSession);
      requirePermission(session, "ustadz.create");
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(createUstadzSchema, body);
      return buildSuccessResponse(
        await createUstadzService(validated, session.userId, requestId),
        requestId,
        null,
        201,
      );
    }

    if (path === "/ustadz/duplicates/search" && method === "POST") {
      requirePermission(userSession, "ustadz.read");
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(duplicateUstadzSchema, body);
      return buildSuccessResponse(
        await checkUstadzDuplicatesService(
          validated.fullName,
          validated.email,
          validated.phone,
          validated.excludeId,
        ),
        requestId,
      );
    }

    if (path === "/ustadz/merge" && method === "POST") {
      const session = requireAuth(userSession);
      requirePermission(session, "ustadz.merge");
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(mergeUstadzSchema, body);
      const merged = [];
      for (const sourceUstadzId of validated.sourceUstadzIds) {
        merged.push(
          await mergeUstadzProfilesService(
            sourceUstadzId,
            validated.targetUstadzId,
            session.userId,
            requestId,
            validated.notes,
          ),
        );
      }
      return buildSuccessResponse(
        {
          merged,
          message: `${merged.length} profil sumber berhasil digabungkan ke profil target.`,
          notes: validated.notes,
        },
        requestId,
      );
    }

    const ustadzAffiliationMatch = path.match(
      /^\/ustadz\/([a-f0-9-]+)\/affiliations\/([a-f0-9-]+)$/i,
    );
    if (ustadzAffiliationMatch && method === "PATCH") {
      const session = requireAuth(userSession);
      requirePermission(session, "ustadz.update");
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(updateAffiliationSchema, body);
      return buildSuccessResponse(
        await updateUstadzAffiliationService(
          ustadzAffiliationMatch[1],
          ustadzAffiliationMatch[2],
          validated,
          session.userId,
          requestId,
        ),
        requestId,
      );
    }
    if (ustadzAffiliationMatch && method === "DELETE") {
      const session = requireAuth(userSession);
      requirePermission(session, "ustadz.update");
      return buildSuccessResponse(
        await updateUstadzAffiliationService(
          ustadzAffiliationMatch[1],
          ustadzAffiliationMatch[2],
          { status: "INACTIVE", endDate: new Date().toISOString().slice(0, 10), isPrimary: false },
          session.userId,
          requestId,
        ),
        requestId,
      );
    }

    const ustadzAffiliationsMatch = path.match(/^\/ustadz\/([a-f0-9-]+)\/affiliations$/i);
    if (ustadzAffiliationsMatch && method === "POST") {
      const session = requireAuth(userSession);
      requirePermission(session, "ustadz.update");
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(createAffiliationSchema, body);
      return buildSuccessResponse(
        await addUstadzAffiliationService(
          ustadzAffiliationsMatch[1],
          validated.institutionId,
          validated.position,
          validated.isPrimary,
          session.userId,
          requestId,
        ),
        requestId,
        null,
        201,
      );
    }

    const ustadzMatch = path.match(/^\/ustadz\/([a-f0-9-]+)$/i);
    if (ustadzMatch && method === "GET") {
      requirePermission(userSession, "ustadz.read");
      return buildSuccessResponse(await getUstadzByIdService(ustadzMatch[1]), requestId);
    }
    if (ustadzMatch && method === "PATCH") {
      const session = requireAuth(userSession);
      requirePermission(session, "ustadz.update");
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(updateUstadzSchema, body);
      return buildSuccessResponse(
        await updateUstadzService(ustadzMatch[1], validated, session.userId, requestId),
        requestId,
      );
    }

    if (path === "/audit-logs" && method === "GET") {
      requirePermission(userSession, "audit.read");
      const requestedLimit = Number(event.queryStringParameters?.limit || 50);
      const limit = Number.isFinite(requestedLimit) ? requestedLimit : 50;
      const data = await getAuditLogsService(limit);
      return buildSuccessResponse(data, requestId, {
        page: 1,
        pageSize: data.length,
        total: data.length,
        pageCount: data.length > 0 ? 1 : 0,
      });
    }

    // Email Engine & Queue Endpoints
    if (path === "/email/jobs" && method === "GET") {
      requirePermission(userSession, "email.read");
      const jobs = await getEmailJobsDashboardService();
      return buildSuccessResponse(jobs, requestId);
    }

    if (path === "/email/jobs/process" && method === "POST") {
      const workerResult = await processEmailQueueWorker("worker-api", 10, requestId);
      return buildSuccessResponse(workerResult, requestId);
    }

    const emailRetryMatch = path.match(/^\/email\/jobs\/([a-f0-9-]+)\/retry$/i);
    if (emailRetryMatch && method === "POST") {
      const jobId = emailRetryMatch[1];
      const session = requireAuth(userSession);
      requirePermission(session, "email.retry");
      const result = await retryEmailJobService(jobId, session.userId, requestId);
      return buildSuccessResponse(result, requestId);
    }

    // Webhook Provider Endpoint (Public with HMAC SHA256 Signature Verification & Idempotency)
    if (path === "/webhooks/email-provider" && method === "POST") {
      const signature = event.headers["x-webhook-signature"] || event.headers["X-Webhook-Signature"];
      const rawBody = event.body || "";
      const bodyObj = rawBody ? JSON.parse(rawBody) : {};

      const validated = validateRequestData(emailWebhookPayloadSchema, bodyObj);
      const result = await processWebhookIdempotentService(validated, signature, rawBody, requestId);
      return buildSuccessResponse(result, requestId);
    }

    // Scheduled Reminder Trigger Endpoint (Protected)
    if (path === "/reminders/trigger" && method === "POST") {
      const session = requireAuth(userSession);
      requirePermission(session, "email.send");
      const eventId = event.queryStringParameters?.eventId || "00000000-0000-0000-0000-000000000001";
      const segment = (event.queryStringParameters?.segment as any) || "UNOPENED_LINK";

      const result = await processScheduledReminderService(segment, eventId, requestId);
      return buildSuccessResponse(result, requestId);
    }

    // Event Announcements Endpoints
    const annListMatch = path.match(/^\/events\/([a-f0-9-]+)\/announcements$/i);
    if (annListMatch && method === "GET") {
      const eventId = annListMatch[1];
      requirePermission(userSession, "announcements.read", eventId);
      const data = await getEventAnnouncementsService(eventId);
      return buildSuccessResponse(data, requestId);
    }

    if (annListMatch && method === "POST") {
      const eventId = annListMatch[1];
      const session = requireAuth(userSession);
      requirePermission(session, "announcements.manage", eventId);
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(createAnnouncementSchema, body);
      const created = await createAnnouncementService(
        { ...validated, eventId },
        session.userId,
        requestId
      );
      return buildSuccessResponse(created, requestId);
    }

    const annPublishMatch = path.match(/^\/events\/([a-f0-9-]+)\/announcements\/([a-f0-9-]+)\/publish$/i);
    if (annPublishMatch && method === "POST") {
      const eventId = annPublishMatch[1];
      const announcementId = annPublishMatch[2];
      const session = requireAuth(userSession);
      requirePermission(session, "announcements.publish", eventId);
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(publishAnnouncementSchema, body);
      const result = await publishAnnouncementService(
        announcementId,
        validated.sendEmailNotification,
        session.userId,
        requestId
      );
      return buildSuccessResponse(result, requestId);
    }

    const annUnpublishMatch = path.match(/^\/events\/([a-f0-9-]+)\/announcements\/([a-f0-9-]+)\/unpublish$/i);
    if (annUnpublishMatch && method === "POST") {
      const eventId = annUnpublishMatch[1];
      const announcementId = annUnpublishMatch[2];
      const session = requireAuth(userSession);
      requirePermission(session, "announcements.publish", eventId);
      const result = await unpublishAnnouncementService(announcementId, session.userId, requestId);
      return buildSuccessResponse(result, requestId);
    }

    // Portal Ustadz Announcements Endpoints
    if (path === "/portal/announcements" && method === "GET") {
      const session = requireAuth(userSession);
      const participantIds = await getPortalParticipantIdsService(
        session.userId,
        session.email,
      );
      const data = await getPortalAnnouncementsService(participantIds);
      return buildSuccessResponse(data, requestId);
    }

    const portalAnnReadMatch = path.match(/^\/portal\/announcements\/([a-f0-9-]+)\/read$/i);
    if (portalAnnReadMatch && method === "POST") {
      const announcementId = portalAnnReadMatch[1];
      const session = requireAuth(userSession);
      const participantIds = await getPortalParticipantIdsService(
        session.userId,
        session.email,
      );
      const result = await markAnnouncementAsReadService(
        announcementId,
        participantIds,
      );
      return buildSuccessResponse(result, requestId);
    }

    // Portal QR & Presensi Verification Endpoints
    if (path === "/portal/qr" && method === "GET") {
      const session = requireAuth(userSession);
      const qrData = await getPortalParticipantQrService(
        session.userId,
        session.email,
        event.queryStringParameters?.participantId,
      );
      return buildSuccessResponse(qrData, requestId);
    }

    if (path === "/portal/qr/rotate" && method === "POST") {
      const session = requireAuth(userSession);
      const currentQr = await getPortalParticipantQrService(
        session.userId,
        session.email,
        event.queryStringParameters?.participantId,
      );
      const rotated = await rotateParticipantQrTokenService(
        currentQr.participantId,
        session.userId,
        requestId,
      );
      return buildSuccessResponse(rotated, requestId);
    }

    if (path === "/checkin/verify-qr" && method === "POST") {
      const session = requireAuth(userSession);
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(verifyQrTokenSchema, body);
      requirePermission(session, "attendance.record", validated.eventId);
      const result = await verifyQrTokenForCheckinService(validated.eventId, validated.qrTokenOrCode, session.userId, requestId);
      return buildSuccessResponse(result, requestId);
    }

    // On-Site Check-in Module Endpoints
    const sessActiveMatch = path.match(/^\/events\/([a-f0-9-]+)\/sessions\/active$/i);
    if (sessActiveMatch && method === "GET") {
      const eventId = sessActiveMatch[1];
      requirePermission(userSession, "attendance.read", eventId);
      const result = await getActiveSessionService(eventId);
      return buildSuccessResponse(result, requestId);
    }

    const checkinExecMatch = path.match(/^\/events\/([a-f0-9-]+)\/checkin$/i);
    if (checkinExecMatch && method === "POST") {
      const eventId = checkinExecMatch[1];
      const session = requireAuth(userSession);
      requirePermission(session, "attendance.record", eventId);
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(processCheckinSchema, body);
      const result = await processOnSiteCheckinService(
        eventId,
        validated.qrTokenOrCode,
        validated.method || "QR_SCAN",
        session.userId,
        requestId,
        { sessionId: validated.sessionId, dayId: validated.dayId },
      );
      return buildSuccessResponse(result, requestId);
    }

    const checkinLogsMatch = path.match(/^\/events\/([a-f0-9-]+)\/checkin\/logs$/i);
    if (checkinLogsMatch && method === "GET") {
      const eventId = checkinLogsMatch[1];
      requirePermission(userSession, "attendance.read", eventId);
      const queryParams = validateRequestData(queryCheckinLogsSchema, event.queryStringParameters || {});
      const logs = await getRecentCheckinLogsService(eventId, queryParams.limit);
      return buildSuccessResponse(logs, requestId);
    }

    // Dynamic Location QR Endpoints (Committee & Self Check-in)
    const locQrMatch = path.match(/^\/events\/([a-f0-9-]+)\/sessions\/([a-f0-9-]+)\/location-qr$/i);
    if (locQrMatch && method === "GET") {
      const eventId = locQrMatch[1];
      const sessionId = locQrMatch[2];
      requirePermission(userSession, "attendance.read", eventId);
      const qrData = await getOrGenerateLocationQrTokenService(eventId, sessionId);
      return buildSuccessResponse(qrData, requestId);
    }

    const locQrRotateMatch = path.match(/^\/events\/([a-f0-9-]+)\/sessions\/([a-f0-9-]+)\/location-qr\/rotate$/i);
    if (locQrRotateMatch && method === "POST") {
      const eventId = locQrRotateMatch[1];
      const sessionId = locQrRotateMatch[2];
      const session = requireAuth(userSession);
      requirePermission(session, "attendance.record", eventId);
      const rotated = await rotateLocationQrTokenService(eventId, sessionId, session.userId);
      return buildSuccessResponse(rotated, requestId);
    }

    if (path === "/portal/self-checkin" && method === "POST") {
      const session = requireAuth(userSession);
      const ustadzId = session.ustadzId || "00000000-0000-0000-0000-000000000001";
      const body = event.body ? JSON.parse(event.body) : {};
      const result = await processSelfCheckinService(
        ustadzId,
        body.eventId,
        body.sessionId,
        body.rawLocationQrToken,
        session.userId,
        requestId
      );
      return buildSuccessResponse(result, requestId);
    }

    // Attendance Management, Correction & Recap Endpoints
    const manualMarkMatch = path.match(/^\/events\/([a-f0-9-]+)\/attendance\/manual-mark$/i);
    if (manualMarkMatch && method === "POST") {
      const eventId = manualMarkMatch[1];
      const session = requireAuth(userSession);
      requirePermission(session, "attendance.record", eventId);
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(manualMarkAttendanceSchema, body);
      const result = await manualMarkAttendanceService(eventId, validated, session.userId, requestId);
      return buildSuccessResponse(result, requestId);
    }

    const correctAttendanceMatch = path.match(/^\/events\/([a-f0-9-]+)\/attendance\/([a-f0-9-]+)\/correct$/i);
    if (correctAttendanceMatch && method === "POST") {
      const eventId = correctAttendanceMatch[1];
      const recordId = correctAttendanceMatch[2];
      const session = requireAuth(userSession);
      requirePermission(session, "attendance.correct", eventId);
      const body = event.body ? JSON.parse(event.body) : {};
      const validated = validateRequestData(correctAttendanceSchema, body);
      const result = await correctAttendanceRecordService(recordId, validated, session.userId, requestId);
      return buildSuccessResponse(result, requestId);
    }

    const recapMatch = path.match(/^\/events\/([a-f0-9-]+)\/attendance\/recap$/i);
    if (recapMatch && method === "GET") {
      const eventId = recapMatch[1];
      requirePermission(userSession, "attendance.read", eventId);
      const recap = await getAttendanceSummaryRecapService(eventId);
      return buildSuccessResponse(recap, requestId);
    }

    const participantAttendanceReportMatch = path.match(
      /^\/events\/([a-f0-9-]+)\/attendance\/([a-f0-9-]+)\/report$/i,
    );
    if (participantAttendanceReportMatch && method === "GET") {
      const eventId = participantAttendanceReportMatch[1];
      requirePermission(userSession, "attendance.read", eventId);
      return buildSuccessResponse(
        await getParticipantAttendanceReportService(eventId, participantAttendanceReportMatch[2]),
        requestId,
      );
    }

    // Dashboard & Report Endpoints
    if (path === "/dashboard/admin" && method === "GET") {
      requirePermission(userSession, "reports.read");
      const metrics = await getAdminDashboardMetricsService();
      return buildSuccessResponse(metrics, requestId);
    }

    if (path === "/dashboard/committee" && method === "GET") {
      const eventId = event.queryStringParameters?.eventId;
      requirePermission(userSession, "attendance.read", eventId);
      const metrics = await getCommitteeDashboardMetricsService(eventId);
      return buildSuccessResponse(metrics, requestId);
    }

    const reportTypeMatch = path.match(/^\/reports\/([a-z0-9-]+)$/i);
    if (reportTypeMatch && method === "GET") {
      const reportType = reportTypeMatch[1];
      if (reportType !== "export") {
        requirePermission(userSession, "reports.read");
        const query = event.queryStringParameters || {};
        const report = await getPaginatedReportService(reportType, {
          page: Number(query.page || 1),
          pageSize: Number(query.pageSize || 15),
          eventId: query.eventId,
        });
        return buildSuccessResponse(report, requestId);
      }
    }

    if (path === "/reports/export" && method === "POST") {
      const session = requireAuth(userSession);
      requirePermission(session, "reports.export");
      const body = event.body ? JSON.parse(event.body) : {};
      const exportResult = await generateReportExportService(
        {
          reportType: body.reportType || "no-show",
          format: body.format || "CSV",
          eventId: body.eventId,
          maxRecords: body.maxRecords,
        },
        session.userId,
        requestId
      );
      return buildSuccessResponse(exportResult, requestId);
    }

    // Spreadsheet Import Endpoints (Dry-Run & Commit Guard)
    if (path === "/admin/import/preview" && method === "POST") {
      requirePermission(userSession, "institutions.create");
      const body = event.body ? JSON.parse(event.body) : {};
      const previewResult = await processSpreadsheetImportDryRunService(body.rows || []);
      return buildSuccessResponse(previewResult, requestId);
    }

    if (path === "/admin/import/commit" && method === "POST") {
      const session = requireAuth(userSession);
      requirePermission(session, "institutions.create");
      const body = event.body ? JSON.parse(event.body) : {};
      const commitResult = await commitSpreadsheetImportService(
        {
          rows: body.rows || [],
          approved: body.approved === true,
          targetType: body.targetType || "INSTITUTIONS",
        },
        session.userId,
        requestId
      );
      return buildSuccessResponse(commitResult, requestId);
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
