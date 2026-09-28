import { getDbClient } from "../db/client";
import { emailJobs, emailTemplates } from "../db/schema";
import { eq } from "drizzle-orm";
import { renderEmailTemplate } from "./emailTemplateEngine";
import { cardPublicUrl } from "./participantCardService";

export type CardRecipient = { participantId: string; ustadzName: string; email: string; participantCode: string; qrToken: string };

/** One template lookup and one insert for a whole registration group. */
export async function queueParticipantCardEmails(event: { id: string; name: string }, recipients: CardRecipient[]) {
  if (!recipients.length) return 0;
  const db = getDbClient();
  const code = "REGISTRATION_AUTO_APPROVED";
  await db.insert(emailTemplates).values({ code, name: "Kartu peserta dan QR pribadi",
    subjectTemplate: "Kartu peserta dan QR", bodyTemplate: "Kartu peserta daurah", status: "ACTIVE" })
    .onConflictDoNothing({ target: emailTemplates.code });
  const [template] = await db.select({ id: emailTemplates.id }).from(emailTemplates).where(eq(emailTemplates.code, code)).limit(1);
  const portalLink = new URL("/login/ustadz", process.env.APP_URL || process.env.URL || "http://localhost:3000").toString();
  const jobs = recipients.map((person) => {
    const variables = { ustadzName: person.ustadzName, eventName: event.name, participantCode: person.participantCode,
      email: person.email, cardLink: cardPublicUrl(person.qrToken), portalLink };
    const rendered = renderEmailTemplate(code, variables);
    return { eventId: event.id, templateId: template.id, recipientEmail: person.email, recipientName: person.ustadzName,
      status: "QUEUED", scheduledAt: new Date(), idempotencyKey: `registration_card_${person.participantId}`,
      payload: { templateCode: code, variables, subject: rendered.subject, bodyText: rendered.body } };
  });
  const inserted = await db.insert(emailJobs).values(jobs).onConflictDoNothing({ target: emailJobs.idempotencyKey }).returning({ id: emailJobs.id });
  return inserted.length;
}
