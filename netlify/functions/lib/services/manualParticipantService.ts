import { randomUUID } from "node:crypto";
import { and, eq, inArray, or, sql, type AnyColumn } from "drizzle-orm";
import { z } from "zod";
import { events, eventParticipants, ustadzProfiles } from "../db/schema";
import { withTransaction } from "../db/transaction";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../utils/errors";
import { normalizeEmail, normalizeName, normalizePhone } from "../utils/normalization";
import { manualParticipantSchema } from "../validations/participantValidation";
import { createAuditLog } from "./auditService";
import { resolveRegistrationInstitution } from "./registrationInstitutionService";

export type ManualParticipantInput = z.infer<typeof manualParticipantSchema>;

function normalizedContact(value: string | null) {
  const digits = value?.replace(/\D/g, "") || "";
  return normalizePhone(digits.startsWith("8") ? `62${digits}` : digits);
}

// Recognize legacy formatting in the database, not just newly normalized data.
function normalizedDbContact(column: AnyColumn) {
  const digits = sql<string>`regexp_replace(coalesce(${column}, ''), '[^0-9]', '', 'g')`;
  return sql<string>`case when ${digits} like '0%' then '62' || substring(${digits} from 2)
    when ${digits} like '8%' then '62' || ${digits} else ${digits} end`;
}

/** Creates a pending participant only; authorization remains the caller's responsibility. */
export async function createManualParticipantService(
  eventId: string,
  input: ManualParticipantInput,
  actorUserId: string | null,
  requestId: string,
) {
  const parsed = manualParticipantSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data peserta manual tidak valid.", { issues: parsed.error.issues });
  const person = parsed.data;
  const normalizedName = normalizeName(person.fullName);
  const phone = person.phone || person.whatsapp;
  const contacts = [...new Set([phone, person.whatsapp])];

  const result = await withTransaction(async (tx) => {
    // Serializes manual entries for this event when interactive transactions are
    // supported. Neon HTTP's existing fallback does not provide this guarantee.
    const [event] = await tx.select().from(events).where(eq(events.id, eventId)).limit(1).for("update");
    if (!event) throw new NotFoundError("Program daurah tidak ditemukan.");
    if (event.archivedAt || ["ARCHIVED", "COMPLETED", "CANCELLED"].includes(event.status)) {
      throw new ForbiddenError("Peserta tidak dapat ditambahkan ke program yang selesai, dibatalkan, atau diarsipkan.");
    }

    const candidates = await tx.select().from(ustadzProfiles).where(or(
      eq(sql<string>`lower(trim(${ustadzProfiles.email}))`, person.email),
      inArray(normalizedDbContact(ustadzProfiles.phone), contacts),
      inArray(normalizedDbContact(ustadzProfiles.whatsapp), contacts),
    )).limit(2);
    let profile = candidates[0];
    if (candidates.length > 1) throw new ConflictError("Identitas peserta cocok dengan beberapa profil. Periksa data induk terlebih dahulu.");
    if (profile) {
      const existingContacts = [normalizedContact(profile.phone), normalizedContact(profile.whatsapp)]
        .filter((value): value is string => Boolean(value));
      const existingEmail = normalizeEmail(profile.email);
      const nameMatches = normalizeName(profile.fullName) === normalizedName;
      const identityMatches = existingEmail === person.email || existingContacts.some((value) => contacts.includes(value));
      const conflictingContact = existingContacts.some((value) => !contacts.includes(value));
      if (!nameMatches || !identityMatches || (existingEmail && existingEmail !== person.email) || conflictingContact ||
          profile.deletedAt || profile.mergedIntoId || profile.profileStatus !== "ACTIVE") {
        throw new ConflictError("Identitas atau kontak bertentangan dengan profil yang ada. Periksa data induk terlebih dahulu.");
      }
      const [duplicate] = await tx.select({ id: eventParticipants.id }).from(eventParticipants).where(and(
        eq(eventParticipants.eventId, eventId), eq(eventParticipants.ustadzId, profile.id),
      )).limit(1);
      if (duplicate) throw new ConflictError("Peserta sudah terdaftar pada program ini.");
    }

    // All identity/duplicate checks precede writes, including institution resolution.
    const reusedProfile = Boolean(profile);
    const institutionId = await resolveRegistrationInstitution(tx, person.institutionName);
    if (!profile) {
      [profile] = await tx.insert(ustadzProfiles).values({
        fullName: person.fullName, normalizedName, email: person.email,
        phone, whatsapp: person.whatsapp, address: person.address || null, profileStatus: "ACTIVE",
      }).returning();
    }
    // Never overwrite an existing master profile, even to fill missing fields.
    const participantCode = `P-${randomUUID().replace(/-/g, "").toUpperCase()}`;
    const confirmationStatus: "CONFIRMED" | "INVITED" = person.attendanceConfirmed === true ? "CONFIRMED" : "INVITED";
    const [participant] = await tx.insert(eventParticipants).values({
      eventId, ustadzId: profile.id, institutionId, participantCode,
      registrationSource: "ADMIN_ENTRY", approvalStatus: "PENDING_REVIEW", confirmationStatus,
      confirmedAt: person.attendanceConfirmed === true ? new Date() : null,
      approvedAt: null, approvedBy: null, notes: person.notes || null,
    }).onConflictDoNothing({ target: [eventParticipants.eventId, eventParticipants.ustadzId] }).returning();
    if (!participant) throw new ConflictError("Peserta sudah terdaftar pada program ini.");
    return {
      participantId: participant.id, participantCode: participant.participantCode,
      reusedProfile, ustadzId: profile.id, institutionId,
      registrationSource: "ADMIN_ENTRY" as const, approvalStatus: "PENDING_REVIEW" as const,
      confirmationStatus,
    };
  });

  await createAuditLog({
    actorUserId, action: "MANUAL_PARTICIPANT_CREATED", resourceType: "EVENT_PARTICIPANT",
    resourceId: result.participantId, eventId, afterData: result, requestId,
  });
  return result;
}