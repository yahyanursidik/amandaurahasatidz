import { randomBytes, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { withTransaction } from "../db/transaction";
import { eventParticipants, roles, userRoleAssignments, users, ustadzProfiles } from "../db/schema";
import { findEventBySlugRepository } from "../repositories/eventRepository";
import { countApprovedParticipantsBySourceRepository, countApprovedParticipantsForEventRepository } from "../repositories/participantRepository";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../utils/errors";
import { normalizeEmail, normalizeName, normalizePhone } from "../utils/normalization";
import { enqueueEmailJob } from "./emailQueueService";
import { createAuditLog } from "./auditService";
import { createInvitationOtpChallenge, shouldExposeInvitationPreviewCode, verifyInvitationOtpChallenge } from "./invitationOtpService";

type PublicRegistrationInput = {
  fullName: string;
  email: string;
  whatsapp: string;
  address?: string | null;
  code: string;
  challengeToken: string;
  consentConfirmed: true;
  delegates?: Array<{ fullName: string; email: string; whatsapp: string; address?: string | null }>;
};

export function normalizePublicRegistrationGroup(input: PublicRegistrationInput) {
  const people = [input, ...(input.delegates || [])].map((person) => ({
    fullName: person.fullName.trim(),
    email: normalizeEmail(person.email) || "",
    whatsapp: normalizePhone(person.whatsapp),
    address: person.address?.trim() || null,
  }));
  if (people.length > 20) throw new ValidationError("Maksimal 20 asatidz dalam satu rombongan.");
  if (new Set(people.map((person) => person.email)).size !== people.length) {
    throw new ValidationError("Setiap asatidz harus memakai email pribadi yang berbeda.");
  }
  if (people.some((person) => !person.email || !person.fullName || !person.whatsapp || person.whatsapp.length < 9)) {
    throw new ValidationError("Lengkapi nama, email, dan WhatsApp setiap asatidz.");
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
  const approved = await countApprovedParticipantsBySourceRepository(event.id, true);
  if (event.regularQuota != null && approved >= event.regularQuota) {
    throw new ConflictError("Kuota reguler sudah penuh. Silakan hubungi panitia untuk informasi daftar tunggu.");
  }
  if (event.capacity != null && await countApprovedParticipantsForEventRepository(event.id) >= event.capacity) {
    throw new ConflictError("Kapasitas program sudah penuh. Silakan hubungi panitia.");
  }
  return event;
}

export async function requestPublicRegistrationCodeService(slug: string, email: string) {
  const event = await getOpenEvent(slug);
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new ValidationError("Alamat email tidak valid.");
  const challenge = createInvitationOtpChallenge(event.id, normalizedEmail);
  await enqueueEmailJob({
    templateCode: "OTP_CODE",
    recipientEmail: normalizedEmail,
    variables: { otpCode: challenge.code, expiresMinutes: 5 },
    idempotencyKey: `public_registration_${event.id}_${randomBytes(12).toString("hex")}`,
  });
  return {
    challengeToken: challenge.challengeToken,
    expiresAt: challenge.expiresAt,
    ...(shouldExposeInvitationPreviewCode() ? { previewCode: challenge.code } : {}),
  };
}

export async function submitPublicRegistrationService(slug: string, input: PublicRegistrationInput, requestId: string) {
  const event = await getOpenEvent(slug);
  const people = normalizePublicRegistrationGroup(input);
  if (!verifyInvitationOtpChallenge(input.challengeToken, input.code, event.id, people[0].email)) {
    throw new ForbiddenError("Kode email salah atau sudah kedaluwarsa. Minta kode baru.");
  }

  const result = await withTransaction(async (tx) => {
    const role = (await tx.select().from(roles).where(eq(roles.code, "USTADZ")).limit(1))[0];
    if (!role) throw new ConflictError("Konfigurasi peran asatidz belum siap. Hubungi admin.");
    // Validate the complete group before writing: Neon HTTP may not support interactive transactions.
    const existing = [];
    for (const person of people) {
      const profiles = await tx.select().from(ustadzProfiles).where(eq(ustadzProfiles.email, person.email)).limit(2);
      if (profiles.length > 1) throw new ConflictError(`Email ${person.email} terhubung ke beberapa profil. Hubungi panitia.`);
      const profile = profiles[0];
      if (profile && normalizeName(profile.fullName) !== normalizeName(person.fullName)) {
        throw new ConflictError(`Nama untuk ${person.email} tidak cocok dengan profil yang sudah ada. Hubungi panitia.`);
      }
      const user = (await tx.select().from(users).where(eq(users.email, person.email)).limit(1))[0];
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
    const registered = [];
    for (const [index, entry] of existing.entries()) {
      const { person } = entry;
      const user = entry.user || (await tx.insert(users).values({ email: person.email, name: person.fullName, status: "ACTIVE" }).returning())[0];
      let profile = entry.profile;
      if (!profile) {
        profile = (await tx.insert(ustadzProfiles).values({
          userId: user.id, fullName: person.fullName, normalizedName: normalizeName(person.fullName),
          email: person.email, whatsapp: person.whatsapp, address: person.address, profileStatus: "ACTIVE",
        }).returning())[0];
      } else if (!profile.userId) {
        profile = (await tx.update(ustadzProfiles).set({ userId: user.id, updatedAt: new Date() }).where(eq(ustadzProfiles.id, profile.id)).returning())[0];
      }
      const roleExists = (await tx.select({ id: userRoleAssignments.id }).from(userRoleAssignments)
        .where(and(eq(userRoleAssignments.userId, user.id), eq(userRoleAssignments.roleId, role.id), eq(userRoleAssignments.eventId, event.id))).limit(1))[0];
      if (!roleExists) await tx.insert(userRoleAssignments).values({ userId: user.id, roleId: role.id, eventId: event.id });
      const participantCode = `ADA-${event.code.slice(0, 8).replace(/[^A-Za-z0-9]/g, "").toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;
      const participant = (await tx.insert(eventParticipants).values({
        eventId: event.id, ustadzId: profile.id, registrationSource: "DIRECT_PUBLIC",
        publicGroupId, isDelegationLead: Boolean(publicGroupId && index === 0), participantCode,
        confirmationStatus: "CONFIRMED", approvalStatus: "PENDING_REVIEW", confirmedAt: new Date(),
      }).returning())[0];
      registered.push({ participantId: participant.id, fullName: person.fullName, email: person.email, participantCode, passwordSetupRequired: !user.passwordHash });
    }
    return {
      participantCode: registered[0].participantCode,
      approvalStatus: "PENDING_REVIEW",
      portalLoginUrl: "/login/ustadz",
      passwordSetupRequired: registered[0].passwordSetupRequired,
      publicGroupId,
      participants: registered,
    };
  });
  await createAuditLog({
    actorUserId: null,
    action: "PUBLIC_REGISTRATION_SUBMITTED",
    resourceType: "EVENT",
    resourceId: event.id,
    eventId: event.id,
    afterData: { participantCode: result.participantCode, approvalStatus: result.approvalStatus, publicGroupId: result.publicGroupId, participantCount: result.participants.length, consentConfirmed: input.consentConfirmed },
    requestId,
  });
  const emailQueueResults = await Promise.allSettled(result.participants.map((participant) => enqueueEmailJob({
      templateCode: "REGISTRATION_RECEIVED",
      recipientEmail: participant.email,
      recipientName: participant.fullName,
      variables: { ustadzName: participant.fullName, eventName: event.name, participantCode: participant.participantCode, portalLink: `${process.env.APP_URL || ""}/login/ustadz` },
      idempotencyKey: `public_registration_received_${participant.participantId}`,
    })));
  return {
    participantCode: result.participantCode,
    approvalStatus: result.approvalStatus,
    portalLoginUrl: result.portalLoginUrl,
    passwordSetupRequired: result.passwordSetupRequired,
    publicGroupId: result.publicGroupId,
    participants: result.participants.map(({ fullName, email, participantCode }) => ({ fullName, email, participantCode })),
    emailQueued: emailQueueResults.filter((item) => item.status === "fulfilled").length,
  };
}
