import { findIndonesianRegency } from "../../../../src/lib/indonesiaRegionData";
import { ustadzProfiles } from "../db/schema";
import { findOwnPortalProfileRepository, updateOwnPortalProfileRepository } from "../repositories/portalProfileRepository";
import { ConflictError, NotFoundError, ValidationError } from "../utils/errors";
import { normalizeName, normalizePhone } from "../utils/normalization";
import { validateRequestData } from "../utils/validator";
import { updateUstadzSelfProfileSchema, type UstadzSelfProfilePatch } from "../validations/ustadzValidation";
import { createAuditLog } from "./auditService";

type Profile = typeof ustadzProfiles.$inferSelect;
const regionKeys = ["cityCode", "provinceCode", "city", "province"] as const;

export function portalProfileResponse(profile: Profile, loginEmail: string) {
  const region = profile.cityCode ? findIndonesianRegency(profile.cityCode) : undefined;
  return { ...profile, city: region?.city ?? null, province: region?.province ?? null, loginEmail };
}

export function preparePortalProfileChanges(existing: Profile, data: UstadzSelfProfilePatch) {
  const { cityCode: _cityCode, provinceCode: _provinceCode, city: _city, province: _province, ...fields } = data;
  const changes: Partial<typeof ustadzProfiles.$inferInsert> = { ...fields };
  if (fields.fullName !== undefined) changes.normalizedName = normalizeName(fields.fullName);
  if (fields.phone !== undefined) changes.phone = normalizePhone(fields.phone);
  if (fields.whatsapp !== undefined) changes.whatsapp = normalizePhone(fields.whatsapp);
  const touched = regionKeys.filter((key) => data[key] !== undefined);
  if (!touched.length) return changes;

  // Existing free-text/obsolete codes must not block changes to other fields.
  const current = portalProfileResponse(existing, "");
  if (touched.every((key) => (data[key] || null) === (current[key] || null))) return changes;
  if (data.cityCode === null && touched.every((key) => data[key] === null)) {
    changes.cityCode = null;
    changes.provinceCode = null;
    return changes;
  }
  const region = data.cityCode ? findIndonesianRegency(data.cityCode) : undefined;
  if (!region) throw new ValidationError("Pilih kabupaten/kota yang valid dari daftar wilayah.");
  if (data.provinceCode != null && data.provinceCode !== region.provinceId) {
    throw new ValidationError("Kode provinsi tidak sesuai dengan kabupaten/kota yang dipilih.");
  }
  changes.cityCode = region.id;
  changes.provinceCode = region.provinceId;
  return changes;
}

export async function updatePortalProfileService(userId: string, loginEmail: string, input: unknown, requestId: string) {
  // Validate here as well as at the API boundary; internal callers cannot bypass the allowlist.
  const data = validateRequestData(updateUstadzSelfProfileSchema, input);
  const existing = await findOwnPortalProfileRepository(userId);
  if (!existing) throw new NotFoundError("Profil asatidz belum terhubung dengan akun ini. Hubungi admin.");
  if (existing.deletedAt || existing.mergedIntoId || ["ARCHIVED", "MERGED"].includes(existing.profileStatus)) {
    throw new ConflictError("Profil diarsipkan/digabung. Hubungi admin sebelum mengubah data.");
  }
  const changes = preparePortalProfileChanges(existing, data);
  const updated = await updateOwnPortalProfileRepository(existing, userId, changes);
  if (!updated) throw new ConflictError("Profil atau kepemilikan berubah. Muat ulang profil lalu coba lagi.");
  await createAuditLog({ actorUserId: userId, action: "USTADZ_SELF_PROFILE_UPDATED", resourceType: "USTADZ_PROFILE",
    resourceId: updated.id, beforeData: existing, afterData: updated, requestId });
  return portalProfileResponse(updated, loginEmail);
}