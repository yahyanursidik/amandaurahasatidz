import { getDbClient } from "../db/client";
import { withTransaction } from "../db/transaction";
import { eventParticipants, events, institutions, ustadzProfiles, ustadzInstitutionAffiliations, participantStatusHistories } from "../db/schema";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { AppError, ValidationError, ForbiddenError, NotFoundError, ConflictError } from "../utils/errors";
import { createAuditLog } from "./auditService";
import { normalizeEmail, normalizeName, normalizePhone } from "../utils/normalization";

export interface ImportRowItem {
  code?: string;
  name: string;
  email: string;
  phone?: string;
  provinceCode?: string;
  cityCode?: string;
  address?: string;
}

export interface DryRunResult {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  errorReport: { line: number; field: string; error: string }[];
  duplicateReport: { line: number; key: string; reason: string }[];
  previewData: ImportRowItem[];
}

export interface ParticipantImportRowItem {
  fullName?: string;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  institutionCode?: string | null;
  institutionName?: string | null;
  participantCode?: string | null;
  isDelegationLead?: boolean;
  approvalStatus?: string;
  notes?: string | null;
}

export interface ParticipantImportDryRunResult {
  totalRows: number;
  validCount: number;
  alreadyImportedCount: number;
  invalidCount: number;
  duplicateCount: number;
  missingInstitutionCount: number;
  errorReport: { line: number; field: string; error: string }[];
  duplicateReport: { line: number; key: string; reason: string }[];
  previewData: Array<
    ParticipantImportRowItem & {
      line: number;
      normalizedEmail: string | null;
      normalizedPhone: string | null;
      normalizedWhatsapp: string | null;
      normalizedName: string;
      resolvedInstitutionId: string | null;
      resolvedInstitutionName: string | null;
      finalParticipantCode: string;
      matchedUstadzId: string | null;
      previousApprovedEvents: number;
      existingParticipantId: string | null;
      action: "CREATE" | "UPDATE";
    }
  >;
}

function participantIdentityKeys(row: ParticipantImportRowItem) {
  const email = normalizeEmail(row.email || "");
  const phone = normalizePhone(row.phone || "");
  const whatsapp = normalizePhone(row.whatsapp || "");
  return [...new Set([
    ...(email ? [`email:${email}`] : []),
    ...(phone ? [`phone:${phone}`] : []),
    ...(whatsapp ? [`phone:${whatsapp}`] : []),
  ])];
}

type ExistingImportedParticipant = {
  participantCode: string;
  registrationSource: string;
  normalizedName: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  institutionCode: string | null;
  institutionName: string | null;
};

export function isPreviouslyImportedParticipant(row: ParticipantImportRowItem, existing: ExistingImportedParticipant) {
  if (existing.registrationSource !== "DIRECT_ADMIN_UPLOAD") return false;
  if (normalizeName(row.fullName || "") !== existing.normalizedName) return false;
  if (row.participantCode?.trim() && row.participantCode.trim().toLowerCase() !== existing.participantCode.toLowerCase()) return false;
  const suppliedContacts = [
    [normalizeEmail(row.email), normalizeEmail(existing.email)],
    [normalizePhone(row.phone), normalizePhone(existing.phone)],
    [normalizePhone(row.whatsapp), normalizePhone(existing.whatsapp)],
  ];
  if (!suppliedContacts.some(([value, stored]) => value && value === stored)) return false;
  if (suppliedContacts.some(([value, stored]) => value && value !== stored)) return false;
  const code = row.institutionCode?.trim().toLowerCase();
  const name = row.institutionName?.trim().toLowerCase();
  if (!code && !name) return !existing.institutionCode;
  return Boolean(existing.institutionCode &&
    (!code || code === existing.institutionCode.toLowerCase()) &&
    (!name || name === existing.institutionName?.toLowerCase()));
}

export function countPreviouslyApprovedEvents(
  history: Array<{ ustadzId: string; eventId: string }>, ustadzId: string, currentEventId: string,
) {
  return new Set(history.filter((item) => item.ustadzId === ustadzId && item.eventId !== currentEventId)
    .map((item) => item.eventId)).size;
}

export function resolveMatchingProfile<T extends { id: string; normalizedName: string; email: string | null; phone: string | null; whatsapp: string | null }>(
  candidates: T[], row: ParticipantImportRowItem,
): { profile: T | null; ambiguous: boolean } {
  const name = normalizeName(row.fullName || "");
  const email = normalizeEmail(row.email);
  const contactKeys = participantIdentityKeys(row);
  const emailed = email ? candidates.filter((profile) => normalizeEmail(profile.email) === email) : [];
  // An exact email can distinguish a person even when a phone belongs to several people.
  if (emailed.length === 1 && emailed[0].normalizedName === name) return { profile: emailed[0], ambiguous: false };
  if (emailed.length > 0) return { profile: null, ambiguous: true };
  const byNameAndContact = candidates.filter((profile) => profile.normalizedName === name &&
    participantIdentityKeys(profile).some((key) => contactKeys.includes(key)));
  return { profile: byNameAndContact.length === 1 ? byNameAndContact[0] : null,
    ambiguous: byNameAndContact.length > 1 || (candidates.length > 0 && byNameAndContact.length === 0) };
}

// Historical phone values may contain spaces/dashes or start with 0 rather than 62.
const normalizedDbPhone = (column: typeof ustadzProfiles.phone | typeof ustadzProfiles.whatsapp) =>
  sql<string>`case when regexp_replace(coalesce(${column}, ''), '[^0-9]', '', 'g') like '0%'
    then '62' || substring(regexp_replace(${column}, '[^0-9]', '', 'g') from 2)
    else regexp_replace(coalesce(${column}, ''), '[^0-9]', '', 'g') end`;

function buildParticipantCode(eventId: string, rowIndex: number, usedCodes: Set<string>, providedCode?: string | null) {
  const cleanProvided = providedCode?.trim();
  if (cleanProvided) return cleanProvided;
  let sequence = rowIndex;
  let code = "";
  do {
    code = `P-${String(sequence).padStart(4, "0")}`;
    sequence += 1;
  } while (usedCodes.has(code.toLowerCase()));
  return code;
}

function normalizeParticipantApprovalStatus(status?: string | null): "PENDING_REVIEW" | "APPROVED" | "WAITLISTED" {
  const normalized = status?.trim().toUpperCase();
  if (normalized === "APPROVED" || normalized === "WAITLISTED") return normalized;
  return "PENDING_REVIEW";
}

export async function processEventParticipantImportDryRunService(
  eventId: string,
  rows: ParticipantImportRowItem[],
): Promise<ParticipantImportDryRunResult> {
  if (!rows || rows.length === 0) {
    throw new ValidationError("Data peserta kosong. Harap unggah CSV yang berisi data peserta.");
  }

  const db = getDbClient();
  const eventFound = await db.select({ id: events.id }).from(events).where(eq(events.id, eventId)).limit(1);
  if (!eventFound[0]) throw new NotFoundError("Event tidak ditemukan.");
  const existingParticipants = await db
    .select({
      ustadzId: eventParticipants.ustadzId,
      id: eventParticipants.id,
      approvalStatus: eventParticipants.approvalStatus,
      confirmationStatus: eventParticipants.confirmationStatus,
      participantCode: eventParticipants.participantCode,
      registrationSource: eventParticipants.registrationSource,
      normalizedName: ustadzProfiles.normalizedName,
      fullName: ustadzProfiles.fullName,
      email: ustadzProfiles.email,
      phone: ustadzProfiles.phone,
      whatsapp: ustadzProfiles.whatsapp,
      institutionCode: institutions.code,
      institutionName: institutions.name,
    })
    .from(eventParticipants)
    .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
    .leftJoin(institutions, eq(eventParticipants.institutionId, institutions.id))
    .where(eq(eventParticipants.eventId, eventId));
  const institutionRows = await db
    .select({ id: institutions.id, code: institutions.code, name: institutions.name })
    .from(institutions);
  const contactEmails = rows.map((row) => normalizeEmail(row.email || "")).filter((value): value is string => Boolean(value));
  const contactPhones = rows.flatMap((row) => [normalizePhone(row.phone || ""), normalizePhone(row.whatsapp || "")]).filter((value): value is string => Boolean(value));
  const matchingProfiles = contactEmails.length || contactPhones.length
    ? await db
        .select({ id: ustadzProfiles.id, normalizedName: ustadzProfiles.normalizedName, email: ustadzProfiles.email, phone: ustadzProfiles.phone, whatsapp: ustadzProfiles.whatsapp })
        .from(ustadzProfiles)
        .where(or(
          ...(contactEmails.length ? [inArray(sql<string>`lower(${ustadzProfiles.email})`, contactEmails)] : []),
          ...(contactPhones.length ? [inArray(normalizedDbPhone(ustadzProfiles.phone), contactPhones), inArray(normalizedDbPhone(ustadzProfiles.whatsapp), contactPhones)] : []),
        ))
    : [];
  const previousApprovals = matchingProfiles.length
    ? await db.select({ ustadzId: eventParticipants.ustadzId, eventId: eventParticipants.eventId })
        .from(eventParticipants).where(and(inArray(eventParticipants.ustadzId, matchingProfiles.map((profile) => profile.id)),
          eq(eventParticipants.approvalStatus, "APPROVED")))
    : [];

  const errorReport: ParticipantImportDryRunResult["errorReport"] = [];
  const duplicateReport: ParticipantImportDryRunResult["duplicateReport"] = [];
  const seenIdentity = new Map<string, string>();
  const seenCodes = new Set<string>();
  const existingCodes = new Set(existingParticipants.map((item) => item.participantCode.toLowerCase()));
  const usedCodes = new Set(existingCodes);
  const existingIdentities = new Set(
    existingParticipants.flatMap((item) => {
      return participantIdentityKeys(item);
    }),
  );
  const validRows: ParticipantImportDryRunResult["previewData"] = [];
  let alreadyImportedCount = 0;

  rows.forEach((row, index) => {
    const line = index + 2;
    const normalizedName = normalizeName(row.fullName || "");
    const normalizedEmail = normalizeEmail(row.email || "");
    const normalizedPhone = normalizePhone(row.phone || "");
    const normalizedWhatsapp = normalizePhone(row.whatsapp || row.phone || "");
    const identityKeys = participantIdentityKeys(row);
    const candidateProfiles = matchingProfiles.filter((profile) =>
      participantIdentityKeys(profile).some((key) => identityKeys.includes(key)));
    const match = resolveMatchingProfile(candidateProfiles, row);
    const existingInEvent = match.profile ? existingParticipants.find((item) => item.ustadzId === match.profile?.id) : null;
    const finalParticipantCode = existingInEvent?.participantCode || buildParticipantCode(eventId, index + 1, usedCodes, row.participantCode);
    let hasError = false;

    if (normalizedName.length < 2) {
      errorReport.push({ line, field: "fullName", error: "Nama peserta wajib diisi." });
      hasError = true;
    }
    if (!normalizedEmail && !normalizedPhone && !normalizedWhatsapp) {
      errorReport.push({ line, field: "contact", error: "Isi minimal email, telepon, atau WhatsApp." });
      hasError = true;
    }
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) {
      errorReport.push({ line, field: "email", error: "Email peserta tidak valid." });
      hasError = true;
    }
    if ([normalizedPhone, normalizedWhatsapp].some((number) => number && (number.length < 9 || number.length > 16))) {
      errorReport.push({ line, field: "phone", error: "Nomor telepon/WhatsApp harus 9–16 digit." });
      hasError = true;
    }
    if (row.participantCode && !/^[A-Za-z0-9][A-Za-z0-9_-]{2,39}$/.test(row.participantCode.trim())) {
      errorReport.push({ line, field: "participantCode", error: "Kode peserta harus 3–40 karakter huruf, angka, - atau _." });
      hasError = true;
    }
    if (
      row.approvalStatus &&
      !["PENDING_REVIEW", "APPROVED", "WAITLISTED", ""].includes(row.approvalStatus.trim().toUpperCase())
    ) {
      errorReport.push({ line, field: "approvalStatus", error: "Status persetujuan harus PENDING_REVIEW, APPROVED, atau WAITLISTED." });
      hasError = true;
    }

    const codeKey = finalParticipantCode.toLowerCase();
    if (seenCodes.has(codeKey)) {
      duplicateReport.push({ line, key: finalParticipantCode, reason: "Kode peserta duplikat di file upload." });
      hasError = true;
    } else if (existingCodes.has(codeKey) && !existingInEvent) {
      duplicateReport.push({ line, key: finalParticipantCode, reason: "Kode peserta sudah digunakan pada event ini." });
      hasError = true;
    }
    seenCodes.add(codeKey);
    usedCodes.add(codeKey);

    for (const identityKey of identityKeys) {
      if (seenIdentity.has(identityKey) && (identityKey.startsWith("email:") || seenIdentity.get(identityKey) === normalizedName)) {
        duplicateReport.push({ line, key: identityKey, reason: "Kontak peserta duplikat di file upload." });
        hasError = true;
      } else if (existingIdentities.has(identityKey) && !existingInEvent && !match.profile) {
        duplicateReport.push({ line, key: identityKey, reason: "Peserta dengan kontak ini sudah terdaftar pada event." });
        hasError = true;
      }
      seenIdentity.set(identityKey, normalizedName);
    }
    if (match.ambiguous) {
      errorReport.push({ line, field: "contact", error: "Kontak sudah terkait profil asatidz lain atau lebih dari satu profil. Periksa data induk sebelum impor." });
      hasError = true;
    }
    if (match.profile && normalizedEmail && match.profile.email && normalizeEmail(match.profile.email) !== normalizedEmail) {
      errorReport.push({ line, field: "email", error: "Nama dan nomor cocok tetapi email profil lama berbeda. Tinjau profil sebelum mengubah email." });
      hasError = true;
    }
    if (existingInEvent && row.participantCode?.trim() && row.participantCode.trim().toLowerCase() !== existingInEvent.participantCode.toLowerCase()) {
      errorReport.push({ line, field: "participantCode", error: `Peserta sudah punya kode ${existingInEvent.participantCode}. Kosongkan kode CSV atau gunakan kode lama agar riwayat kehadiran tetap terhubung.` });
      hasError = true;
    }
    if (existingInEvent && ["CANCELLED", "REPLACED"].includes(existingInEvent.confirmationStatus)) {
      errorReport.push({ line, field: "confirmationStatus", error: "Pendaftaran sebelumnya telah dibatalkan/diganti. Hubungi panitia untuk peninjauan sebelum mengaktifkannya kembali." });
      hasError = true;
    }

    const institutionCode = row.institutionCode?.trim().toLowerCase();
    const institutionName = row.institutionName?.trim().toLowerCase();
    const byCode = institutionCode ? institutionRows.find((institution) => institution.code.toLowerCase() === institutionCode) : null;
    const byName = institutionName ? institutionRows.find((institution) => institution.name.toLowerCase() === institutionName) : null;
    const resolvedInstitution = byCode || byName;
    if (institutionCode && institutionName && byCode?.id !== byName?.id) {
      errorReport.push({ line, field: "institution", error: "Kode dan nama lembaga tidak menunjuk lembaga yang sama." });
      hasError = true;
    }
    if (row.isDelegationLead && !resolvedInstitution) {
      errorReport.push({ line, field: "isDelegationLead", error: "Kepala rombongan harus memiliki lembaga yang valid." });
      hasError = true;
    }
    if ((institutionCode || institutionName) && !resolvedInstitution) {
      errorReport.push({
        line,
        field: "institution",
        error: "Lembaga tidak ditemukan. Gunakan kode lembaga yang sudah ada atau kosongkan untuk peserta individu.",
      });
      hasError = true;
    }

    if (!hasError && existingInEvent && existingInEvent.approvalStatus === normalizeParticipantApprovalStatus(row.approvalStatus) && existingInEvent.confirmationStatus === "CONFIRMED") {
      alreadyImportedCount += 1;
    } else if (!hasError) {
      validRows.push({
        ...row,
        line,
        normalizedEmail,
        normalizedPhone,
        normalizedWhatsapp,
        normalizedName,
        resolvedInstitutionId: resolvedInstitution?.id || null,
        resolvedInstitutionName: resolvedInstitution?.name || null,
        finalParticipantCode,
        matchedUstadzId: match.profile?.id || null,
        existingParticipantId: existingInEvent?.id || null,
        action: existingInEvent ? "UPDATE" : "CREATE",
        previousApprovedEvents: match.profile
          ? countPreviouslyApprovedEvents(previousApprovals, match.profile.id, eventId) : 0,
        approvalStatus: normalizeParticipantApprovalStatus(row.approvalStatus),
      });
    }
  });

  return {
    totalRows: rows.length,
    validCount: validRows.length,
    alreadyImportedCount,
    invalidCount: new Set(errorReport.map((item) => item.line)).size,
    duplicateCount: new Set(duplicateReport.map((item) => item.line)).size,
    missingInstitutionCount: new Set(errorReport.filter((item) => item.field === "institution").map((item) => item.line)).size,
    errorReport,
    duplicateReport,
    previewData: validRows,
  };
}

export async function commitEventParticipantImportService(
  eventId: string,
  input: { rows: ParticipantImportRowItem[]; approved: boolean },
  actorUserId?: string,
  requestId = "req-participant-import",
) {
  if (input.approved !== true) {
    throw new ForbiddenError("Impor peserta ditolak karena belum ada persetujuan eksplisit dari admin.");
  }

  const dryRun = await processEventParticipantImportDryRunService(eventId, input.rows);
  if (dryRun.invalidCount > 0 || dryRun.duplicateCount > 0) {
    throw new ValidationError("Masih ada baris invalid atau duplikat. Perbaiki file lalu preview ulang.", {
      errorReport: dryRun.errorReport,
      duplicateReport: dryRun.duplicateReport,
    });
  }

  const rowsToImport = dryRun.previewData;
  const participantCodes: string[] = [];
  let reusedProfileCount = 0;
  let updatedCount = 0;
  const failureReport: { line: number; participantCode: string; error: string }[] = [];

  for (const row of rowsToImport) {
    try {
      const participantCode = await withTransaction(async (tx) => {
      const phones = [...new Set([row.normalizedPhone, row.normalizedWhatsapp].filter((value): value is string => Boolean(value)))];
       const profiles = await tx
         .select()
         .from(ustadzProfiles)
         .where(row.matchedUstadzId ? eq(ustadzProfiles.id, row.matchedUstadzId) : or(
           ...(row.normalizedEmail ? [eq(sql<string>`lower(${ustadzProfiles.email})`, row.normalizedEmail)] : []),
           ...(phones.length ? [inArray(normalizedDbPhone(ustadzProfiles.phone), phones), inArray(normalizedDbPhone(ustadzProfiles.whatsapp), phones)] : []),
         ))
         .limit(2);
       if (row.matchedUstadzId && !profiles[0] || profiles.length > 1 || (profiles[0] &&
          (profiles[0].normalizedName !== row.normalizedName || !participantIdentityKeys(profiles[0]).some((key) => participantIdentityKeys(row).includes(key))))) {
        throw new ConflictError(`Kontak pada baris ${row.line} sudah terkait profil asatidz lain. Periksa data induk lalu preview ulang.`);
      }
      let profile = profiles[0];

      if (!profile) {
        profile = (
          await tx
            .insert(ustadzProfiles)
            .values({
              fullName: (row.fullName || "").trim(),
              normalizedName: row.normalizedName,
              email: row.normalizedEmail,
              phone: row.normalizedPhone,
              whatsapp: row.normalizedWhatsapp,
              address: row.address?.trim() || null,
              profileStatus: "ACTIVE",
            })
            .returning()
        )[0];
      } else if (
        (row.normalizedEmail && !profile.email) ||
        (row.normalizedPhone && !profile.phone) ||
        (row.normalizedWhatsapp && !profile.whatsapp) ||
        (row.address?.trim() && !profile.address)
      ) {
        profile = (
          await tx
            .update(ustadzProfiles)
            .set({
              email: profile.email || row.normalizedEmail,
              phone: profile.phone || row.normalizedPhone,
              whatsapp: profile.whatsapp || row.normalizedWhatsapp,
              address: profile.address || row.address?.trim(),
              updatedAt: new Date(),
            })
            .where(eq(ustadzProfiles.id, profile.id))
            .returning()
        )[0];
      }

      if (row.resolvedInstitutionId) {
        const affiliation = await tx
          .select({ id: ustadzInstitutionAffiliations.id })
          .from(ustadzInstitutionAffiliations)
          .where(
            and(
              eq(ustadzInstitutionAffiliations.ustadzId, profile.id),
              eq(ustadzInstitutionAffiliations.institutionId, row.resolvedInstitutionId),
            ),
          )
          .limit(1);
        if (!affiliation[0]) {
          await tx.insert(ustadzInstitutionAffiliations).values({
            ustadzId: profile.id,
            institutionId: row.resolvedInstitutionId,
            isPrimary: false,
            status: "ACTIVE",
          });
        }
      }

       const existingParticipant = row.existingParticipantId
         ? (await tx.select().from(eventParticipants)
             .where(and(eq(eventParticipants.id, row.existingParticipantId), eq(eventParticipants.eventId, eventId), eq(eventParticipants.ustadzId, profile.id)))
             .limit(1))[0]
         : null;
       if (row.existingParticipantId && !existingParticipant) throw new ConflictError("Pendaftaran sebelumnya berubah. Preview ulang CSV agar riwayat presensi tidak terputus.");
       if (existingParticipant && ["CANCELLED", "REPLACED"].includes(existingParticipant.confirmationStatus)) {
         throw new ConflictError("Pendaftaran sudah dibatalkan/diganti. Panitia harus meninjau perubahan secara manual.");
       }
       const nextApproval = normalizeParticipantApprovalStatus(row.approvalStatus);
       const created = existingParticipant ? (
         await tx.update(eventParticipants).set({
           approvalStatus: nextApproval,
           confirmationStatus: "CONFIRMED",
           confirmedAt: existingParticipant.confirmedAt || new Date(),
           approvedAt: nextApproval === "APPROVED" ? existingParticipant.approvedAt || new Date() : existingParticipant.approvedAt,
           approvedBy: nextApproval === "APPROVED" ? actorUserId || existingParticipant.approvedBy : existingParticipant.approvedBy,
           notes: row.notes?.trim() || existingParticipant.notes,
           updatedAt: new Date(),
         }).where(eq(eventParticipants.id, existingParticipant.id)).returning({ participantCode: eventParticipants.participantCode })
       )[0] : (
         await tx.insert(eventParticipants).values({
             eventId,
            ustadzId: profile.id,
            institutionId: row.resolvedInstitutionId,
            registrationSource: "DIRECT_ADMIN_UPLOAD",
            participantCode: row.finalParticipantCode,
            isDelegationLead: Boolean(row.isDelegationLead),
            confirmationStatus: "CONFIRMED",
             approvalStatus: nextApproval,
            confirmedAt: new Date(),
            approvedAt: normalizeParticipantApprovalStatus(row.approvalStatus) === "APPROVED" ? new Date() : null,
            approvedBy: normalizeParticipantApprovalStatus(row.approvalStatus) === "APPROVED" ? actorUserId || null : null,
            notes: row.notes?.trim() || "Import peserta via dashboard admin event.",
           }).returning({ participantCode: eventParticipants.participantCode })
       )[0];
       if (existingParticipant && existingParticipant.approvalStatus !== nextApproval) {
         await tx.insert(participantStatusHistories).values({ participantId: existingParticipant.id,
           statusType: "APPROVAL_STATUS", fromStatus: existingParticipant.approvalStatus, toStatus: nextApproval,
           reason: row.notes?.trim() || "Status disesuaikan melalui impor peserta event.", changedBy: actorUserId || null });
       }
       if (existingParticipant && existingParticipant.confirmationStatus !== "CONFIRMED") {
         await tx.insert(participantStatusHistories).values({ participantId: existingParticipant.id,
           statusType: "CONFIRMATION_STATUS", fromStatus: existingParticipant.confirmationStatus, toStatus: "CONFIRMED",
           reason: "Kehadiran dikonfirmasi melalui impor peserta event; presensi sesi tetap dicatat saat check-in.",
           changedBy: actorUserId || null });
       }

        return created.participantCode;
      });
      participantCodes.push(participantCode);
      if (row.matchedUstadzId) reusedProfileCount += 1;
      if (row.existingParticipantId) updatedCount += 1;
    } catch (error) {
      failureReport.push({
        line: row.line,
        participantCode: row.finalParticipantCode,
        error: error instanceof ConflictError || error instanceof ValidationError
          ? error.message
          : "Baris gagal disimpan. Periksa data peserta dan coba lagi.",
      });
    }
  }

  const importedCount = participantCodes.length;

  await createAuditLog({
    actorUserId: actorUserId || null,
    action: "EVENT_PARTICIPANTS_IMPORTED",
    resourceType: "EVENT_PARTICIPANT",
    resourceId: `event_${eventId}_participant_import`,
    eventId,
    afterData: { importedCount, updatedCount, skippedCount: dryRun.alreadyImportedCount, failedCount: failureReport.length, reusedProfileCount, participantCodes },
    reason: `Impor peserta event: ${importedCount} berhasil, ${dryRun.alreadyImportedCount} sudah ada, ${failureReport.length} gagal.`,
    requestId,
  });

  return {
    status: failureReport.length ? "PARTIAL" : "SUCCESS",
    message: failureReport.length
      ? `${importedCount} peserta berhasil, ${failureReport.length} gagal. Unggah ulang file yang sama untuk mencoba baris gagal; data yang sudah berhasil akan dilewati.`
      : `${importedCount} peserta berhasil diimpor${dryRun.alreadyImportedCount ? `, ${dryRun.alreadyImportedCount} sudah pernah diimpor` : ""}.`,
    importedCount,
    skippedCount: dryRun.alreadyImportedCount,
    failedCount: failureReport.length,
    failureReport,
    participantCodes,
    reusedProfileCount,
    updatedCount,
  };
}

export async function processSpreadsheetImportDryRunService(
  rows: ImportRowItem[]
): Promise<DryRunResult> {
  if (!rows || rows.length === 0 || rows.length > 500) {
    throw new ValidationError("Impor lembaga harus berisi 1–500 baris.");
  }

  const errorReport: { line: number; field: string; error: string }[] = [];
  const duplicateReport: { line: number; key: string; reason: string }[] = [];
  const validRows: ImportRowItem[] = [];

  let existingEmails = new Set<string>();
  let existingPhones = new Set<string>();
  let existingCodes = new Set<string>();

  if (process.env.DATABASE_URL) {
    const db = getDbClient();
    const existingInsts = await db.select({ code: institutions.code, email: institutions.email, phone: institutions.phone }).from(institutions);
    existingEmails = new Set(existingInsts.map((i) => normalizeEmail(i.email)).filter((e): e is string => Boolean(e)));
    existingPhones = new Set(existingInsts.map((i) => normalizePhone(i.phone)).filter((p): p is string => Boolean(p)));
    existingCodes = new Set(existingInsts.map((i) => i.code.toLowerCase()));
  } else if (process.env.CONTEXT === "production" || process.env.APP_ENV === "production") {
    throw new AppError("Database belum dikonfigurasi. Preview impor tidak dapat memeriksa duplikat.", 503, "DATABASE_UNAVAILABLE");
  }

  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();
  const seenCodes = new Set<string>();
  rows.forEach((row, index) => {
    const lineNumber = index + 2; // Header at line 1
    const email = normalizeEmail(row.email);
    const phone = normalizePhone(row.phone);
    const code = row.code?.trim().toLowerCase();
    let invalid = false;

    // 1. Validation
    if (!row.name || row.name.trim().length < 2) {
      errorReport.push({ line: lineNumber, field: "name", error: "Nama lembaga/peserta wajib diisi (minimal 2 karakter)." });
      invalid = true;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errorReport.push({ line: lineNumber, field: "email", error: "Format email tidak valid." });
      invalid = true;
    }

    for (const [key, value, seen, existing] of [
      ["email", email, seenEmails, existingEmails],
      ["phone", phone, seenPhones, existingPhones],
      ["code", code, seenCodes, existingCodes],
    ] as const) {
      if (!value) continue;
      if (seen.has(value) || existing.has(value)) {
        duplicateReport.push({ line: lineNumber, key: value, reason: `${key} sudah digunakan pada file atau database.` });
        invalid = true;
      }
      seen.add(value);
    }
    if (!invalid) validRows.push({ ...row, email: email!, phone: phone || undefined, code: row.code?.trim() });
  });

  return {
    totalRows: rows.length,
    validCount: validRows.length,
    invalidCount: errorReport.length,
    duplicateCount: duplicateReport.length,
    errorReport,
    duplicateReport,
    previewData: validRows,
  };
}

export async function commitSpreadsheetImportService(
  input: {
    rows: ImportRowItem[];
    approved: boolean;
    targetType: "INSTITUTIONS" | "USTADZ";
  },
  actorUserId?: string,
  requestId = "req-import-commit"
) {
  // 1. Mandatory Approval Guard (Compliance Point 7)
  if (input.approved !== true) {
    throw new ForbiddenError(
      "Ditolak: Impor otomatis ke database dilarang tanpa konfirmasi preview dan persetujuan eksplisit (approved: true)."
    );
  }
  if (input.targetType !== "INSTITUTIONS") {
    throw new ValidationError("Impor umum saat ini hanya mendukung data lembaga. Gunakan fitur peserta pada workspace event.");
  }

  // 2. Run Dry-Run check first
  const dryRun = await processSpreadsheetImportDryRunService(input.rows);
  if (dryRun.validCount === 0 || dryRun.invalidCount > 0 || dryRun.duplicateCount > 0) {
    throw new ValidationError("Masih ada baris invalid atau duplikat. Perbaiki file lalu preview ulang.", {
      errorReport: dryRun.errorReport,
      duplicateReport: dryRun.duplicateReport,
    });
  }

  // 3. Execute Batch Transaction (Compliance Point 6)
  const insertedCount = await withTransaction(async (tx) => {
    let countInserted = 0;

    for (const row of dryRun.previewData) {
      if (input.targetType === "INSTITUTIONS") {
        await tx.insert(institutions).values({
          code: row.code || `INST-IMP-${Date.now()}-${countInserted}`,
          name: row.name,
          email: row.email,
          phone: row.phone || null,
          provinceCode: row.provinceCode || null,
          cityCode: row.cityCode || null,
          address: row.address || null,
        });
        countInserted++;
      }
    }

    return countInserted;
  });

  // 4. Record Audit Log
  if (requestId) {
    await createAuditLog({
      actorUserId: actorUserId || null,
      action: "SPREADSHEET_IMPORTED",
      resourceType: input.targetType,
      resourceId: `batch_imp_${Date.now()}`,
      reason: `Impor spreadsheet ${input.targetType} berhasil sebanyak ${insertedCount} entri setelah persetujuan preview.`,
      requestId,
    });
  }

  return {
    status: "SUCCESS",
    message: `Impor batch ${input.targetType} berhasil menambahkan ${insertedCount} data baru ke database.`,
    importedCount: insertedCount,
  };
}
