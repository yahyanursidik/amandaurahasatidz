import {
  findInstitutionsRepository,
  findInstitutionByIdRepository,
  createInstitutionRepository,
  updateInstitutionRepository,
  checkInstitutionHasHistoryRepository,
  softDeleteInstitutionRepository,
  createRepresentativeRepository,
  findRepresentativeByIdRepository,
  clearPrimaryRepresentativeRepository,
  updateRepresentativeRepository,
  deleteRepresentativeRepository,
  InstitutionQueryParams,
} from "../repositories/institutionRepository";
import { NotFoundError, ConflictError, ValidationError } from "../utils/errors";
import { createAuditLog } from "./auditService";

export async function getInstitutionsService(params: InstitutionQueryParams) {
  return await findInstitutionsRepository(params);
}

export async function getInstitutionByIdService(id: string) {
  const inst = await findInstitutionByIdRepository(id);
  if (!inst) {
    throw new NotFoundError(`Lembaga dengan ID ${id} tidak ditemukan.`);
  }
  return inst;
}

export async function createInstitutionService(data: any, actorUserId: string, requestId: string) {
  const existing = await findInstitutionsRepository({ search: data.code, pageSize: 1 });
  if (existing.data.some((i) => i.code.toLowerCase() === data.code.toLowerCase())) {
    throw new ConflictError(`Kode lembaga '${data.code}' sudah digunakan.`);
  }

  const created = await createInstitutionRepository(data);

  await createAuditLog({
    actorUserId,
    action: "INSTITUTION_CREATED",
    resourceType: "INSTITUTION",
    resourceId: created.id,
    afterData: created as any,
    requestId,
  });

  return created;
}

export async function updateInstitutionService(id: string, data: any, actorUserId: string, requestId: string) {
  const existing = await getInstitutionByIdService(id);
  const updateData = data.status === "ACTIVE" ? { ...data, deletedAt: null } : data;
  const updated = await updateInstitutionRepository(id, updateData);

  if (!updated) {
    throw new NotFoundError(`Gagal memperbarui lembaga ID ${id}.`);
  }

  await createAuditLog({
    actorUserId,
    action: "INSTITUTION_UPDATED",
    resourceType: "INSTITUTION",
    resourceId: id,
    beforeData: existing as any,
    afterData: updated as any,
    requestId,
  });

  return updated;
}

export async function deleteInstitutionService(id: string, actorUserId: string, requestId: string) {
  const existing = await getInstitutionByIdService(id);
  const hasHistory = await checkInstitutionHasHistoryRepository(id);

  // Soft delete enforcement: Never hard delete if institution has history!
  const deleted = await softDeleteInstitutionRepository(id);

  await createAuditLog({
    actorUserId,
    action: "INSTITUTION_DEACTIVATED",
    resourceType: "INSTITUTION",
    resourceId: id,
    beforeData: existing as any,
    afterData: deleted as any,
    reason: hasHistory
      ? "Lembaga memiliki riwayat kegiatan, di-nonaktifkan via soft delete."
      : "Lembaga dinonaktifkan.",
    requestId,
  });

  return {
    deleted,
    hasHistory,
    message: hasHistory
      ? "Lembaga memiliki riwayat partisipasi/undangan, di-nonaktifkan secara aman (soft delete)."
      : "Lembaga berhasil dinonaktifkan.",
  };
}

export async function addRepresentativeService(institutionId: string, data: any, actorUserId: string, requestId: string) {
  await getInstitutionByIdService(institutionId);

  if (data.isPrimary) {
    await clearPrimaryRepresentativeRepository(institutionId);
  }

  const repData = {
    ...data,
    institutionId,
  };

  const created = await createRepresentativeRepository(repData);

  await createAuditLog({
    actorUserId,
    action: "REPRESENTATIVE_ADDED",
    resourceType: "INSTITUTION_REPRESENTATIVE",
    resourceId: created.id,
    afterData: created as any,
    requestId,
  });

  return created;
}

export async function updateRepresentativeService(
  institutionId: string,
  representativeId: string,
  data: any,
  actorUserId: string,
  requestId: string
) {
  await getInstitutionByIdService(institutionId);
  const existing = await findRepresentativeByIdRepository(representativeId);
  if (!existing || existing.institutionId !== institutionId) {
    throw new NotFoundError("Perwakilan lembaga tidak ditemukan.");
  }
  if (data.isPrimary) {
    await clearPrimaryRepresentativeRepository(institutionId);
  }
  const updated = await updateRepresentativeRepository(representativeId, data);
  await createAuditLog({
    actorUserId,
    action: "REPRESENTATIVE_UPDATED",
    resourceType: "INSTITUTION_REPRESENTATIVE",
    resourceId: representativeId,
    beforeData: existing as any,
    afterData: updated as any,
    requestId,
  });
  return updated;
}

export async function deleteRepresentativeService(
  institutionId: string,
  representativeId: string,
  actorUserId: string,
  requestId: string
) {
  await getInstitutionByIdService(institutionId);
  const existing = await findRepresentativeByIdRepository(representativeId);
  if (!existing || existing.institutionId !== institutionId) {
    throw new NotFoundError("Perwakilan lembaga tidak ditemukan.");
  }
  const deleted = await deleteRepresentativeRepository(representativeId);
  await createAuditLog({
    actorUserId,
    action: "REPRESENTATIVE_REMOVED",
    resourceType: "INSTITUTION_REPRESENTATIVE",
    resourceId: representativeId,
    beforeData: existing as any,
    afterData: deleted as any,
    requestId,
  });
  return deleted;
}
