import {
  findInvitationsRepository,
  findInvitationByIdRepository,
  findInvitationByEventAndNumberRepository,
  findInvitationByTokenHashRepository,
  createInvitationRepository,
  updateInvitationStatusRepository,
  saveInvitationResponseRepository,
  saveInstitutionDelegationRepository,
  rotateInvitationLinkRepository,
} from "../repositories/invitationRepository";
import { generateSecureToken, hashToken } from "../utils/token";
import { NotFoundError, ValidationError, ForbiddenError, ConflictError } from "../utils/errors";
import { verifyCaptcha } from "../utils/captcha";
import { createAuditLog } from "./auditService";
import { findEventByIdRepository } from "../repositories/eventRepository";
import { findInstitutionByIdRepository } from "../repositories/institutionRepository";
import { enqueueEmailJob } from "./emailQueueService";
import {
  createInvitationOtpChallenge,
  maskInvitationEmail,
  shouldExposeInvitationPreviewCode,
  verifyInvitationOtpChallenge,
  verifyInvitationVerificationToken,
} from "./invitationOtpService";
import {
  createInstitutionAccessVerification,
  getInstitutionAccessCode,
  verifyInstitutionAccessCode,
  verifyInstitutionAccessVerification,
} from "./institutionAccessCodeService";
import { buildInstitutionInvitationPath } from "../../../../src/lib/invitationUrl";
import { provisionParticipantPortalAccountService } from "./participantService";

function assertInvitationResponseOpen(result: { invitation: any; event: any; link?: any }) {
  if (result.invitation.status === "REVOKED" || result.link?.revokedAt) {
    throw new ForbiddenError("Tautan undangan ini telah dicabut oleh panitia.");
  }
  const deadline = result.invitation.responseDeadline || result.event.invitationResponseDeadline;
  if (deadline && new Date(deadline) < new Date()) {
    throw new ForbiddenError("Batas konfirmasi undangan telah berakhir. Silakan hubungi panitia.");
  }
  if (result.link?.expiresAt && new Date(result.link.expiresAt) < new Date()) {
    throw new ForbiddenError("Tautan undangan ini telah kedaluwarsa.");
  }
}

export async function getInvitationsService(eventId?: string) {
  return await findInvitationsRepository(eventId);
}

export async function createInvitationService(data: any, actorUserId: string, requestId: string) {
  const event = await findEventByIdRepository(data.eventId);
  if (!event) throw new NotFoundError("Event untuk undangan tidak ditemukan.");
  const invitationNumber = String(data.invitationNumber || "").trim();
  const existingInvitation = await findInvitationByEventAndNumberRepository(data.eventId, invitationNumber);
  if (existingInvitation) {
    throw new ConflictError(
      `Nomor undangan '${invitationNumber}' sudah digunakan pada event ini. Gunakan nomor lain atau buat ulang tautan dari undangan yang sudah ada.`,
      { invitationId: existingInvitation.id, invitationStatus: existingInvitation.status },
    );
  }
  let recipientInstitution: Awaited<ReturnType<typeof findInstitutionByIdRepository>> | null = null;
  if (data.invitationType === "INSTITUTION") {
    recipientInstitution = await findInstitutionByIdRepository(data.institutionId);
    if (!recipientInstitution) throw new NotFoundError("Lembaga penerima undangan tidak ditemukan atau telah dinonaktifkan.");
  }
  const responseDeadline = data.responseDeadline
    ? new Date(data.responseDeadline)
    : event.invitationResponseDeadline
      ? new Date(event.invitationResponseDeadline)
      : null;
  if (responseDeadline && responseDeadline < new Date()) {
    throw new ValidationError("Batas respons undangan harus berada di masa mendatang.");
  }
  const routeType = data.invitationType === "INDIVIDUAL" ? "individual" : "institution";
  const tokenInfo = generateSecureToken(routeType === "individual" ? "inv_ind" : "inv_inst");

  const invData = {
    eventId: data.eventId,
    invitationType: data.invitationType,
    institutionId: data.institutionId || null,
    ustadzId: data.ustadzId || null,
    invitationNumber,
    quota: data.quota || 1,
    responseDeadline,
    status: "DRAFT",
    createdBy: actorUserId,
  };

  let result: Awaited<ReturnType<typeof createInvitationRepository>>;
  try {
    result = await createInvitationRepository(invData, tokenInfo.tokenHash);
  } catch (error) {
    const databaseCode = (error as { code?: string; cause?: { code?: string } })?.code
      || (error as { cause?: { code?: string } })?.cause?.code;
    if (databaseCode === "23505") {
      throw new ConflictError(
        `Nomor undangan '${invitationNumber}' baru saja digunakan. Gunakan nomor lain lalu coba kembali.`,
      );
    }
    throw error;
  }

  await createAuditLog({
    actorUserId,
    action: "INVITATION_CREATED",
    resourceType: "INVITATION",
    resourceId: result.invitation.id,
    eventId: data.eventId,
    afterData: result.invitation as any,
    requestId,
  });

  return {
    invitation: result.invitation,
    rawToken: tokenInfo.rawToken, // Returned ONLY ONCE during creation for sending link
    publicUrl: data.invitationType === "INSTITUTION"
      ? buildInstitutionInvitationPath(recipientInstitution?.name || "Lembaga", tokenInfo.rawToken)
      : `/invitation/${routeType}/${tokenInfo.rawToken}`,
    ...(data.invitationType === "INSTITUTION"
      ? { accessCode: getInstitutionAccessCode(result.invitation.id) }
      : {}),
  };
}

export async function sendInvitationService(id: string, actorUserId: string, requestId: string) {
  const inv = await findInvitationByIdRepository(id);
  if (!inv) throw new NotFoundError(`Undangan ID ${id} tidak ditemukan.`);

  const updated = await updateInvitationStatusRepository(id, "SENT", { sentAt: new Date() });

  await createAuditLog({
    actorUserId,
    action: "INVITATION_SENT",
    resourceType: "INVITATION",
    resourceId: id,
    eventId: inv.eventId,
    requestId,
  });

  return updated;
}

export async function revokeInvitationService(id: string, actorUserId: string, requestId: string) {
  const inv = await findInvitationByIdRepository(id);
  if (!inv) throw new NotFoundError(`Undangan ID ${id} tidak ditemukan.`);

  const updated = await updateInvitationStatusRepository(id, "REVOKED");

  await createAuditLog({
    actorUserId,
    action: "INVITATION_REVOKED",
    resourceType: "INVITATION",
    resourceId: id,
    eventId: inv.eventId,
    requestId,
  });

  return updated;
}

export async function regenerateInvitationLinkService(
  id: string,
  actorUserId: string,
  requestId: string,
) {
  const invitation = await findInvitationByIdRepository(id);
  if (!invitation) throw new NotFoundError(`Undangan ID ${id} tidak ditemukan.`);
  if (invitation.status === "REVOKED") {
    throw new ValidationError("Undangan telah dicabut. Buat undangan baru untuk lembaga ini.");
  }

  const tokenInfo = generateSecureToken(
    invitation.invitationType === "INDIVIDUAL" ? "inv_ind" : "inv_inst",
  );
  const expiresAt = invitation.responseDeadline
    ? new Date(invitation.responseDeadline)
    : new Date(Date.now() + 14 * 86400000);
  const link = await rotateInvitationLinkRepository(invitation.id, tokenInfo.tokenHash, expiresAt);

  await createAuditLog({
    actorUserId,
    action: "INVITATION_LINK_REGENERATED",
    resourceType: "INVITATION_LINK",
    resourceId: link.id,
    eventId: invitation.eventId,
    requestId,
  });

  const routeType = invitation.invitationType === "INDIVIDUAL" ? "individual" : "institution";
  const recipientInstitution = invitation.institutionId
    ? await findInstitutionByIdRepository(invitation.institutionId)
    : null;
  return {
    invitationId: invitation.id,
    expiresAt: link.expiresAt,
    publicUrl: invitation.invitationType === "INSTITUTION"
      ? buildInstitutionInvitationPath(recipientInstitution?.name || "Lembaga", tokenInfo.rawToken)
      : `/invitation/${routeType}/${tokenInfo.rawToken}`,
    ...(invitation.invitationType === "INSTITUTION"
      ? { accessCode: getInstitutionAccessCode(invitation.id) }
      : {}),
  };
}

export async function getInstitutionInvitationAccessCodeService(
  eventId: string,
  invitationId: string,
  actorUserId: string,
  requestId: string,
) {
  const invitation = await findInvitationByIdRepository(invitationId);
  if (!invitation || invitation.eventId !== eventId) {
    throw new NotFoundError("Undangan lembaga tidak ditemukan pada event ini.");
  }
  if (invitation.invitationType !== "INSTITUTION") {
    throw new ValidationError("Kode unik hanya tersedia untuk undangan lembaga.");
  }
  await createAuditLog({
    actorUserId,
    action: "INVITATION_ACCESS_CODE_VIEWED",
    resourceType: "INVITATION",
    resourceId: invitation.id,
    eventId,
    requestId,
  });
  return {
    invitationId: invitation.id,
    accessCode: getInstitutionAccessCode(invitation.id),
  };
}

export async function getPublicInstitutionInvitationService(rawToken: string, requestId: string) {
  const tokenHash = hashToken(rawToken);
  const result = await findInvitationByTokenHashRepository(tokenHash);

  if (!result) {
    throw new NotFoundError("Tautan undangan tidak valid atau tidak ditemukan.");
  }

  const { link, invitation, event, institution } = result;

  if (invitation.status === "REVOKED" || link.revokedAt) {
    throw new ForbiddenError("Tautan undangan ini telah dicabut oleh panitia.");
  }
  assertInvitationResponseOpen(result);

  await createAuditLog({
    actorUserId: null,
    action: "INVITATION_TOKEN_ACCESSED",
    resourceType: "INVITATION_LINK",
    resourceId: link.id,
    eventId: event.id,
    reason: `Token ${rawToken.substring(0, 12)}... diakses oleh publik.`,
    requestId,
  });

  return {
    invitation: {
      invitationNumber: invitation.invitationNumber,
      quota: invitation.quota,
      status: invitation.status,
      responseDeadline: invitation.responseDeadline || event.invitationResponseDeadline,
    },
    event: {
      name: event.name,
      subtitle: event.subtitle,
      startDate: event.startDate,
      endDate: event.endDate,
      venueName: event.venueName,
      venueAddress: event.venueAddress,
      posterUrl: event.posterUrl,
      posterAlt: event.posterAlt,
      posterFocalPoint: event.posterFocalPoint,
    },
    institution: institution
      ? {
          name: institution.name,
          code: institution.code,
          verificationRequired: true,
          verificationMethod: "INSTITUTION_ACCESS_CODE",
        }
      : null,
  };
}

export async function verifyInstitutionInvitationAccessCodeService(
  rawToken: string,
  code: string,
  requestId: string,
) {
  const result = await findInvitationByTokenHashRepository(hashToken(rawToken));
  if (!result) throw new NotFoundError("Tautan undangan tidak valid.");
  assertInvitationResponseOpen(result);

  if (!verifyInstitutionAccessCode(result.invitation.id, code)) {
    throw new ValidationError("Kode unik lembaga tidak sesuai. Periksa pesan undangan dari panitia.");
  }

  const verification = createInstitutionAccessVerification(result.invitation.id);
  await createAuditLog({
    actorUserId: null,
    action: "INVITATION_ACCESS_CODE_VERIFIED",
    resourceType: "INVITATION",
    resourceId: result.invitation.id,
    eventId: result.event.id,
    requestId,
  });
  return verification;
}

export async function requestInstitutionInvitationOtpService(
  rawToken: string,
  email: string,
  requestId: string,
) {
  const result = await findInvitationByTokenHashRepository(hashToken(rawToken));
  if (!result) throw new NotFoundError("Tautan undangan tidak valid.");
  assertInvitationResponseOpen(result);

  const registeredEmail = result.institution?.email?.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();
  if (!registeredEmail) {
    throw new ValidationError("Email perwakilan belum tercatat. Hubungi panitia untuk memperbarui data lembaga.");
  }
  if (registeredEmail !== normalizedEmail) {
    throw new ValidationError(
      "Email tidak cocok dengan data undangan. Gunakan email perwakilan yang menerima undangan atau hubungi panitia.",
    );
  }

  const challenge = createInvitationOtpChallenge(result.invitation.id, normalizedEmail);
  await enqueueEmailJob({
    templateCode: "OTP_CODE",
    recipientEmail: normalizedEmail,
    recipientName: result.institution?.name || null,
    variables: { otpCode: challenge.code, expiresMinutes: 5 },
    idempotencyKey: `invitation_otp_${result.invitation.id}_${hashToken(challenge.challengeToken).slice(0, 20)}`,
  });

  await createAuditLog({
    actorUserId: null,
    action: "INVITATION_OTP_REQUESTED",
    resourceType: "INVITATION",
    resourceId: result.invitation.id,
    eventId: result.event.id,
    requestId,
  });

  return {
    challengeToken: challenge.challengeToken,
    expiresAt: challenge.expiresAt,
    maskedEmail: maskInvitationEmail(normalizedEmail),
    ...(shouldExposeInvitationPreviewCode() ? { previewCode: challenge.code } : {}),
  };
}

export async function verifyInstitutionInvitationOtpService(
  rawToken: string,
  input: { email: string; code: string; challengeToken: string },
  requestId: string,
) {
  const result = await findInvitationByTokenHashRepository(hashToken(rawToken));
  if (!result) throw new NotFoundError("Tautan undangan tidak valid.");
  assertInvitationResponseOpen(result);

  const verified = verifyInvitationOtpChallenge(
    input.challengeToken,
    input.code,
    result.invitation.id,
    input.email,
  );
  if (!verified) {
    throw new ValidationError("Kode OTP salah atau telah kedaluwarsa. Minta kode baru lalu coba kembali.");
  }

  await createAuditLog({
    actorUserId: null,
    action: "INVITATION_OTP_VERIFIED",
    resourceType: "INVITATION",
    resourceId: result.invitation.id,
    eventId: result.event.id,
    requestId,
  });

  return verified;
}

export async function submitInstitutionResponseService(
  rawToken: string,
  payload: any,
  requestId: string
) {
  const tokenHash = hashToken(rawToken);
  const result = await findInvitationByTokenHashRepository(tokenHash);

  if (!result) {
    throw new NotFoundError("Tautan undangan tidak valid.");
  }

  const { invitation, event } = result;
  assertInvitationResponseOpen(result);

  const verificationValid = Boolean(
    payload.verificationToken &&
      (verifyInstitutionAccessVerification(payload.verificationToken, invitation.id) ||
        verifyInvitationVerificationToken(payload.verificationToken, invitation.id)),
  );
  if (!verificationValid) {
    throw new ForbiddenError("Verifikasi undangan telah berakhir. Masukkan kembali kode unik lembaga untuk melanjutkan.");
  }

  if (payload.captchaToken) {
    const isCaptchaValid = await verifyCaptcha(payload.captchaToken);
    if (!isCaptchaValid) {
      throw new ValidationError("Verifikasi CAPTCHA gagal.");
    }
  }

  if (payload.delegates && payload.delegates.length > (invitation.quota || 1)) {
    throw new ValidationError(
      `Jumlah delegasi (${payload.delegates.length}) melebihi kuota undangan yang diberikan (${invitation.quota}).`
    );
  }

  const saved = await saveInstitutionDelegationRepository(invitation.id, payload);
  const savedResponse = saved.response;
  const portalAccounts: Array<{
    participantId: string;
    participantName: string;
    email: string;
    temporaryPassword: string | null;
    loginUrl: string;
    action: string;
    shownOnce: boolean;
    setupError?: string;
  }> = [];

  if (payload.isFinal && payload.responseStatus === "ACCEPTED") {
    for (const participant of saved.participants) {
      try {
        portalAccounts.push(
          await provisionParticipantPortalAccountService(
            event.id,
            participant.id,
            false,
            null,
            requestId,
          ),
        );
      } catch (error) {
        portalAccounts.push({
          participantId: participant.id,
          participantName: "Peserta terdaftar",
          email: "",
          temporaryPassword: null,
          loginUrl: "/login/ustadz",
          action: "SETUP_REQUIRED",
          shownOnce: false,
          setupError: error instanceof Error
            ? error.message
            : "Akses portal perlu dibantu oleh panitia.",
        });
      }
    }
  }

  if (payload.isFinal) {
    await createAuditLog({
      actorUserId: null,
      action: "INVITATION_FINAL_RESPONSE_SUBMITTED",
      resourceType: "INVITATION_RESPONSE",
      resourceId: savedResponse.id,
      eventId: event.id,
      reason: `Konfirmasi final undangan ${invitation.invitationNumber} disubmit dengan status ${payload.responseStatus}.`,
      requestId,
    });
  }

  return {
    response: savedResponse,
    participants: saved.participants,
    portalAccounts,
    message: payload.isFinal
      ? "Konfirmasi final undangan berhasil disimpan. Terima kasih atas partisipasi lembaga Anda."
      : "Draft respon undangan berhasil disimpan sementara.",
  };
}

export async function getPublicIndividualInvitationService(rawToken: string, requestId: string) {
  const tokenHash = hashToken(rawToken);
  const result = await findInvitationByTokenHashRepository(tokenHash);

  if (!result) {
    throw new NotFoundError("Tautan undangan individu tidak valid atau tidak ditemukan.");
  }

  const { link, invitation, event } = result;

  if (invitation.status === "REVOKED" || link.revokedAt) {
    throw new ForbiddenError("Tautan undangan individu ini telah dicabut oleh panitia.");
  }
  assertInvitationResponseOpen(result);

  await createAuditLog({
    actorUserId: null,
    action: "INDIVIDUAL_INVITATION_TOKEN_ACCESSED",
    resourceType: "INVITATION_LINK",
    resourceId: link.id,
    eventId: event.id,
    requestId,
  });

  return {
    invitation: {
      invitationNumber: invitation.invitationNumber,
      status: invitation.status,
      responseDeadline: invitation.responseDeadline || event.invitationResponseDeadline,
    },
    event: {
      name: event.name,
      subtitle: event.subtitle,
      startDate: event.startDate,
      endDate: event.endDate,
      venueName: event.venueName,
      venueAddress: event.venueAddress,
      posterUrl: event.posterUrl,
      posterAlt: event.posterAlt,
      posterFocalPoint: event.posterFocalPoint,
    },
  };
}

export async function submitIndividualResponseService(rawToken: string, responseStatus: "ACCEPTED" | "DECLINED", requestId: string) {
  const tokenHash = hashToken(rawToken);
  const result = await findInvitationByTokenHashRepository(tokenHash);

  if (!result) throw new NotFoundError("Tautan undangan tidak valid.");

  const { invitation, event } = result;
  assertInvitationResponseOpen(result);
  const savedResponse = await saveInvitationResponseRepository(invitation.id, responseStatus, null, true);

  await createAuditLog({
    actorUserId: null,
    action: "INDIVIDUAL_INVITATION_RSVP_SUBMITTED",
    resourceType: "INVITATION_RESPONSE",
    resourceId: savedResponse.id,
    eventId: event.id,
    reason: `RSVP undangan individu ${invitation.invitationNumber}: ${responseStatus}`,
    requestId,
  });

  return {
    response: savedResponse,
    message: `Konfirmasi RSVP Anda (${responseStatus}) berhasil disimpan.`,
  };
}
