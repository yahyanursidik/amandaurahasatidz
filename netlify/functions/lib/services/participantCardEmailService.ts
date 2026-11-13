import { getDbClient } from "../db/client";
import { emailJobs, emailTemplates, eventParticipants, events, ustadzProfiles } from "../db/schema";
import { and, eq } from "drizzle-orm";
import { renderEmailTemplate, TEMPLATE_WHITELISTS } from "./emailTemplateEngine";
import { isAttendanceEventOpen } from "./attendanceModel";
import { registrationReceiptUrl } from "./participantConfirmationLink";
import { registrationStage, type RegistrationState } from "../../../../src/lib/registrationStatus";

type RegistrationEvent = {
  id: string; name: string; slug: string; endDate: string;
  status: string; timezone: string; archivedAt?: Date | null;
  attendanceConfirmationRequired: boolean;
};
type Recipient = { participantId: string; ustadzName: string; email: string; participantCode: string };
type Participant = Omit<RegistrationState, "attendanceConfirmationRequired"> & {
  id: string; eventId: string; ustadzId: string; participantCode: string; qrTokenVersion: number;
};
type Outcome = "CONFIRM" | "DECLINE" | "WITHDRAW";
type Variables = Record<string, string>;
export type RegistrationEmailDispatch = { jobIds: string[] };

export async function flushRegistrationEmailDispatch(dispatch: RegistrationEmailDispatch, requestId = "registration-email") {
  if (!dispatch.jobIds.length) return;
  try {
    const { processEmailQueueWorker } = await import("./emailQueueService");
    await processEmailQueueWorker("registration-action", Math.min(dispatch.jobIds.length, 100), requestId, dispatch.jobIds);
  } catch {
    const { logError } = await import("../utils/logger");
    logError(requestId, "Pengiriman langsung pemberitahuan belum selesai. Periksa antrean email.");
  }
}

const workflowCodes = new Set([
  "REGISTRATION_RECEIVED", "REGISTRATION_APPROVED", "REGISTRATION_AUTO_APPROVED", "REGISTRATION_CONFIRMATION_REQUEST",
  "PARTICIPANT_ATTENDANCE_CONFIRMED", "PARTICIPANT_ATTENDANCE_DECLINED", "PARTICIPANT_WITHDRAWN", "REGISTRATION_CONFIRMED",
]);
export const isRegistrationWorkflowEmail = (code: string) => workflowCodes.has(code);

function emailLinks(event: Pick<RegistrationEvent, "id" | "slug" | "endDate">, participantId: string) {
  const origin = process.env.APP_URL || process.env.URL || "http://localhost:3000";
  return {
    registrationStatusLink: registrationReceiptUrl({ id: participantId, eventId: event.id }, event.endDate),
    rundownLink: new URL(`/events/${encodeURIComponent(event.slug)}#jadwal-kegiatan`, origin).toString(),
    portalLink: new URL("/login/ustadz", origin).toString(),
  };
}

function emailVariables(code: string, event: Pick<RegistrationEvent, "id" | "name" | "slug" | "endDate">, person: Recipient, ready = false): Variables {
  const common = { ustadzName: person.ustadzName, eventName: event.name, participantCode: person.participantCode };
  if (code === "PARTICIPANT_ATTENDANCE_DECLINED" || code === "PARTICIPANT_WITHDRAWN") return common;
  const links = emailLinks(event, person.participantId);
  if (code === "PARTICIPANT_ATTENDANCE_CONFIRMED") {
    return { ...common, ...links, nextStep: ready
      ? "QR presensi tersedia di Portal Asatidz atau dengan tautan akses pribadi yang dapat diminta dari halaman status."
      : "Konfirmasi perlu ditinjau kembali oleh panitia. QR presensi belum diterbitkan." };
  }
  return code === "REGISTRATION_APPROVED" || code === "REGISTRATION_AUTO_APPROVED"
    ? { ...common, ...links, email: person.email } : { ...common, ...links };
}

async function queueRegistrationEmails(code: string, event: Pick<RegistrationEvent, "id" | "name">,
  recipients: Recipient[], key: string, version?: number, dispatch?: RegistrationEmailDispatch) {
  const deliverable = recipients.filter((person) => person.email);
  if (!deliverable.length) return 0;
  const db = getDbClient();
  const templateDefinition = TEMPLATE_WHITELISTS[code];
  await db.insert(emailTemplates).values({ code, name: code, subjectTemplate: templateDefinition.subjectTemplate,
    bodyTemplate: templateDefinition.bodyTemplate, status: "ACTIVE" }).onConflictDoNothing({ target: emailTemplates.code });
  const [template] = await db.select({ id: emailTemplates.id }).from(emailTemplates).where(eq(emailTemplates.code, code)).limit(1);
  const subject = renderEmailTemplate(code, { eventName: event.name }).subject;
  const inserted = await db.insert(emailJobs).values(deliverable.map((person) => ({
    eventId: event.id, templateId: template.id, recipientEmail: person.email, recipientName: person.ustadzName,
    status: "QUEUED", scheduledAt: new Date(),
    idempotencyKey: `${key}_${person.participantId}${version ? `_v${version}` : ""}`,
    // Links and message body are derived from current state at delivery time.
    payload: { templateCode: code, participantId: person.participantId, expectedVersion: version, subject },
  }))).onConflictDoNothing({ target: emailJobs.idempotencyKey }).returning({ id: emailJobs.id });
  const ids = inserted.map(({ id }) => id);
  if (dispatch) dispatch.jobIds.push(...ids);
  else await flushRegistrationEmailDispatch({ jobIds: ids });
  return inserted.length;
}

export function queueRegistrationReceivedEmails(event: Pick<RegistrationEvent, "id" | "name">, recipients: Recipient[], dispatch?: RegistrationEmailDispatch) {
  return queueRegistrationEmails("REGISTRATION_RECEIVED", event, recipients, "registration_received", undefined, dispatch);
}

async function getRecipient(participant: Participant): Promise<Recipient | null> {
  const [profile] = await getDbClient().select({ fullName: ustadzProfiles.fullName, email: ustadzProfiles.email })
    .from(ustadzProfiles).where(eq(ustadzProfiles.id, participant.ustadzId)).limit(1);
  return profile?.email ? { participantId: participant.id, ustadzName: profile.fullName, email: profile.email,
    participantCode: participant.participantCode } : null;
}

export async function queueApprovedParticipantCardEmail(event: RegistrationEvent, participant: Participant, dispatch?: RegistrationEmailDispatch) {
  if (participant.approvalStatus !== "APPROVED" || participant.eventId !== event.id || !isAttendanceEventOpen(event)) return 0;
  const stage = registrationStage({ ...participant, attendanceConfirmationRequired: event.attendanceConfirmationRequired });
  if (stage !== "AWAITING_CONFIRMATION" && stage !== "READY") return 0;
  const person = await getRecipient(participant);
  if (!person) return 0;
  return stage === "AWAITING_CONFIRMATION"
    ? queueRegistrationEmails("REGISTRATION_CONFIRMATION_REQUEST", event, [person], "registration_confirmation_request", participant.qrTokenVersion, dispatch)
    : queueRegistrationEmails("REGISTRATION_APPROVED", event, [person], "registration_card", participant.qrTokenVersion, dispatch);
}

export async function queueParticipantConfirmationOutcomeEmail(event: RegistrationEvent, participant: Participant, decision: Outcome) {
  if (participant.eventId !== event.id) return 0;
  const person = await getRecipient(participant);
  if (!person) return 0;
  const code = decision === "CONFIRM" ? "PARTICIPANT_ATTENDANCE_CONFIRMED"
    : decision === "WITHDRAW" ? "PARTICIPANT_WITHDRAWN" : "PARTICIPANT_ATTENDANCE_DECLINED";
  return queueRegistrationEmails(code, event, [person], `participant_attendance_${decision.toLowerCase()}`, participant.qrTokenVersion);
}

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const legacyKey = /^(?:registration_(?:received|confirmation_request|card)|participant_attendance_(?:confirm|decline|withdraw))_([0-9a-f-]{36})(?:_v\d+)?$/i;

/** Re-render from current state; old queue payloads may contain pre-approval QR links. */
export async function prepareRegistrationEmailForDelivery(db: ReturnType<typeof getDbClient>, job: {
  eventId: string | null; recipientEmail: string; idempotencyKey: string; payload: Record<string, unknown>;
}, code: string): Promise<{ code: string; variables: Variables } | null> {
  const participantId = typeof job.payload.participantId === "string" ? job.payload.participantId : legacyKey.exec(job.idempotencyKey)?.[1];
  if (!job.eventId || !participantId || !uuid.test(participantId)) return null;
  const [row] = await db.select({
    participantId: eventParticipants.id, participantCode: eventParticipants.participantCode, qrTokenVersion: eventParticipants.qrTokenVersion,
    approvalStatus: eventParticipants.approvalStatus, confirmationStatus: eventParticipants.confirmationStatus,
    email: ustadzProfiles.email, ustadzName: ustadzProfiles.fullName,
    profileStatus: ustadzProfiles.profileStatus, profileDeletedAt: ustadzProfiles.deletedAt, profileMergedIntoId: ustadzProfiles.mergedIntoId,
    id: events.id, name: events.name, slug: events.slug, status: events.status, endDate: events.endDate, timezone: events.timezone,
    archivedAt: events.archivedAt, attendanceConfirmationRequired: events.attendanceConfirmationRequired,
    attendanceConfirmationDeadline: events.attendanceConfirmationDeadline, lateConfirmationPolicy: events.lateConfirmationPolicy,
  }).from(eventParticipants).innerJoin(events, eq(events.id, eventParticipants.eventId))
    .innerJoin(ustadzProfiles, eq(ustadzProfiles.id, eventParticipants.ustadzId))
    .where(and(eq(eventParticipants.id, participantId), eq(eventParticipants.eventId, job.eventId))).limit(1);
  if (!row?.email || row.profileStatus !== "ACTIVE" || row.profileDeletedAt || row.profileMergedIntoId ||
    row.email.trim().toLowerCase() !== job.recipientEmail.trim().toLowerCase()) return null;
  const person = { ...row, email: row.email };
  if (["PARTICIPANT_ATTENDANCE_DECLINED", "PARTICIPANT_WITHDRAWN"].includes(code)) {
    // Don't send a historical cancellation for a different moderation cycle.
    return row.confirmationStatus === "CANCELLED" &&
      (job.payload.expectedVersion == null || job.payload.expectedVersion === row.qrTokenVersion)
      ? { code, variables: emailVariables(code, row, person) } : null;
  }
  if (!isAttendanceEventOpen(row)) return null;
  const stage = registrationStage(row);
  if (stage === "INACTIVE" || stage === "DECLINED") return null;
  if (code === "REGISTRATION_RECEIVED") return { code, variables: emailVariables(code, row, person) };
  if (code === "REGISTRATION_CONFIRMATION_REQUEST") {
    if (stage !== "AWAITING_CONFIRMATION" || (row.lateConfirmationPolicy === "BLOCK" &&
      row.attendanceConfirmationDeadline && row.attendanceConfirmationDeadline < new Date())) return null;
    return { code, variables: emailVariables(code, row, person) };
  }
  if (code === "PARTICIPANT_ATTENDANCE_CONFIRMED" && row.confirmationStatus === "CONFIRMED" &&
    (stage === "READY" || stage === "REVIEWING_CONFIRMATION")) {
    return { code, variables: emailVariables(code, row, person, stage === "READY") };
  }
  if (["REGISTRATION_APPROVED", "REGISTRATION_AUTO_APPROVED", "REGISTRATION_CONFIRMED"].includes(code) && stage === "READY") {
    return { code: "REGISTRATION_APPROVED", variables: emailVariables("REGISTRATION_APPROVED", row, person) };
  }
  return null;
}
