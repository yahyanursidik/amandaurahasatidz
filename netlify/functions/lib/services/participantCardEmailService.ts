import { getDbClient } from "../db/client";
import { emailJobs, emailTemplates, ustadzProfiles } from "../db/schema";
import { eq } from "drizzle-orm";
import { renderEmailTemplate } from "./emailTemplateEngine";
import { cardPublicUrl, signCardForParticipant } from "./participantCardService";
import { participantConfirmationUrl, signConfirmationForParticipant } from "./participantConfirmationLink";

export type CardRecipient = { participantId: string; ustadzName: string; email: string; participantCode: string; qrToken: string };

export async function queueRegistrationReceivedEmails(event: { id: string; name: string; slug: string; endDate: string; attendanceConfirmationRequired?: boolean }, recipients: CardRecipient[]) {
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
    const confirmationLink = event.attendanceConfirmationRequired !== false
      ? participantConfirmationUrl(signConfirmationForParticipant({ id: person.participantId, eventId: event.id }, event.endDate)) : "";
    const variables = { ustadzName: person.ustadzName, eventName: event.name,
      participantCode: person.participantCode, cardLink: cardPublicUrl(person.qrToken), rundownLink, portalLink,
      confirmationInstruction: confirmationLink ? `Setelah admin menyetujui, konfirmasikan kehadiran pribadi tanpa login: ${confirmationLink}` : "" };
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
  event: { id: string; name: string; slug: string; endDate: string; attendanceConfirmationRequired?: boolean },
  participant: { id: string; eventId: string; ustadzId: string; participantCode: string; qrTokenVersion: number; confirmationStatus: string },
) {
  const [profile] = await getDbClient().select({ fullName: ustadzProfiles.fullName, email: ustadzProfiles.email })
    .from(ustadzProfiles).where(eq(ustadzProfiles.id, participant.ustadzId)).limit(1);
  if (!profile?.email) return 0;
  if (event.attendanceConfirmationRequired !== false && participant.confirmationStatus !== "CONFIRMED") {
    const db = getDbClient();
    const code = "REGISTRATION_CONFIRMATION_REQUEST";
    await db.insert(emailTemplates).values({ code, name: "Persetujuan dan permintaan konfirmasi pribadi",
      subjectTemplate: "Pendaftaran disetujui — mohon konfirmasi", bodyTemplate: "Konfirmasi kehadiran pribadi", status: "ACTIVE" })
      .onConflictDoNothing({ target: emailTemplates.code });
    const [template] = await db.select({ id: emailTemplates.id }).from(emailTemplates).where(eq(emailTemplates.code, code)).limit(1);
    const origin = process.env.APP_URL || process.env.URL || "http://localhost:3000";
    const variables = { ustadzName: profile.fullName, eventName: event.name, participantCode: participant.participantCode,
      confirmationLink: participantConfirmationUrl(signConfirmationForParticipant(participant, event.endDate)),
      rundownLink: new URL(`/events/${encodeURIComponent(event.slug)}#jadwal-kegiatan`, origin).toString() };
    const rendered = renderEmailTemplate(code, variables);
    const inserted = await db.insert(emailJobs).values({ eventId: event.id, templateId: template.id,
      recipientEmail: profile.email, recipientName: profile.fullName, status: "QUEUED", scheduledAt: new Date(),
      idempotencyKey: `registration_confirmation_request_${participant.id}`,
      payload: { templateCode: code, variables, subject: rendered.subject, bodyText: rendered.body } })
      .onConflictDoNothing({ target: emailJobs.idempotencyKey }).returning({ id: emailJobs.id });
    return inserted.length;
  }
  return queueParticipantCardEmails(event, [{ participantId: participant.id, ustadzName: profile.fullName,
    email: profile.email, participantCode: participant.participantCode, qrToken: signCardForParticipant(participant) }]);
}

export async function queueParticipantConfirmationOutcomeEmail(
  event: { id: string; name: string; slug: string; endDate: string },
  participant: { id: string; eventId: string; ustadzId: string; participantCode: string; qrTokenVersion: number; approvalStatus: string },
  decision: "CONFIRM" | "DECLINE" | "WITHDRAW",
) {
  const [profile] = await getDbClient().select({ fullName: ustadzProfiles.fullName, email: ustadzProfiles.email })
    .from(ustadzProfiles).where(eq(ustadzProfiles.id, participant.ustadzId)).limit(1);
  if (!profile?.email) return 0;
  const db = getDbClient();
  const code = decision === "CONFIRM" ? "PARTICIPANT_ATTENDANCE_CONFIRMED"
    : decision === "WITHDRAW" ? "PARTICIPANT_WITHDRAWN" : "PARTICIPANT_ATTENDANCE_DECLINED";
  await db.insert(emailTemplates).values({ code, name: decision === "CONFIRM" ? "Konfirmasi kehadiran tersimpan"
    : decision === "WITHDRAW" ? "Pemberitahuan pengunduran diri" : "Pemberitahuan berhalangan hadir",
    subjectTemplate: "Status kehadiran diperbarui", bodyTemplate: "Status kehadiran pribadi", status: "ACTIVE" })
    .onConflictDoNothing({ target: emailTemplates.code });
  const [template] = await db.select({ id: emailTemplates.id }).from(emailTemplates).where(eq(emailTemplates.code, code)).limit(1);
  const origin = process.env.APP_URL || process.env.URL || "http://localhost:3000";
  const cardLink = decision === "CONFIRM" && participant.approvalStatus === "APPROVED"
    ? cardPublicUrl(signCardForParticipant(participant)) : "";
  const variables = { ustadzName: profile.fullName, eventName: event.name, participantCode: participant.participantCode,
    cardLink, cardInstruction: cardLink ? `Kartu QR pribadi: ${cardLink}` : "QR belum aktif hingga admin meninjau kembali.",
    confirmationLink: decision === "CONFIRM"
      ? participantConfirmationUrl(signConfirmationForParticipant(participant, event.endDate)) : "",
    rundownLink: new URL(`/events/${encodeURIComponent(event.slug)}#jadwal-kegiatan`, origin).toString(),
    reviewNotice: participant.approvalStatus === "PENDING_REVIEW" ? "Karena melewati batas waktu, admin akan meninjau kembali sebelum QR aktif." : "" };
  const rendered = renderEmailTemplate(code, variables);
  const inserted = await db.insert(emailJobs).values({ eventId: event.id, templateId: template.id,
    recipientEmail: profile.email, recipientName: profile.fullName, status: "QUEUED", scheduledAt: new Date(),
    idempotencyKey: `participant_attendance_${decision.toLowerCase()}_${participant.id}`,
    payload: { templateCode: code, variables, subject: rendered.subject, bodyText: rendered.body } })
    .onConflictDoNothing({ target: emailJobs.idempotencyKey }).returning({ id: emailJobs.id });
  return inserted.length;
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
