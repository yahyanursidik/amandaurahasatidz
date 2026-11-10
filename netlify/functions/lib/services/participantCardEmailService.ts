import { getDbClient } from "../db/client";
import { emailJobs, emailTemplates, ustadzProfiles } from "../db/schema";
import { eq } from "drizzle-orm";
import { renderEmailTemplate } from "./emailTemplateEngine";
import { cardPublicUrl, signCardForParticipant } from "./participantCardService";

export type CardRecipient = { participantId: string; ustadzName: string; email: string; participantCode: string; qrToken: string };

export async function queueRegistrationReceivedEmails(event: { id: string; name: string; slug: string }, recipients: CardRecipient[]) {
  if (!recipients.length) return 0;
  const db = getDbClient();
  const code = "REGISTRATION_RECEIVED";
  await db.insert(emailTemplates).values({ code, name: "Pendaftaran menunggu peninjauan",
    subjectTemplate: "Pendaftaran menunggu peninjauan", bodyTemplate: "Pendaftaran diterima untuk ditinjau", status: "ACTIVE" })
    .onConflictDoNothing({ target: emailTemplates.code });
  const [template] = await db.select({ id: emailTemplates.id }).from(emailTemplates).where(eq(emailTemplates.code, code)).limit(1);
  const origin = process.env.APP_URL || process.env.URL || "http://localhost:3000";
  const portalLink = new URL("/login/ustadz", origin).toString();
  const rundownLink = new URL(`/events/${encodeURIComponent(event.slug)}#jadwal-kegiatan`, origin).toString();
  const jobs = recipients.filter((person) => person.email).map((person) => {
    const variables = { ustadzName: person.ustadzName, eventName: event.name,
      participantCode: person.participantCode, cardLink: cardPublicUrl(person.qrToken), rundownLink, portalLink };
    const rendered = renderEmailTemplate(code, variables);
    return { eventId: event.id, templateId: template.id, recipientEmail: person.email, recipientName: person.ustadzName,
      status: "QUEUED", scheduledAt: new Date(), idempotencyKey: `registration_received_${person.participantId}`,
      payload: { templateCode: code, variables, subject: rendered.subject, bodyText: rendered.body } };
  });
  if (!jobs.length) return 0;
  const inserted = await db.insert(emailJobs).values(jobs).onConflictDoNothing({ target: emailJobs.idempotencyKey }).returning({ id: emailJobs.id });
  return inserted.length;
}

export async function queueApprovedParticipantCardEmail(
  event: { id: string; name: string; slug: string },
  participant: { id: string; eventId: string; ustadzId: string; participantCode: string; qrTokenVersion: number },
) {
  const [profile] = await getDbClient().select({ fullName: ustadzProfiles.fullName, email: ustadzProfiles.email })
    .from(ustadzProfiles).where(eq(ustadzProfiles.id, participant.ustadzId)).limit(1);
  if (!profile?.email) return 0;
  return queueParticipantCardEmails(event, [{ participantId: participant.id, ustadzName: profile.fullName,
    email: profile.email, participantCode: participant.participantCode, qrToken: signCardForParticipant(participant) }]);
}

/** One template lookup and one insert for a whole registration group. */
export async function queueParticipantCardEmails(event: { id: string; name: string; slug: string }, recipients: CardRecipient[]) {
  if (!recipients.length) return 0;
  const db = getDbClient();
  const code = "REGISTRATION_APPROVED";
  await db.insert(emailTemplates).values({ code, name: "Kartu peserta dan QR pribadi",
    subjectTemplate: "Kartu peserta dan QR", bodyTemplate: "Kartu peserta daurah", status: "ACTIVE" })
    .onConflictDoNothing({ target: emailTemplates.code });
  const [template] = await db.select({ id: emailTemplates.id }).from(emailTemplates).where(eq(emailTemplates.code, code)).limit(1);
  const origin = process.env.APP_URL || process.env.URL || "http://localhost:3000";
  const portalLink = new URL("/login/ustadz", origin).toString();
  const rundownLink = new URL(`/events/${encodeURIComponent(event.slug)}#jadwal-kegiatan`, origin).toString();
  const jobs = recipients.map((person) => {
    const variables = { ustadzName: person.ustadzName, eventName: event.name, participantCode: person.participantCode,
      email: person.email, cardLink: cardPublicUrl(person.qrToken), portalLink, rundownLink };
    const rendered = renderEmailTemplate(code, variables);
    return { eventId: event.id, templateId: template.id, recipientEmail: person.email, recipientName: person.ustadzName,
      status: "QUEUED", scheduledAt: new Date(), idempotencyKey: `registration_card_${person.participantId}`,
      payload: { templateCode: code, variables, subject: rendered.subject, bodyText: rendered.body } };
  });
  const inserted = await db.insert(emailJobs).values(jobs).onConflictDoNothing({ target: emailJobs.idempotencyKey }).returning({ id: emailJobs.id });
  return inserted.length;
}
