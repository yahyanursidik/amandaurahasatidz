import {
  findInvitationsRepository,
  findInvitationByIdRepository,
  findInvitationByTokenHashRepository,
  createInvitationRepository,
  updateInvitationStatusRepository,
  saveInvitationResponseRepository,
  saveInstitutionDelegationRepository,
  rotateInvitationLinkRepository,
} from "../repositories/invitationRepository";
import { generateSecureToken, hashToken } from "../utils/token";
import { NotFoundError, ValidationError, ForbiddenError } from "../utils/errors";
import { verifyCaptcha } from "../utils/captcha";
import { createAuditLog } from "./auditService";
import { findEventByIdRepository } from "../repositories/eventRepository";

function assertInvitationResponseOpen(result: { invitation: any; event: any; link?: any }) {
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
    invitationNumber: data.invitationNumber,
    quota: data.quota || 1,
    responseDeadline,
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
    publicUrl: `/invitation/${routeType}/${tokenInfo.rawToken}`,
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
  return {
    invitationId: invitation.id,
    expiresAt: link.expiresAt,
    publicUrl: `/invitation/${routeType}/${tokenInfo.rawToken}`,
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
  assertInvitationResponseOpen(result);

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
      startDate: event.startDate,
      endDate: event.endDate,
      venueName: event.venueName,
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
