import {
  findUstadzProfilesRepository,
  findUstadzByIdRepository,
  createUstadzRepository,
  updateUstadzRepository,
  findDuplicateCandidatesRepository,
  addAffiliationRepository,
  updateAffiliationRepository,
  mergeUstadzProfilesTxRepository,
  UstadzQueryParams,
} from "../repositories/ustadzRepository";
import { normalizeName, normalizeEmail, normalizePhone } from "../utils/normalization";
import { NotFoundError, ConflictError } from "../utils/errors";
import { createAuditLog } from "./auditService";

export async function getUstadzProfilesService(params: UstadzQueryParams) {
  return await findUstadzProfilesRepository(params);
}

export async function getUstadzByIdService(id: string) {
  const profile = await findUstadzByIdRepository(id);
  if (!profile) {
    throw new NotFoundError(`Profil Ustadz dengan ID ${id} tidak ditemukan.`);
  }
  return profile;
}

export async function checkUstadzDuplicatesService(
  fullName: string,
  email?: string | null,
  phone?: string | null,
  excludeId?: string | null,
) {
  const candidates = await findDuplicateCandidatesRepository(fullName, email, phone);
  return excludeId ? candidates.filter((candidate) => candidate.id !== excludeId) : candidates;
}

export async function createUstadzService(data: any, actorUserId: string, requestId: string) {
  const normName = normalizeName(data.fullName);
  const normEmail = normalizeEmail(data.email);
  const normPhone = normalizePhone(data.phone);
  const normWhatsapp = normalizePhone(data.whatsapp || data.phone);

  const duplicates = await findDuplicateCandidatesRepository(data.fullName, data.email, data.phone);

  const {
    institutionId,
    positionAtInstitution,
    isPrimaryInstitution,
    ...profileFields
  } = data;
  const profileData = {
    ...profileFields,
    normalizedName: normName,
    email: normEmail,
    phone: normPhone,
    whatsapp: normWhatsapp,
    profileStatus: "ACTIVE",
  };

  const created = await createUstadzRepository(profileData);
  if (institutionId) {
    await addAffiliationRepository(
      created.id,
      institutionId,
      positionAtInstitution || null,
      isPrimaryInstitution !== false,
    );
  }

  await createAuditLog({
    actorUserId,
    action: "USTADZ_PROFILE_CREATED",
    resourceType: "USTADZ_PROFILE",
    resourceId: created.id,
    afterData: created as any,
    reason: duplicates.length > 0 ? `Profil dibuat dengan ${duplicates.length} calon duplikat terdeteksi.` : null,
    requestId,
  });

  return {
    profile: created,
    duplicateCandidates: duplicates,
  };
}

export async function updateUstadzService(id: string, data: any, actorUserId: string, requestId: string) {
  const existing = await getUstadzByIdService(id);

  const {
    institutionId: _institutionId,
    positionAtInstitution: _positionAtInstitution,
    isPrimaryInstitution: _isPrimaryInstitution,
    ...profileChanges
  } = data;
  const updateData: any = { ...profileChanges };
  if (profileChanges.fullName) {
    updateData.normalizedName = normalizeName(profileChanges.fullName);
  }
  if (profileChanges.email !== undefined) {
    updateData.email = normalizeEmail(profileChanges.email);
  }
  if (profileChanges.phone !== undefined) {
    updateData.phone = normalizePhone(profileChanges.phone);
  }
  if (profileChanges.whatsapp !== undefined) {
    updateData.whatsapp = normalizePhone(profileChanges.whatsapp);
  }

  const updated = await updateUstadzRepository(id, updateData);

  await createAuditLog({
    actorUserId,
    action: "USTADZ_PROFILE_UPDATED",
    resourceType: "USTADZ_PROFILE",
    resourceId: id,
    beforeData: existing as any,
    afterData: updated as any,
    requestId,
  });

  return updated;
}

export async function updateUstadzSelfProfileService(id: string, data: any, actorUserId: string, requestId: string) {
  // Stripping any attempt to edit read-only fields
  const allowedData = {
    phone: data.phone !== undefined ? normalizePhone(data.phone) : undefined,
    whatsapp: data.whatsapp !== undefined ? normalizePhone(data.whatsapp) : undefined,
    educationSummary: data.educationSummary !== undefined ? data.educationSummary : undefined,
    expertiseSummary: data.expertiseSummary !== undefined ? data.expertiseSummary : undefined,
    address: data.address !== undefined ? data.address : undefined,
  };

  const existing = await findUstadzByIdRepository(id);
  if (!existing) throw new NotFoundError(`Profil Ustadz ID ${id} tidak ditemukan.`);

  const updated = await updateUstadzRepository(id, allowedData);

  await createAuditLog({
    actorUserId,
    action: "USTADZ_SELF_PROFILE_UPDATED",
    resourceType: "USTADZ_PROFILE",
    resourceId: id,
    beforeData: existing as any,
    afterData: updated as any,
    requestId,
  });

  return updated;
}

export async function addUstadzAffiliationService(
  ustadzId: string,
  institutionId: string,
  position?: string | null,
  isPrimary = false,
  actorUserId?: string,
  requestId?: string
) {
  await getUstadzByIdService(ustadzId);
  const created = await addAffiliationRepository(ustadzId, institutionId, position, isPrimary);

  if (requestId) {
    await createAuditLog({
      actorUserId: actorUserId || null,
      action: "USTADZ_AFFILIATION_ADDED",
      resourceType: "USTADZ_INSTITUTION_AFFILIATION",
      resourceId: created.id,
      afterData: created as any,
      requestId,
    });
  }

  return created;
}

export async function updateUstadzAffiliationService(
  ustadzId: string,
  affiliationId: string,
  data: {
    position?: string | null;
    isPrimary?: boolean;
    startDate?: string | null;
    endDate?: string | null;
    status?: string;
  },
  actorUserId: string,
  requestId: string,
) {
  await getUstadzByIdService(ustadzId);
  const updated = await updateAffiliationRepository(ustadzId, affiliationId, data);
  if (!updated) throw new NotFoundError(`Afiliasi ID ${affiliationId} tidak ditemukan.`);

  await createAuditLog({
    actorUserId,
    action: data.status === "INACTIVE" ? "USTADZ_AFFILIATION_ENDED" : "USTADZ_AFFILIATION_UPDATED",
    resourceType: "USTADZ_INSTITUTION_AFFILIATION",
    resourceId: affiliationId,
    afterData: updated as any,
    requestId,
  });
  return updated;
}

export async function mergeUstadzProfilesService(
  sourceUstadzId: string,
  targetUstadzId: string,
  actorUserId: string,
  requestId: string,
  notes: string,
) {
  if (sourceUstadzId === targetUstadzId) {
    throw new ConflictError("Profil sumber dan profil target tidak boleh sama.");
  }

  const sourceProfile = await getUstadzByIdService(sourceUstadzId);
  const targetProfile = await getUstadzByIdService(targetUstadzId);

  if (sourceProfile.profileStatus === "MERGED") {
    throw new ConflictError(`Profil sumber ID ${sourceUstadzId} sudah dalam status MERGED.`);
  }

  const result = await mergeUstadzProfilesTxRepository(
    sourceUstadzId,
    targetUstadzId,
    actorUserId,
    requestId,
    notes,
  );

  return {
    mergedSource: result,
    targetProfile,
    message: `Profil ${sourceProfile.fullName} berhasil digabungkan ke ${targetProfile.fullName}.`,
  };
}
