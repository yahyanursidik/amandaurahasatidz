import {
  findInvitationsRepository,
  findInvitationByIdRepository,
  findInvitationByTokenHashRepository,
  createInvitationRepository,
  updateInvitationStatusRepository,
  saveInvitationResponseRepository,
} from "../repositories/invitationRepository";
import { generateSecureToken, hashToken } from "../utils/token";
import { NotFoundError, ValidationError, ForbiddenError } from "../utils/errors";
import { verifyCaptcha } from "../utils/captcha";
import { createAuditLog } from "./auditService";

export async function getInvitationsService(eventId?: string) {
  return await findInvitationsRepository(eventId);
}

export async function createInvitationService(data: any, actorUserId: string, requestId: string) {
  const tokenInfo = generateSecureToken("inv_inst");

  const invData = {
    eventId: data.eventId,
    invitationType: data.invitationType,
    institutionId: data.institutionId || null,
    ustadzId: data.ustadzId || null,
    invitationNumber: data.invitationNumber,
    quota: data.quota || 1,
    status: "DRAFT",
    createdBy: actorUserId,
  };

  const result = await createInvitationRepository(invData, tokenInfo.tokenHash);

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
    publicUrl: `/invitation/institution/${tokenInfo.rawToken}`,
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

  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    throw new ForbiddenError("Tautan undangan ini telah kedaluwarsa.");
  }

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
      responseDeadline: invitation.responseDeadline,
    },
    event: {
      name: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
      venueName: event.venueName,
    },
    institution: institution
      ? {
          name: institution.name,
          code: institution.code,
          email: institution.email,
        }
      : null,
  };
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

  const savedResponse = await saveInvitationResponseRepository(
    invitation.id,
    payload.responseStatus,
    payload.notes,
    payload.isFinal
  );

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
    message: payload.isFinal
      ? "Konfirmasi final undangan berhasil disimpan. Terima kasih atas partisipasi lembaga Anda."
      : "Draft respon undangan berhasil disimpan sementara.",
  };
}
