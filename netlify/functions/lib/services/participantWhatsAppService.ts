import { and, asc, eq, ilike, inArray, isNull, notInArray, or, sql, type SQLWrapper } from "drizzle-orm";
import { getDbClient } from "../db/client";
import { eventParticipants, institutions, ustadzProfiles } from "../db/schema";
import { findRegistrationEventRepository } from "../repositories/eventRepository";
import { NotFoundError } from "../utils/errors";
import type { ParticipantWhatsAppQuery } from "../validations/participantValidation";
import { INSTITUTION_PARTICIPANT_SOURCES, INVITED_PARTICIPANT_SOURCES } from "../../../../src/lib/participantCatalog";
import { normalizeWhatsAppNumber } from "../../../../src/lib/participantCommunication";
import type { EventWhatsAppContext, WhatsAppWizardRecipient } from "../../../../src/lib/eventParticipantWhatsApp";
import { registrationStage } from "../../../../src/lib/registrationStatus";
import { isAttendanceEventOpen } from "./attendanceModel";
import { registrationReceiptPath } from "./participantConfirmationLink";
import { submittedWhatsAppForParticipant } from "./participantContactReview";

function eventContacts(eventId: string) {
  const query = getDbClient().select({
    id: eventParticipants.id,
    fullName: ustadzProfiles.fullName,
    institutionName: institutions.name,
    whatsapp: ustadzProfiles.whatsapp,
    phone: ustadzProfiles.phone,
    submittedWhatsapp: submittedWhatsAppForParticipant,
    participantCode: eventParticipants.participantCode,
    registrationSource: eventParticipants.registrationSource,
    approvalStatus: eventParticipants.approvalStatus,
    confirmationStatus: eventParticipants.confirmationStatus,
  }).from(eventParticipants)
    .innerJoin(ustadzProfiles, eq(ustadzProfiles.id, eventParticipants.ustadzId))
    .leftJoin(institutions, eq(institutions.id, eventParticipants.institutionId));
  const scope = and(eq(eventParticipants.eventId, eventId), eq(ustadzProfiles.profileStatus, "ACTIVE"),
    isNull(ustadzProfiles.deletedAt), isNull(ustadzProfiles.mergedIntoId));
  return { query, scope };
}

type ContactRow = Awaited<ReturnType<typeof eventContacts>["query"]>[number];
function normalizeContactForMatch(column: SQLWrapper) {
  // Match normalizeWhatsAppNumber() for normalized target numbers supplied below.
  const digits = sql`regexp_replace(regexp_replace(coalesce(${column}, ''), '[^0-9]', '', 'g'), '^00', '')`;
  return sql<string>`case when ${digits} like '0%' then '62' || substring(${digits} from 2)
    when ${digits} like '8%' then '62' || ${digits} else ${digits} end`;
}

async function sharedNumbersByParticipant(eventId: string, eligible: WhatsAppWizardRecipient[]) {
  const numbers = [...new Set(eligible.flatMap((person) => person.number ? [person.number] : []))];
  if (!numbers.length) return new Set<string>();
  const direct = normalizeContactForMatch(ustadzProfiles.whatsapp);
  const fallback = normalizeContactForMatch(ustadzProfiles.phone);
  const matches = await getDbClient().select({ id: eventParticipants.id, direct, fallback }).from(eventParticipants)
    .innerJoin(ustadzProfiles, eq(ustadzProfiles.id, eventParticipants.ustadzId))
    .where(and(eq(eventParticipants.eventId, eventId), or(inArray(direct, numbers), inArray(fallback, numbers))));
  const owners = new Map<string, string | null>();
  for (const { id, direct, fallback } of matches) {
    for (const number of new Set([direct, fallback])) {
      if (owners.has(number) && owners.get(number) !== id) owners.set(number, null);
      else if (!owners.has(number)) owners.set(number, id);
    }
  }
  return new Set(eligible.filter((person) => person.number && owners.get(person.number) !== person.id).map(({ id }) => id));
}

function recipient({ whatsapp, phone, submittedWhatsapp, ...person }: ContactRow): WhatsAppWizardRecipient {
  const preferred = normalizeWhatsAppNumber(whatsapp);
  const fallback = normalizeWhatsAppNumber(phone);
  const proposed = normalizeWhatsAppNumber(submittedWhatsapp);
  const needsContactReview = Boolean(proposed && proposed !== preferred);
  const number = needsContactReview ? null : preferred || fallback;
  // Old import/form paths could copy phone into whatsapp. Do not treat identical stored fields
  // as proof that there was a separate WhatsApp selection.
  return { ...person, number, ...(needsContactReview ? { needsContactReview } : {}),
    numberSource: number && preferred && preferred !== fallback ? "WhatsApp" : number ? "Telepon cadangan" : null };
}

async function readEvent(eventId: string) {
  const event = await findRegistrationEventRepository(eventId);
  if (!event) throw new NotFoundError("Event tidak ditemukan.");
  return event;
}

/** Shared by Bagikan akses and batch composition; never substitute a phone fallback. */
export async function getEventRegistrationWhatsAppNumber(eventId: string, participantId: string) {
  const { query, scope } = eventContacts(eventId);
  const [row] = await query.where(and(scope, eq(eventParticipants.id, participantId))).limit(1);
  if (!row) return null;
  const person = recipient(row);
  if (person.numberSource !== "WhatsApp") return null;
  const shared = await sharedNumbersByParticipant(eventId, [person]);
  return shared.has(participantId) ? null : person.number;
}

export async function listEventWhatsAppRecipientsService(eventId: string, filter: ParticipantWhatsAppQuery) {
  const event = await readEvent(eventId);
  const { query, scope } = eventContacts(eventId);
  const search = filter.search ? `%${filter.search.replace(/[\\%_]/g, (character) => `\\${character}`)}%` : null;
  const status = filter.status === "ALL" ? undefined
    : filter.status === "AWAITING_CONFIRMATION"
      ? and(eq(eventParticipants.approvalStatus, "APPROVED"), eq(eventParticipants.confirmationStatus, "INVITED"))
      : filter.status === "DECLINED" ? inArray(eventParticipants.approvalStatus, ["DECLINED", "REJECTED"])
        : filter.status === "CANCELLED" ? eq(eventParticipants.confirmationStatus, "CANCELLED")
          : eq(eventParticipants.approvalStatus, filter.status);
  if (filter.status === "AWAITING_CONFIRMATION" && !event.attendanceConfirmationRequired) return { recipients: [], hasNext: false };
  const rows = await query.where(and(scope, status,
    filter.institutionId ? eq(eventParticipants.institutionId, filter.institutionId) : undefined,
    filter.invitationId ? eq(eventParticipants.invitationId, filter.invitationId) : undefined,
    filter.source === "INSTITUTION" ? inArray(eventParticipants.registrationSource, INSTITUTION_PARTICIPANT_SOURCES)
      : filter.source === "INDIVIDUAL" ? eq(eventParticipants.registrationSource, "INDIVIDUAL_INVITATION")
        : filter.source === "REGULAR" ? notInArray(eventParticipants.registrationSource, INVITED_PARTICIPANT_SOURCES) : undefined,
    search ? or(ilike(ustadzProfiles.fullName, search), ilike(eventParticipants.participantCode, search), ilike(institutions.name, search),
      ilike(ustadzProfiles.whatsapp, search), ilike(ustadzProfiles.phone, search), ilike(ustadzProfiles.email, search)) : undefined,
  )).orderBy(asc(ustadzProfiles.fullName), asc(eventParticipants.id)).limit(filter.pageSize + 1).offset((filter.page - 1) * filter.pageSize);
  const recipients = rows.slice(0, filter.pageSize).map(recipient);
  if (filter.status === "AWAITING_CONFIRMATION") {
    const shared = await sharedNumbersByParticipant(eventId, recipients.filter((person) => person.numberSource === "WhatsApp"));
    return { recipients: recipients.map((person) => shared.has(person.id) ? { ...person, sharedNumber: true } : person), hasNext: rows.length > filter.pageSize };
  }
  return { recipients, hasNext: rows.length > filter.pageSize };
}

export async function resolveEventWhatsAppRecipientsService(eventId: string, ids: string[], confirmation: boolean, statusLinkFor?: string) {
  const event = await readEvent(eventId);
  const { query, scope } = eventContacts(eventId);
  const rows = await query.where(and(scope, inArray(eventParticipants.id, ids)));
  const byId = new Map(rows.map((row) => [row.id, recipient(row)]));
  const now = new Date();
  const canSendConfirmationLink = confirmation && event.attendanceConfirmationRequired && isAttendanceEventOpen(event, now) &&
    (event.lateConfirmationPolicy !== "BLOCK" || !event.attendanceConfirmationDeadline || now <= event.attendanceConfirmationDeadline);
  const eligible = [...byId.values()].filter((person) => canSendConfirmationLink && person.numberSource === "WhatsApp" &&
    registrationStage({ approvalStatus: person.approvalStatus || "", confirmationStatus: person.confirmationStatus || "",
      attendanceConfirmationRequired: event.attendanceConfirmationRequired }) === "AWAITING_CONFIRMATION");
  const shared = await sharedNumbersByParticipant(eventId, eligible);
  const confirmationIds = new Set(eligible.filter((person) => !shared.has(person.id)).map(({ id }) => id));
  const recipients = ids.flatMap((id) => {
    const person = byId.get(id);
    if (!person) return []; // Missing and out-of-scope IDs look the same.
    const confirmationAvailable = confirmationIds.has(id);
    return [{ ...person, ...(confirmation ? { confirmationAvailable, sharedNumber: shared.has(id) } : {}),
      ...(confirmationAvailable && statusLinkFor === id
        ? { registrationStatusUrl: registrationReceiptPath({ id, eventId: event.id }, event.endDate) } : {}) }];
  });
  const context: EventWhatsAppContext = {
    id: event.id, name: event.name, slug: event.slug, startDate: event.startDate, endDate: event.endDate,
    venueName: event.venueName, status: event.status, timezone: event.timezone, attendanceConfirmationRequired: event.attendanceConfirmationRequired,
    attendanceConfirmationDeadline: event.attendanceConfirmationDeadline?.toISOString() ?? null,
    lateConfirmationPolicy: event.lateConfirmationPolicy,
  };
  return { event: context, recipients };
}
