import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { withTransaction } from "../db/transaction";
import { eventParticipants, roles, userRoleAssignments, users, ustadzProfiles, ustadzInstitutionAffiliations } from "../db/schema";
import { findEventBySlugRepository } from "../repositories/eventRepository";
import { countApprovedParticipantsBySourceRepository, countApprovedParticipantsForEventRepository } from "../repositories/participantRepository";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../utils/errors";
import { normalizeEmail, normalizeName, normalizePhone } from "../utils/normalization";
import { createAuditLog } from "./auditService";
import { resolveRegistrationInstitution } from "./registrationInstitutionService";
import { signCardForParticipant, cardPath } from "./participantCardService";
import { queueParticipantCardEmails } from "./participantCardEmailService";
import { logError } from "../utils/logger";

type PublicRegistrationInput = {
  fullName: string;
  email: string;
  whatsapp: string;
  address?: string | null;
  institutionName?: string | null;
  city: string;
  province: string;
  cityCode?: string | null;
  provinceCode?: string | null;
  consentConfirmed: true;
  delegates?: Array<{ fullName: string; email: string; whatsapp: string; address?: string | null; city: string; province: string; cityCode?: string | null; provinceCode?: string | null }>;
};

export function normalizePublicRegistrationGroup(input: PublicRegistrationInput) {
  const people = [input, ...(input.delegates || [])].map((person) => ({
    fullName: person.fullName.trim(),
    email: normalizeEmail(person.email) || "",
    whatsapp: normalizePhone(person.whatsapp),
    address: person.address?.trim() || null,
    cityCode: person.cityCode || person.city.trim(),
    provinceCode: person.provinceCode || person.province.trim(),
  }));
  if (people.length > 20) throw new ValidationError("Maksimal 20 asatidz dalam satu rombongan.");
  if (new Set(people.map((person) => person.email)).size !== people.length) {
    throw new ValidationError("Setiap asatidz harus memakai email pribadi yang berbeda.");
  }
  if (people.some((person) => !person.email || !person.fullName || !person.whatsapp || person.whatsapp.length < 9 || !person.cityCode || !person.provinceCode)) {
    throw new ValidationError("Lengkapi nama, email, WhatsApp, kabupaten/kota, dan provinsi setiap asatidz.");
  }
  return people;
}

export function assertPublicRegistrationOpen(event: {
  audienceMode: string;
  status: string;
  registrationOpenAt?: Date | null;
  registrationCloseAt?: Date | null;
  regularQuota?: number | null;
}, now = new Date()) {
  if (!["PUBLIC_OPEN", "MIXED"].includes(event.audienceMode)) {
    throw new ForbiddenError("Program ini menerima pendaftaran melalui undangan. Mintalah tautan resmi kepada panitia.");
  }
  if (event.status !== "REGISTRATION_OPEN" ||
    (event.registrationOpenAt && event.registrationOpenAt > now) ||
    (event.registrationCloseAt && event.registrationCloseAt < now)) {
    throw new ForbiddenError("Pendaftaran reguler belum dibuka atau sudah ditutup.");
  }
  if (event.regularQuota === 0) throw new ForbiddenError("Kuota reguler untuk program ini ditutup.");
}

async function getOpenEvent(slug: string) {
  const event = await findEventBySlugRepository(slug);
  if (!event) throw new NotFoundError("Program daurah tidak ditemukan.");
  assertPublicRegistrationOpen(event);
  return event;
}

export async function submitPublicRegistrationService(slug: string, input: PublicRegistrationInput, requestId: string) {
  const event = await getOpenEvent(slug);
  const people = normalizePublicRegistrationGroup(input);
  const maxGroupSize = Math.min(20, event.defaultInstitutionQuota || 20, event.regularQuota || 20);
  if (people.length > maxGroupSize) throw new ValidationError(`Maksimal ${maxGroupSize} peserta termasuk kepala rombongan untuk satu pendaftaran.`);
  const [regularApproved, totalApproved] = await Promise.all([
    countApprovedParticipantsBySourceRepository(event.id, true), countApprovedParticipantsForEventRepository(event.id),
  ]);
  if (event.regularQuota != null && regularApproved + people.length > event.regularQuota ||
    event.capacity != null && totalApproved + people.length > event.capacity) {
    throw new ConflictError("Sisa kuota tidak cukup untuk seluruh anggota rombongan. Kurangi jumlah peserta atau hubungi panitia.");
  }

  const result = await withTransaction(async (tx) => {
    const role = (await tx.select().from(roles).where(eq(roles.code, "USTADZ")).limit(1))[0];
    if (!role) throw new ConflictError("Konfigurasi peran asatidz belum siap. Hubungi admin.");
    // Fetch candidate identities in two queries instead of two queries per member.
    const emails = people.map((person) => person.email);
    const [profileRows, userRows] = await Promise.all([
      tx.select().from(ustadzProfiles).where(inArray(ustadzProfiles.email, emails)),
      tx.select().from(users).where(inArray(users.email, emails)),
    ]);
    // Validate the complete group before writing: Neon HTTP may not support interactive transactions.
    const existing = [];
    for (const person of people) {
      const profiles = profileRows.filter((item) => item.email === person.email);
      if (profiles.length > 1) throw new ConflictError(`Email ${person.email} terhubung ke beberapa profil. Hubungi panitia.`);
      const profile = profiles[0];
      if (profile && normalizeName(profile.fullName) !== normalizeName(person.fullName)) {
        throw new ConflictError(`Nama untuk ${person.email} tidak cocok dengan profil yang sudah ada. Hubungi panitia.`);
      }
      const user = userRows.find((item) => item.email === person.email);
      if (user && user.status !== "ACTIVE") throw new ConflictError(`Akun ${person.email} tidak aktif. Hubungi panitia.`);
      if (user) {
        const linkedProfiles = await tx.select({ id: ustadzProfiles.id }).from(ustadzProfiles)
          .where(eq(ustadzProfiles.userId, user.id)).limit(2);
        if (linkedProfiles.some((linked) => linked.id !== profile?.id)) {
          throw new ConflictError(`Akun ${person.email} sudah terhubung dengan profil asatidz lain. Hubungi panitia untuk menyatukan data.`);
        }
      }
      if (profile?.userId && (!user || profile.userId !== user.id)) {
        throw new ConflictError(`Profil dan akun ${person.email} belum sesuai. Hubungi panitia.`);
      }
      if (profile) {
        const duplicate = await tx.select({ id: eventParticipants.id }).from(eventParticipants)
          .where(and(eq(eventParticipants.eventId, event.id), eq(eventParticipants.ustadzId, profile.id))).limit(1);
        if (duplicate[0]) throw new ConflictError(`${person.fullName} sudah terdaftar di program ini. Hindari pendaftaran ganda.`);
      }
      existing.push({ person, profile, user });
    }
    const publicGroupId = people.length > 1 ? randomUUID() : null;
    const institutionId = await resolveRegistrationInstitution(tx, input.institutionName);
    const registered = [];
    for (const [index, entry] of existing.entries()) {
      const { person } = entry;
      const user = entry.user || (await tx.insert(users).values({ email: person.email, name: person.fullName, status: "ACTIVE" }).returning())[0];
      let profile = entry.profile;
      if (!profile) {
        profile = (await tx.insert(ustadzProfiles).values({
          userId: user.id, fullName: person.fullName, normalizedName: normalizeName(person.fullName),
          email: person.email, whatsapp: person.whatsapp, address: person.address, profileStatus: "ACTIVE",
          cityCode: person.cityCode, provinceCode: person.provinceCode,
        }).returning())[0];
      } else if (!profile.userId || !profile.cityCode || !profile.provinceCode) {
        profile = (await tx.update(ustadzProfiles).set({ ...(!profile.userId && { userId: user.id }),
          cityCode: profile.cityCode || person.cityCode, provinceCode: profile.provinceCode || person.provinceCode,
          updatedAt: new Date() }).where(eq(ustadzProfiles.id, profile.id)).returning())[0];
      }
      if (institutionId) {
        const [affiliation] = await tx.select({ id: ustadzInstitutionAffiliations.id })
          .from(ustadzInstitutionAffiliations).where(and(
            eq(ustadzInstitutionAffiliations.ustadzId, profile.id),
            eq(ustadzInstitutionAffiliations.institutionId, institutionId),
          )).limit(1);
        if (!affiliation) await tx.insert(ustadzInstitutionAffiliations).values({
          ustadzId: profile.id, institutionId, isPrimary: false, status: "ACTIVE",
        });
      }
      const roleExists = (await tx.select({ id: userRoleAssignments.id }).from(userRoleAssignments)
        .where(and(eq(userRoleAssignments.userId, user.id), eq(userRoleAssignments.roleId, role.id), eq(userRoleAssignments.eventId, event.id))).limit(1))[0];
      if (!roleExists) await tx.insert(userRoleAssignments).values({ userId: user.id, roleId: role.id, eventId: event.id });
      const participantCode = `P-${randomBytes(4).toString("hex").toUpperCase()}`;
      const participant = (await tx.insert(eventParticipants).values({
        eventId: event.id, ustadzId: profile.id, registrationSource: "DIRECT_PUBLIC",
        institutionId,
        publicGroupId, isDelegationLead: Boolean(publicGroupId && index === 0), participantCode,
        confirmationStatus: "CONFIRMED", approvalStatus: "APPROVED", confirmedAt: new Date(), approvedAt: new Date(),
      }).returning())[0];
      const qrToken = signCardForParticipant(participant);
      registered.push({ participantId: participant.id, fullName: person.fullName, email: person.email, whatsapp: person.whatsapp,
        participantCode, qrToken, cardUrl: cardPath(qrToken), passwordSetupRequired: !user.passwordHash });
    }
    return {
      participantCode: registered[0].participantCode,
      approvalStatus: "APPROVED",
      portalLoginUrl: "/login/ustadz",
      passwordSetupRequired: registered[0].passwordSetupRequired,
      publicGroupId,
      participants: registered,
    };
  });
  const [auditResult, emailResult] = await Promise.allSettled([createAuditLog({
    actorUserId: null,
    action: "PUBLIC_REGISTRATION_SUBMITTED",
    resourceType: "EVENT",
    resourceId: event.id,
    eventId: event.id,
    afterData: { participantCode: result.participantCode, approvalStatus: result.approvalStatus, publicGroupId: result.publicGroupId, participantCount: result.participants.length, consentConfirmed: input.consentConfirmed },
    requestId,
  }), queueParticipantCardEmails({ id: event.id, name: event.name }, result.participants.map((person) => ({
    participantId: person.participantId, ustadzName: person.fullName, email: person.email,
    participantCode: person.participantCode, qrToken: person.qrToken,
  })))]);
  if (auditResult.status === "rejected") logError(requestId, "Audit pendaftaran reguler gagal disimpan", auditResult.reason);
  if (emailResult.status === "rejected") logError(requestId, "Antrean kartu QR reguler gagal disimpan", emailResult.reason);
  const emailQueued = emailResult.status === "fulfilled" ? emailResult.value : 0;
  return {
    participantCode: result.participantCode,
    approvalStatus: result.approvalStatus,
    portalLoginUrl: result.portalLoginUrl,
    passwordSetupRequired: result.passwordSetupRequired,
    publicGroupId: result.publicGroupId,
    participants: result.participants.map(({ fullName, email, whatsapp, participantCode, qrToken, cardUrl, passwordSetupRequired }) => ({ fullName, email, whatsapp, participantCode, qrToken, cardUrl, passwordSetupRequired })),
    emailQueued,
  };
}
