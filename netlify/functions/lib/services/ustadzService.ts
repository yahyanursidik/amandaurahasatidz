import {
  findUstadzProfilesRepository,
  findUstadzByIdRepository,
  createUstadzRepository,
  updateUstadzRepository,
  findDuplicateCandidatesRepository,
  addAffiliationRepository,
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

export async function checkUstadzDuplicatesService(fullName: string, email?: string | null, phone?: string | null) {
  return await findDuplicateCandidatesRepository(fullName, email, phone);
}

export async function createUstadzService(data: any, actorUserId: string, requestId: string) {
  const normName = normalizeName(data.fullName);
  const normEmail = normalizeEmail(data.email);
  const normPhone = normalizePhone(data.phone);

  const duplicates = await findDuplicateCandidatesRepository(data.fullName, data.email, data.phone);

  const profileData = {
    ...data,
    normalizedName: normName,
    email: normEmail,
    phone: normPhone,
    profileStatus: "ACTIVE",
  };

  const created = await createUstadzRepository(profileData);

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

  const updateData: any = { ...data };
  if (data.fullName) {
    updateData.normalizedName = normalizeName(data.fullName);
  }
  if (data.email !== undefined) {
    updateData.email = normalizeEmail(data.email);
  }
  if (data.phone !== undefined) {
    updateData.phone = normalizePhone(data.phone);
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

export async function mergeUstadzProfilesService(
  sourceUstadzId: string,
  targetUstadzId: string,
  actorUserId: string,
  requestId: string
) {
  if (sourceUstadzId === targetUstadzId) {
    throw new ConflictError("Profil sumber dan profil target tidak boleh sama.");
  }

  const sourceProfile = await getUstadzByIdService(sourceUstadzId);
  const targetProfile = await getUstadzByIdService(targetUstadzId);

  if (sourceProfile.profileStatus === "MERGED") {
    throw new ConflictError(`Profil sumber ID ${sourceUstadzId} sudah dalam status MERGED.`);
  }

  const result = await mergeUstadzProfilesTxRepository(sourceUstadzId, targetUstadzId, actorUserId, requestId);

  return {
    mergedSource: result,
    targetProfile,
    message: `Profil ${sourceProfile.fullName} berhasil digabungkan ke ${targetProfile.fullName}.`,
  };
}
