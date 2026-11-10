import {
  findInvitationsRepository,
  findInvitationByIdRepository,
  findInvitationByEventAndNumberRepository,
  findInvitationByTokenHashRepository,
  findInvitationPolicyByTokenHashRepository,
  createInvitationRepository,
  updateInvitationStatusRepository,
  saveInvitationResponseRepository,
  saveInstitutionDelegationRepository,
  rotateInvitationLinkRepository,
  updateInvitationRepository,
  countInvitationParticipantsRepository,
  markInvitationOpenedRepository,
  findInvitationUstadzOptionsRepository,
  findInvitationUstadzRecipientRepository,
  findOpenIndividualInvitationRepository,
  findUstadzEventParticipationRepository,
} from "../repositories/invitationRepository";
import { generateSecureToken, hashToken } from "../utils/token";
import { NotFoundError, ValidationError, ForbiddenError, ConflictError } from "../utils/errors";
import { verifyCaptcha } from "../utils/captcha";
import { createAuditLog } from "./auditService";
import { findEventByIdRepository, findRegistrationEventRepository } from "../repositories/eventRepository";
import { findInstitutionByIdRepository, findInvitationInstitutionOptionsRepository } from "../repositories/institutionRepository";
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
import { signCardForParticipant, cardPath } from "./participantCardService";
import { queueRegistrationReceivedEmails } from "./participantCardEmailService";
import { participantConfirmationPath, signConfirmationForParticipant } from "./participantConfirmationLink";
import { countApprovedParticipantsBySourceRepository, countApprovedParticipantsForEventRepository } from "../repositories/participantRepository";
import { logError } from "../utils/logger";
import { invitationAllowsGroup, invitationParticipantLimit, isInvitationPending } from "../../../../src/lib/institutionInvitation";

function assertInvitationResponseOpen(result: { invitation: any; event: any; link?: any }) {
  if (result.invitation.status === "REVOKED" || result.link?.revokedAt) {
    throw new ForbiddenError("Tautan undangan ini telah dicabut oleh panitia.");
  }
  if (["ACCEPTED", "DECLINED"].includes(result.invitation.status)) {
    throw new ConflictError("Undangan ini sudah dijawab secara final. Hubungi panitia untuk perubahan data.");
  }
  if (["DRAFT", "CANCELLED", "ARCHIVED", "COMPLETED"].includes(result.event.status)) {
    throw new ForbiddenError("Event belum dibuka atau sudah tidak menerima konfirmasi undangan. Hubungi panitia.");
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
  return (await findInvitationsRepository(eventId)).map((invitation) => ({ ...invitation,
    allowGroup: invitationAllowsGroup(invitation),
    responseDeadline: invitation.responseDeadline || invitation.eventResponseDeadline,
  }));
}

async function scopedInvitation(eventId: string, id: string) {
  const invitation = await findInvitationByIdRepository(id);
  if (!invitation || invitation.eventId !== eventId) throw new NotFoundError("Undangan tidak ditemukan pada event ini.");
  return invitation;
}

export async function getInvitationInstitutionsService(eventId: string, page: number, pageSize: number) {
  if (!await findRegistrationEventRepository(eventId)) throw new NotFoundError("Event tidak ditemukan.");
  return findInvitationInstitutionOptionsRepository(page, pageSize);
}

export async function getInvitationUstadzOptionsService(eventId: string, search: string, page: number, pageSize: number) {
  if (!await findRegistrationEventRepository(eventId)) throw new NotFoundError("Event tidak ditemukan.");
  return findInvitationUstadzOptionsRepository(search, page, pageSize);
}

async function assertIndividualRecipient(eventId: string, ustadzId: string, exceptInvitationId?: string) {
  const recipient = await findInvitationUstadzRecipientRepository(ustadzId);
  if (!recipient || recipient.profileStatus !== "ACTIVE" || recipient.deletedAt || recipient.mergedIntoId) {
    throw new ValidationError("Pilih profil asatidz aktif dari direktori.");
  }
  const [participant, pendingInvitation] = await Promise.all([
    findUstadzEventParticipationRepository(eventId, ustadzId),
    findOpenIndividualInvitationRepository(eventId, ustadzId, exceptInvitationId),
  ]);
  if (participant) throw new ConflictError("Asatidz ini sudah terdaftar pada event. Lihat data peserta sebelum membuat undangan baru.");
  if (pendingInvitation) throw new ConflictError(`Asatidz ini sudah memiliki undangan aktif ${pendingInvitation.invitationNumber}. Gunakan atau cabut undangan tersebut.`);
  return recipient;
}

function resolveInvitationQuota(data: { quota?: number; allowGroup?: boolean }, fallback: number, individual = false) {
  if (individual || data.allowGroup === false) return 1;
  const quota = data.quota ?? fallback;
  if (data.allowGroup && quota < 2) throw new ValidationError("Undangan rombongan memerlukan kuota minimal 2 peserta, termasuk peserta utama.");
  return quota;
}

export async function createInvitationService(data: any, actorUserId: string, requestId: string) {
  const event = await findEventByIdRepository(data.eventId);
  if (!event) throw new NotFoundError("Event untuk undangan tidak ditemukan.");
  if (["CANCELLED", "COMPLETED", "ARCHIVED"].includes(event.status)) throw new ValidationError("Event ini sudah tidak menerima undangan baru.");
  const supportedAudience = data.invitationType === "INSTITUTION" ? "INSTITUTION_INVITATION" : "INDIVIDUAL_INVITATION";
  if (event.audienceMode !== "MIXED" && event.audienceMode !== supportedAudience) {
    throw new ValidationError("Jenis undangan tidak sesuai jalur peserta event. Periksa pengaturan event.");
  }
  const invitationNumber = String(data.invitationNumber || "").trim();
  const existingInvitation = await findInvitationByEventAndNumberRepository(data.eventId, invitationNumber);
  if (existingInvitation) {
    throw new ConflictError(
      `Nomor undangan '${invitationNumber}' sudah digunakan pada event ini. Gunakan nomor lain atau buat ulang tautan dari undangan yang sudah ada.`,
      { invitationId: existingInvitation.id, invitationStatus: existingInvitation.status },
    );
  }
  let recipientInstitution: Awaited<ReturnType<typeof findInstitutionByIdRepository>> | null = null;
  let recipientUstadz: Awaited<ReturnType<typeof findInvitationUstadzRecipientRepository>> | null = null;
  if (data.invitationType === "INSTITUTION") {
    recipientInstitution = await findInstitutionByIdRepository(data.institutionId);
    if (!recipientInstitution || recipientInstitution.status !== "ACTIVE" || recipientInstitution.deletedAt) {
      throw new ValidationError("Lembaga penerima tidak aktif. Pilih lembaga aktif dari data master.");
    }
  } else {
    if (!data.ustadzId) throw new ValidationError("Pilih asatidz penerima undangan individu.");
    if (data.allowGroup === true || data.quota != null && data.quota !== 1) {
      throw new ValidationError("Undangan individu hanya berlaku untuk satu asatidz.");
    }
    recipientUstadz = await assertIndividualRecipient(data.eventId, data.ustadzId);
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
    institutionId: data.invitationType === "INSTITUTION" ? data.institutionId : null,
    ustadzId: data.invitationType === "INDIVIDUAL" ? data.ustadzId : null,
    invitationNumber,
    quota: resolveInvitationQuota(data, event.defaultInstitutionQuota || 1, data.invitationType === "INDIVIDUAL"),
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
    invitation: { ...result.invitation, institutionName: recipientInstitution?.name || null,
      ustadzName: recipientUstadz?.fullName || null, ustadzEmail: recipientUstadz?.email || null,
      ustadzWhatsapp: recipientUstadz?.whatsapp || null, ustadzPhone: recipientUstadz?.phone || null,
      allowGroup: invitationAllowsGroup(result.invitation) },
    rawToken: tokenInfo.rawToken, // Returned ONLY ONCE during creation for sending link
    publicUrl: data.invitationType === "INSTITUTION"
      ? buildInstitutionInvitationPath(recipientInstitution?.name || "Lembaga", tokenInfo.rawToken)
      : `/invitation/${routeType}/${tokenInfo.rawToken}`,
    ...(data.invitationType === "INSTITUTION"
      ? { accessCode: getInstitutionAccessCode(result.invitation.id) }
      : {}),
  };
}

export async function editInvitationService(eventId: string, id: string, data: {
  institutionId?: string; ustadzId?: string; invitationNumber?: string; quota?: number; allowGroup?: boolean;
  responseDeadline?: string | null; expectedUpdatedAt?: string;
}, actorUserId: string, requestId: string) {
  const invitation = await scopedInvitation(eventId, id);
  if (data.expectedUpdatedAt && new Date(data.expectedUpdatedAt).getTime() !== new Date(invitation.updatedAt).getTime()) {
    throw new ConflictError("Undangan telah diperbarui oleh petugas lain. Muat ulang sebelum mengedit kembali.");
  }
  if (invitation.status === "REVOKED") throw new ValidationError("Undangan yang dicabut tidak dapat diedit.");
  const event = await findEventByIdRepository(eventId);
  if (!event) throw new NotFoundError("Event tidak ditemukan.");
  if (["CANCELLED", "COMPLETED", "ARCHIVED"].includes(event.status)) throw new ValidationError("Pengaturan undangan event ini sudah dikunci.");
  if (invitation.invitationType === "INDIVIDUAL") {
    if (data.institutionId || data.allowGroup === true || data.quota != null && data.quota !== 1) {
      throw new ValidationError("Undangan individu hanya berlaku untuk satu asatidz.");
    }
    const registeredCount = await countInvitationParticipantsRepository(id);
    const recipientId = data.ustadzId || invitation.ustadzId;
    if (!recipientId) throw new ValidationError("Profil penerima undangan individu tidak ditemukan.");
    const recipientChanged = recipientId !== invitation.ustadzId;
    if (recipientChanged && (registeredCount > 0 || invitation.respondedAt || !isInvitationPending(invitation.status))) {
      throw new ConflictError("Penerima tidak dapat diganti setelah ada respons atau peserta.");
    }
    const recipient = recipientChanged ? await assertIndividualRecipient(eventId, recipientId, id)
      : await findInvitationUstadzRecipientRepository(recipientId);
    if (!recipient) throw new ValidationError("Profil penerima tidak ditemukan.");
    const number = data.invitationNumber || invitation.invitationNumber;
    const owner = await findInvitationByEventAndNumberRepository(eventId, number);
    if (owner && owner.id !== id) throw new ConflictError("Nomor undangan sudah digunakan pada event ini.");
    const changes: Parameters<typeof updateInvitationRepository>[1] = { invitationNumber: number, quota: 1,
      ustadzId: recipientId };
    if (data.responseDeadline !== undefined) {
      const deadline = data.responseDeadline ? new Date(data.responseDeadline) : event.invitationResponseDeadline;
      const previous = invitation.responseDeadline || event.invitationResponseDeadline;
      if (deadline && new Date(deadline) < new Date() && new Date(deadline).getTime() !== (previous ? new Date(previous).getTime() : null)) {
        throw new ValidationError("Batas respons baru harus berada di masa mendatang.");
      }
      changes.responseDeadline = deadline ? new Date(deadline) : null;
    }
    const token = recipientChanged ? generateSecureToken("inv_ind") : null;
    if (recipientChanged) { changes.status = "DRAFT"; changes.sentAt = null; }
    const deadline = changes.responseDeadline === undefined ? invitation.responseDeadline || event.invitationResponseDeadline : changes.responseDeadline;
    let updated;
    try {
      updated = await updateInvitationRepository(invitation, changes, token ? { tokenHash: token.tokenHash,
        expiresAt: deadline ? new Date(deadline) : new Date(Date.now() + 14 * 86400000) } : undefined);
    } catch (error) {
      const code = (error as { code?: string; cause?: { code?: string } }).code || (error as { cause?: { code?: string } }).cause?.code;
      if (code === "23505") throw new ConflictError("Nomor undangan baru saja digunakan. Gunakan nomor lain.");
      throw error;
    }
    await createAuditLog({ actorUserId, action: "INVITATION_UPDATED", resourceType: "INVITATION", resourceId: id,
      eventId, beforeData: invitation as any, afterData: updated as any, requestId });
    return { invitation: { ...updated, ustadzName: recipient.fullName, ustadzEmail: recipient.email,
      ustadzWhatsapp: recipient.whatsapp, ustadzPhone: recipient.phone, allowGroup: false },
      ...(token ? { publicUrl: `/invitation/individual/${token.rawToken}` } : {}) };
  }
  if (invitation.invitationType !== "INSTITUTION") throw new ValidationError("Jenis undangan tidak dikenal.");
  if (data.ustadzId) throw new ValidationError("Undangan lembaga tidak memakai penerima perorangan.");
  const registeredCount = await countInvitationParticipantsRepository(id);
  const institutionId = data.institutionId || invitation.institutionId;
  const recipientChanged = institutionId !== invitation.institutionId;
  if (recipientChanged && (registeredCount > 0 || invitation.respondedAt || !isInvitationPending(invitation.status))) {
    throw new ConflictError("Lembaga tidak dapat diganti setelah ada respons atau peserta. Kelola peserta tanpa mengubah riwayat lembaga.");
  }
  const institution = institutionId ? await findInstitutionByIdRepository(institutionId) : null;
  if (recipientChanged && (!institution || institution.status !== "ACTIVE" || institution.deletedAt)) {
    throw new ValidationError("Pilih lembaga aktif dari data master.");
  }
  const quota = resolveInvitationQuota(data, invitation.quota || 1);
  if (quota < registeredCount) throw new ConflictError(`Sudah ada ${registeredCount} peserta. Kuota tidak boleh dikurangi di bawah jumlah tersebut.`);
  const number = data.invitationNumber || invitation.invitationNumber;
  const owner = await findInvitationByEventAndNumberRepository(eventId, number);
  if (owner && owner.id !== id) throw new ConflictError("Nomor undangan sudah digunakan pada event ini.");
  const changes: Parameters<typeof updateInvitationRepository>[1] = { invitationNumber: number, quota, institutionId };
  if (data.responseDeadline !== undefined) {
    const deadline = data.responseDeadline ? new Date(data.responseDeadline) : event.invitationResponseDeadline;
    const previous = invitation.responseDeadline || event.invitationResponseDeadline;
    if (deadline && new Date(deadline) < new Date() && new Date(deadline).getTime() !== (previous ? new Date(previous).getTime() : null)) {
      throw new ValidationError("Batas respons baru harus berada di masa mendatang.");
    }
    changes.responseDeadline = deadline ? new Date(deadline) : null;
  }
  const token = recipientChanged ? generateSecureToken("inv_inst") : null;
  if (recipientChanged) { changes.status = "DRAFT"; changes.sentAt = null; }
  const deadline = changes.responseDeadline === undefined ? invitation.responseDeadline || event.invitationResponseDeadline : changes.responseDeadline;
  let updated;
  try {
    updated = await updateInvitationRepository(invitation, changes, token ? { tokenHash: token.tokenHash, expiresAt: deadline ? new Date(deadline) : new Date(Date.now() + 14 * 86400000) } : undefined);
  } catch (error) {
    const code = (error as { code?: string; cause?: { code?: string } }).code || (error as { cause?: { code?: string } }).cause?.code;
    if (code === "23505") throw new ConflictError("Nomor undangan baru saja digunakan. Gunakan nomor lain.");
    throw error;
  }
  await createAuditLog({ actorUserId, action: "INVITATION_UPDATED", resourceType: "INVITATION", resourceId: id,
    eventId, beforeData: invitation as any, afterData: updated as any, requestId });
  return { invitation: { ...updated, institutionName: institution?.name || null, allowGroup: invitationAllowsGroup(updated) },
    ...(token ? { publicUrl: buildInstitutionInvitationPath(institution?.name || "Lembaga", token.rawToken) } : {}) };
}

export async function sendInvitationService(eventId: string, id: string, actorUserId: string, requestId: string) {
  const inv = await scopedInvitation(eventId, id);
  if (!isInvitationPending(inv.status)) throw new ConflictError("Undangan sudah final atau dicabut; status terkirim tidak dapat diubah.");

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

export async function revokeInvitationService(eventId: string, id: string, actorUserId: string, requestId: string) {
  const inv = await scopedInvitation(eventId, id);
  if (!isInvitationPending(inv.status)) throw new ConflictError("Undangan sudah final atau dicabut. Kelola pembatalan peserta melalui daftar peserta.");

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
  eventId: string,
  id: string,
  actorUserId: string,
  requestId: string,
) {
  const invitation = await scopedInvitation(eventId, id);
  if (!isInvitationPending(invitation.status)) throw new ValidationError("Undangan sudah final atau dicabut. Tautan formulir tidak dapat dibuat ulang.");

  const tokenInfo = generateSecureToken(
    invitation.invitationType === "INDIVIDUAL" ? "inv_ind" : "inv_inst",
  );
  const event = await findEventByIdRepository(eventId);
  const deadline = invitation.responseDeadline || event?.invitationResponseDeadline;
  if (deadline && new Date(deadline) < new Date()) throw new ValidationError("Perpanjang batas respons melalui Edit undangan sebelum membuat tautan baru.");
  const expiresAt = deadline ? new Date(deadline) : new Date(Date.now() + 14 * 86400000);
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

  if (invitation.invitationType !== "INSTITUTION") throw new NotFoundError("Tautan undangan lembaga tidak ditemukan.");

  if (invitation.status === "REVOKED" || link.revokedAt) {
    throw new ForbiddenError("Tautan undangan ini telah dicabut oleh panitia.");
  }
  assertInvitationResponseOpen(result);

  await markInvitationOpenedRepository(invitation.id);

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
      quota: invitationParticipantLimit(invitation),
      allowGroup: invitationAllowsGroup(invitation),
      status: "OPENED",
      responseDeadline: invitation.responseDeadline || event.invitationResponseDeadline,
    },
    event: {
      name: event.name,
      slug: event.slug,
      subtitle: event.subtitle,
      startDate: event.startDate,
      endDate: event.endDate,
      venueName: event.venueName,
      venueAddress: event.venueAddress,
      publicContactWhatsapp: event.publicContactWhatsapp,
      attendanceConfirmationRequired: event.attendanceConfirmationRequired,
      posterUrl: event.posterUrl,
      posterAlt: event.posterAlt,
      posterFocalPoint: event.posterFocalPoint,
      timezone: event.timezone,
    },
    institution: institution
      ? {
          name: institution.name,
          code: institution.code,
          verificationRequired: false,
        }
      : null,
  };
}

export async function getPublicInvitationPolicyService(rawToken: string, type: "institution" | "individual") {
  const result = await findInvitationPolicyByTokenHashRepository(hashToken(rawToken));
  if (!result || result.invitation.invitationType !== type.toUpperCase()) throw new NotFoundError("Undangan tidak ditemukan.");
  assertInvitationResponseOpen(result);
  return { invitationNumber: result.invitation.invitationNumber, quota: invitationParticipantLimit(result.invitation),
    allowGroup: invitationAllowsGroup(result.invitation), status: result.invitation.status,
    responseDeadline: result.invitation.responseDeadline || result.event.invitationResponseDeadline,
    updatedAt: result.invitation.updatedAt };
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
  if (invitation.invitationType !== "INSTITUTION") throw new ValidationError("Jalur undangan tidak sesuai.");

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
  if (payload.isFinal && payload.responseStatus === "ACCEPTED") {
    const [total, invited] = await Promise.all([
      countApprovedParticipantsForEventRepository(event.id), countApprovedParticipantsBySourceRepository(event.id, false),
    ]);
    if (event.capacity != null && total + payload.delegates.length > event.capacity ||
      event.invitationQuota != null && invited + payload.delegates.length > event.invitationQuota) {
      throw new ConflictError("Sisa kuota undangan tidak cukup untuk semua anggota. Hubungi panitia.");
    }
  }

  const saved = await saveInstitutionDelegationRepository(invitation.id, payload, { eventId: event.id, tokenHash });
  const savedResponse = saved.response;
  const cards = saved.participants.map((person, index) => ({ participantId: person.id,
    ustadzName: payload.delegates[index].fullName, email: payload.delegates[index].email,
    whatsapp: payload.delegates[index].whatsapp || payload.delegates[index].phone || null,
    participantCode: person.participantCode, qrToken: signCardForParticipant(person),
  }));
  const portalAccounts = cards.map((person) => {
    const credential = saved.portalCredentials.find((item) => item.participantId === person.participantId);
    return { participantId: person.participantId, participantName: person.ustadzName,
      email: person.email, temporaryPassword: credential?.temporaryPassword || null,
      temporaryPasswordIssued: Boolean(credential?.temporaryPassword),
      passwordSetupRequired: credential?.passwordSetupRequired ?? true,
      loginUrl: "/login/ustadz", action: credential?.passwordSetupRequired ? "SETUP_REQUIRED" : "LOGIN_READY",
      shownOnce: Boolean(credential?.temporaryPassword) };
  });

  const [emailResult, auditResult] = await Promise.allSettled([
    queueRegistrationReceivedEmails({ id: event.id, name: event.name, slug: event.slug,
      endDate: event.endDate, attendanceConfirmationRequired: event.attendanceConfirmationRequired }, cards),
    payload.isFinal ? createAuditLog({
      actorUserId: null,
      action: "INVITATION_FINAL_RESPONSE_SUBMITTED",
      resourceType: "INVITATION_RESPONSE",
      resourceId: savedResponse.id,
      eventId: event.id,
      reason: `Konfirmasi final undangan ${invitation.invitationNumber} disubmit dengan status ${payload.responseStatus}.`,
      requestId,
    }) : Promise.resolve(),
  ]);
  if (emailResult.status === "rejected") logError(requestId, "Antrean pemberitahuan pendaftaran undangan lembaga gagal disimpan", emailResult.reason);
  if (auditResult.status === "rejected") logError(requestId, "Audit undangan lembaga gagal disimpan", auditResult.reason);
  const emailQueued = emailResult.status === "fulfilled" ? emailResult.value : 0;

  return {
    response: savedResponse,
    participants: saved.participants.map((person, index) => ({ ...person, whatsapp: cards[index].whatsapp, qrToken: cards[index].qrToken,
      cardUrl: cardPath(cards[index].qrToken), confirmationUrl: event.attendanceConfirmationRequired
        ? participantConfirmationPath(signConfirmationForParticipant(person, event.endDate)) : null })),
    portalAccounts,
    emailQueued,
    message: payload.isFinal
      ? "Konfirmasi undangan tersimpan. Data perwakilan menunggu persetujuan admin sebelum QR dapat dipakai untuk presensi."
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

  if (invitation.invitationType !== "INDIVIDUAL") throw new NotFoundError("Tautan undangan individu tidak ditemukan.");

  if (invitation.status === "REVOKED" || link.revokedAt) {
    throw new ForbiddenError("Tautan undangan individu ini telah dicabut oleh panitia.");
  }
  assertInvitationResponseOpen(result);
  const recipient = invitation.ustadzId ? await findInvitationUstadzRecipientRepository(invitation.ustadzId) : null;
  if (!recipient || recipient.profileStatus !== "ACTIVE" || recipient.deletedAt || recipient.mergedIntoId) {
    throw new ForbiddenError("Profil penerima undangan tidak aktif. Hubungi panitia.");
  }

  await markInvitationOpenedRepository(invitation.id);

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
      quota: 1,
      allowGroup: false,
      status: "OPENED",
      responseDeadline: invitation.responseDeadline || event.invitationResponseDeadline,
    },
    recipient: { fullName: recipient.fullName },
    event: {
      name: event.name,
      slug: event.slug,
      subtitle: event.subtitle,
      startDate: event.startDate,
      endDate: event.endDate,
      venueName: event.venueName,
      venueAddress: event.venueAddress,
      publicContactWhatsapp: event.publicContactWhatsapp,
      attendanceConfirmationRequired: event.attendanceConfirmationRequired,
      posterUrl: event.posterUrl,
      posterAlt: event.posterAlt,
      posterFocalPoint: event.posterFocalPoint,
      timezone: event.timezone,
    },
  };
}

export async function submitIndividualResponseService(rawToken: string, payload: {
  responseStatus: "ACCEPTED" | "DECLINED";
  delegates?: Array<{ fullName: string; email: string; phone?: string | null; whatsapp?: string | null; address?: string | null;
    city: string; province: string; cityCode?: string | null; provinceCode?: string | null; isLead?: boolean }>;
}, requestId: string) {
  const tokenHash = hashToken(rawToken);
  const result = await findInvitationByTokenHashRepository(tokenHash);

  if (!result) throw new NotFoundError("Tautan undangan tidak valid.");

  const { invitation, event } = result;
  assertInvitationResponseOpen(result);
  if (invitation.invitationType !== "INDIVIDUAL") throw new ValidationError("Jalur undangan tidak sesuai.");
  if (payload.responseStatus === "ACCEPTED") {
    const [total, invited] = await Promise.all([
      countApprovedParticipantsForEventRepository(event.id), countApprovedParticipantsBySourceRepository(event.id, false),
    ]);
    if (event.capacity != null && total >= event.capacity || event.invitationQuota != null && invited >= event.invitationQuota) {
      throw new ConflictError("Kuota undangan telah penuh. Hubungi panitia.");
    }
  }
  const saved = await saveInstitutionDelegationRepository(invitation.id, {
    ...payload, institutionName: null, isFinal: true,
    delegates: payload.responseStatus === "ACCEPTED" ? payload.delegates?.map((delegate) => ({ ...delegate, isLead: true })) : [],
  }, { eventId: event.id, tokenHash });
  const cards = saved.participants.map((person, index) => ({ participantId: person.id,
    ustadzName: payload.delegates?.[index]?.fullName || "Peserta", email: payload.delegates?.[index]?.email || "",
    whatsapp: payload.delegates?.[index]?.whatsapp || payload.delegates?.[index]?.phone || null,
    participantCode: person.participantCode, qrToken: signCardForParticipant(person),
  }));
  const portalAccounts = cards.map((person) => {
    const credential = saved.portalCredentials.find((item) => item.participantId === person.participantId);
    return { participantId: person.participantId, participantName: person.ustadzName,
      email: person.email, temporaryPassword: credential?.temporaryPassword || null,
      temporaryPasswordIssued: Boolean(credential?.temporaryPassword),
      passwordSetupRequired: credential?.passwordSetupRequired ?? true,
      loginUrl: "/login/ustadz", action: credential?.passwordSetupRequired ? "SETUP_REQUIRED" : "LOGIN_READY",
      shownOnce: Boolean(credential?.temporaryPassword) };
  });

  const [emailResult, auditResult] = await Promise.allSettled([queueRegistrationReceivedEmails({ id: event.id, name: event.name, slug: event.slug,
    endDate: event.endDate, attendanceConfirmationRequired: event.attendanceConfirmationRequired }, cards), createAuditLog({
    actorUserId: null,
    action: "INDIVIDUAL_INVITATION_RSVP_SUBMITTED",
    resourceType: "INVITATION_RESPONSE",
    resourceId: saved.response.id,
    eventId: event.id,
    reason: `RSVP undangan individu ${invitation.invitationNumber}: ${payload.responseStatus}`,
    requestId,
  })]);
  if (emailResult.status === "rejected") logError(requestId, "Antrean pemberitahuan pendaftaran undangan individu gagal disimpan", emailResult.reason);
  if (auditResult.status === "rejected") logError(requestId, "Audit undangan individu gagal disimpan", auditResult.reason);
  const emailQueued = emailResult.status === "fulfilled" ? emailResult.value : 0;

  return {
    response: saved.response,
    participants: saved.participants.map((person, index) => ({ ...person, whatsapp: cards[index].whatsapp, qrToken: cards[index].qrToken,
      cardUrl: cardPath(cards[index].qrToken), confirmationUrl: event.attendanceConfirmationRequired
        ? participantConfirmationPath(signConfirmationForParticipant(person, event.endDate)) : null })),
    portalAccounts,
    emailQueued,
    message: payload.responseStatus === "ACCEPTED"
      ? "Jawaban undangan tersimpan. Pendaftaran menunggu persetujuan admin sebelum QR dapat dipakai untuk presensi."
      : "Jawaban undangan ditolak berhasil disimpan.",
  };
}
