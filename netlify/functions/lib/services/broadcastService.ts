import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, like, isNull, or, sql, inArray } from "drizzle-orm";
import { getDbClient } from "../db/client";
import { emailJobs, emailTemplates, ustadzProfiles } from "../db/schema";
import { ConflictError, NotFoundError, ValidationError } from "../utils/errors";
import { createAuditLog } from "./auditService";
import { emailDeliveries } from "../db/schema";
import { sendTransactionalEmail } from "./emailTransport";
import { renderBrandedTextEmailHtml } from "./emailHtmlTemplates";

const PREFIX = "BC_ASATIDZ_";
export const broadcastVariables = ["nama", "email"] as const;

export function renderBroadcast(text: string, recipient: { nama: string; email: string }) {
  return text.replace(/{{\s*(nama|email)\s*}}/gi, (_, key: string) =>
    recipient[key.toLowerCase() as keyof typeof recipient]);
}

export function validateBroadcastContent(subject: string, body: string) {
  const tokens = `${subject} ${body}`.match(/{{[^{}]*}}/g) || [];
  const remainder = `${subject} ${body}`.replace(/{{[^{}]*}}/g, "");
  if (tokens.some((token) => !/^{{\s*(nama|email)\s*}}$/i.test(token)) || /{{|}}/.test(remainder)) {
    throw new ValidationError("Variabel yang diizinkan hanya {{nama}} dan {{email}}.");
  }
}

export async function listBroadcastTemplates() {
  return getDbClient().select().from(emailTemplates)
    .where(like(emailTemplates.code, "BC\\_ASATIDZ\\_%")).orderBy(asc(emailTemplates.name));
}

export async function saveBroadcastTemplate(input: { id?: string; name: string; subject: string; body: string }) {
  validateBroadcastContent(input.subject, input.body);
  const db = getDbClient();
  if (input.id) {
    const existing = (await db.select().from(emailTemplates).where(eq(emailTemplates.id, input.id)).limit(1))[0];
    if (!existing || !existing.code.startsWith(PREFIX)) throw new NotFoundError("Template BC tidak ditemukan.");
    return (await db.update(emailTemplates).set({ name: input.name, subjectTemplate: input.subject,
      bodyTemplate: input.body, version: existing.version + 1, updatedAt: new Date() })
      .where(eq(emailTemplates.id, input.id)).returning())[0];
  }
  return (await db.insert(emailTemplates).values({ code: `${PREFIX}${randomUUID()}`,
    name: input.name, subjectTemplate: input.subject, bodyTemplate: input.body, status: "ACTIVE" }).returning())[0];
}

export function broadcastDates(start: Date, frequency: "ONCE" | "WEEKLY" | "MONTHLY", occurrences: number) {
  return Array.from({ length: frequency === "ONCE" ? 1 : occurrences }, (_, index) => {
    const date = new Date(start);
    if (frequency === "WEEKLY") date.setUTCDate(date.getUTCDate() + 7 * index);
    if (frequency === "MONTHLY") {
      date.setUTCDate(1);
      date.setUTCMonth(date.getUTCMonth() + index);
      const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
      date.setUTCDate(Math.min(start.getUTCDate(), lastDay));
    }
    return date;
  });
}

export function planBroadcastSlots(starts: Date[], recipientCount: number, dailyLimit: number) {
  if (!Number.isInteger(dailyLimit) || dailyLimit < 1 || !Number.isInteger(recipientCount) || recipientCount < 0) {
    throw new ValidationError("Jumlah email per hari tidak valid.");
  }
  const used = new Map<string, number>();
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta",
    year: "numeric", month: "2-digit", day: "2-digit" });
  return starts.map((start) => {
    let cursor = new Date(start);
    return Array.from({ length: recipientCount }, () => {
      let key = formatter.format(cursor);
      while ((used.get(key) || 0) >= dailyLimit) {
        cursor = new Date(cursor.getTime() + 86_400_000);
        key = formatter.format(cursor);
      }
      used.set(key, (used.get(key) || 0) + 1);
      return new Date(cursor);
    });
  });
}

export function broadcastHtml(body: string) {
  return renderBrandedTextEmailHtml(body, "BC Sapaan Asatidz");
}

export async function getBroadcastTransportStatus() {
  const provider = process.env.EMAIL_PROVIDER?.toUpperCase() === "SMTP" ? "SMTP" : "MAILKETING";
  const configured = provider === "SMTP"
    ? Boolean(process.env.EMAIL_PASS && process.env.EMAIL_PASS !== "GANTI_DENGAN_PASSWORD_EMAIL")
    : Boolean(process.env.MAILKETING_API_TOKEN?.trim() && process.env.MAILKETING_FROM_EMAIL?.trim());
  const db = getDbClient();
  const [lastTest] = await db.select({
    status: emailJobs.status, recipientEmail: emailJobs.recipientEmail,
    attemptedAt: emailJobs.updatedAt, lastError: emailJobs.lastError,
    provider: sql<string | null>`${emailJobs.payload}->>'provider'`,
  }).from(emailJobs).where(sql`${emailJobs.payload}->>'isTest' = 'true'`)
    .orderBy(desc(emailJobs.createdAt)).limit(1);
  return {
    provider, configured, workerEnabled: process.env.EMAIL_WORKER_ENABLED === "true",
    // Accepted by the provider is not a delivery receipt from the recipient's inbox.
    lastTest: lastTest || null,
  };
}

export async function sendBroadcastTest(input: {
  templateId?: string; campaignId?: string; recipientEmail: string; recipientName?: string;
}, actorUserId: string, requestId: string) {
  const db = getDbClient();
  let template;
  let subjectTemplate: string;
  let bodyTemplate: string;
  if (input.campaignId) {
    const [sample] = await db.select().from(emailJobs).where(and(
      sql`${emailJobs.payload}->>'campaignId' = ${input.campaignId}`,
      sql`${emailJobs.payload}->>'isTest' is distinct from 'true'`,
    )).limit(1);
    if (!sample) throw new NotFoundError("Kampanye BC tidak ditemukan.");
    template = (await db.select().from(emailTemplates).where(eq(emailTemplates.id, sample.templateId)).limit(1))[0];
    const snapshot = sample.payload as Record<string, unknown>;
    subjectTemplate = String(snapshot.subjectTemplate || template?.subjectTemplate || "");
    bodyTemplate = String(snapshot.bodyTemplate || template?.bodyTemplate || "");
  } else {
    template = (await db.select().from(emailTemplates).where(eq(emailTemplates.id, input.templateId!)).limit(1))[0];
    subjectTemplate = template?.subjectTemplate || "";
    bodyTemplate = template?.bodyTemplate || "";
  }
  if (!template || !template.code.startsWith(PREFIX) || template.status !== "ACTIVE") {
    throw new NotFoundError("Template BC aktif tidak ditemukan.");
  }
  const recipient = { nama: input.recipientName || "Admin", email: input.recipientEmail.trim().toLowerCase() };
  const subject = `[UJI BC] ${renderBroadcast(subjectTemplate, recipient)}`;
  const bodyText = `${renderBroadcast(bodyTemplate, recipient)}\n\n---\nIni adalah uji kirim kampanye. Tidak termasuk pengiriman ke daftar asatidz.`;
  const [job] = await db.insert(emailJobs).values({
    templateId: template.id,
    recipientEmail: recipient.email,
    recipientName: recipient.nama,
    payload: { templateCode: "BROADCAST_CUSTOM", isTest: true, campaignId: input.campaignId || null,
      templateName: template.name, subject, bodyText },
    status: "PROCESSING", scheduledAt: new Date(), attemptCount: 1, maxAttempts: 1,
    idempotencyKey: `bc-test:${randomUUID()}`,
  }).returning({ id: emailJobs.id });

  let result: Awaited<ReturnType<typeof sendTransactionalEmail>>;
  try {
    result = await sendTransactionalEmail({ to: recipient.email, toName: recipient.nama,
      subject, textBody: bodyText, htmlBody: broadcastHtml(bodyText), requestId });
  } catch {
    result = { success: false, provider: process.env.EMAIL_PROVIDER?.toUpperCase() === "SMTP" ? "SMTP_CUSTOM" : "MAILKETING",
      error: "Koneksi penyedia email gagal. Periksa konfigurasi dan coba lagi." };
  }
  if (result.success) {
    await db.insert(emailDeliveries).values({ emailJobId: job.id, provider: result.provider,
      providerMessageId: result.messageId || null, status: "ACCEPTED", sentAt: new Date() });
  }
  await db.update(emailJobs).set({ status: result.success ? "SENT" : "FAILED",
    lastError: result.success ? null : result.error || "Penyedia menolak email uji.",
    payload: { templateCode: "BROADCAST_CUSTOM", isTest: true, campaignId: input.campaignId || null,
      templateName: template.name, subject, bodyText, provider: result.provider },
    updatedAt: new Date() }).where(eq(emailJobs.id, job.id));
  await createAuditLog({ actorUserId, action: "BROADCAST_TEST_ATTEMPTED", resourceType: "EMAIL_JOB",
    resourceId: job.id, reason: `Uji kirim ke ${recipient.email}: ${result.success ? "diterima penyedia" : "gagal"}.`, requestId });
  return { jobId: job.id, status: result.success ? "ACCEPTED" : "FAILED", provider: result.provider,
    providerMessageId: result.messageId || null, error: result.success ? null : result.error || "Penyedia menolak email uji." };
}

async function getBroadcastAudience() {
  const db = getDbClient();
  const people = await db.select({ id: ustadzProfiles.id, nama: ustadzProfiles.fullName,
    email: ustadzProfiles.email }).from(ustadzProfiles).where(and(
    eq(ustadzProfiles.profileStatus, "ACTIVE"), isNull(ustadzProfiles.deletedAt),
  )).orderBy(asc(ustadzProfiles.id));
  const unique = new Map<string, { id: string; nama: string; email: string }>();
  let noEmail = 0;
  let duplicate = 0;
  for (const person of people) {
    const email = person.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) noEmail++;
    else if (unique.has(email)) duplicate++;
    else unique.set(email, { id: person.id, nama: person.nama, email });
  }
  return { unique, noEmail, duplicate };
}

export async function getBroadcastAudienceSummary() {
  const { unique, noEmail, duplicate } = await getBroadcastAudience();
  return { recipientCount: unique.size, withoutValidEmail: noEmail, duplicateEmails: duplicate };
}

export async function listBroadcastCampaigns() {
  const campaign = sql<string>`${emailJobs.payload}->>'campaignId'`;
  const db = getDbClient();
  return db.select({
    campaignId: campaign,
    templateName: sql<string>`max(${emailJobs.payload}->>'templateName')`,
    dailyLimit: sql<number | null>`max((${emailJobs.payload}->>'dailyLimit')::int)`,
    total: sql<number>`count(*) filter (where ${emailJobs.payload}->>'isTest' is distinct from 'true')::int`,
    queued: sql<number>`count(*) filter (where ${emailJobs.status} in ('QUEUED', 'PENDING') and ${emailJobs.payload}->>'isTest' is distinct from 'true')::int`,
    sent: sql<number>`count(*) filter (where ${emailJobs.status} = 'SENT' and coalesce(${emailDeliveries.status}, 'ACCEPTED') not in ('BOUNCED', 'COMPLAINED') and ${emailJobs.payload}->>'isTest' is distinct from 'true')::int`,
    delivered: sql<number>`count(*) filter (where ${emailDeliveries.status} = 'DELIVERED' and ${emailJobs.payload}->>'isTest' is distinct from 'true')::int`,
    failed: sql<number>`count(*) filter (where (${emailJobs.status} in ('FAILED', 'DEAD_LETTER') or ${emailDeliveries.status} in ('BOUNCED', 'COMPLAINED')) and ${emailJobs.payload}->>'isTest' is distinct from 'true')::int`,
    processing: sql<number>`count(*) filter (where ${emailJobs.status} = 'PROCESSING' and ${emailJobs.payload}->>'isTest' is distinct from 'true')::int`,
    cancelled: sql<number>`count(*) filter (where ${emailJobs.status} = 'CANCELLED' and ${emailJobs.payload}->>'isTest' is distinct from 'true')::int`,
    testSent: sql<number>`count(*) filter (where ${emailJobs.payload}->>'isTest' = 'true' and ${emailJobs.status} = 'SENT')::int`,
    testFailed: sql<number>`count(*) filter (where ${emailJobs.payload}->>'isTest' = 'true' and ${emailJobs.status} = 'FAILED')::int`,
    lastTestAt: sql<Date | null>`max(${emailJobs.createdAt}) filter (where ${emailJobs.payload}->>'isTest' = 'true')`,
    firstScheduledAt: sql<Date>`min(${emailJobs.scheduledAt}) filter (where ${emailJobs.payload}->>'isTest' is distinct from 'true')`,
    lastScheduledAt: sql<Date>`max(${emailJobs.scheduledAt}) filter (where ${emailJobs.payload}->>'isTest' is distinct from 'true')`,
    createdAt: sql<Date>`min(${emailJobs.createdAt})`,
  }).from(emailJobs).leftJoin(emailDeliveries, eq(emailDeliveries.emailJobId, emailJobs.id))
    .where(sql`${campaign} is not null`)
    .groupBy(campaign).orderBy(desc(sql`min(${emailJobs.createdAt})`)).limit(30);
}

export async function getBroadcastCampaignJobs(campaignId: string, page: number, status: string) {
  const db = getDbClient();
  const condition = and(
    sql`${emailJobs.payload}->>'campaignId' = ${campaignId}`,
    sql`${emailJobs.payload}->>'isTest' is distinct from 'true'`,
    status === "ALL" ? undefined : status === "FAILED"
      ? or(inArray(emailJobs.status, ["FAILED", "DEAD_LETTER"]), sql`exists (
          select 1 from email_deliveries d where d.email_job_id = ${emailJobs.id}
          and d.status in ('BOUNCED', 'COMPLAINED'))`)
      : status === "QUEUED" ? inArray(emailJobs.status, ["QUEUED", "PENDING"])
        : eq(emailJobs.status, status),
  );
  const [totalRow] = await db.select({ count: sql<number>`count(*)::int` }).from(emailJobs).where(condition);
  const items = await db.select({
    id: emailJobs.id, recipientEmail: emailJobs.recipientEmail, recipientName: emailJobs.recipientName,
    status: emailJobs.status, scheduledAt: emailJobs.scheduledAt, updatedAt: emailJobs.updatedAt,
    attemptCount: emailJobs.attemptCount, lastError: emailJobs.lastError,
    deliveryStatus: emailDeliveries.status, provider: emailDeliveries.provider,
  }).from(emailJobs).leftJoin(emailDeliveries, eq(emailDeliveries.emailJobId, emailJobs.id))
    .where(condition).orderBy(asc(emailJobs.scheduledAt), asc(emailJobs.id)).limit(50).offset((page - 1) * 50);
  return { total: totalRow?.count || 0, page, pageSize: 50, items };
}

export async function cancelBroadcastCampaign(campaignId: string, actorUserId: string, requestId: string) {
  const db = getDbClient();
  const updated = await db.update(emailJobs).set({ status: "CANCELLED", updatedAt: new Date() })
    .where(and(sql`${emailJobs.payload}->>'campaignId' = ${campaignId}`,
      sql`${emailJobs.payload}->>'isTest' is distinct from 'true'`,
      or(eq(emailJobs.status, "QUEUED"), eq(emailJobs.status, "PENDING")))).returning({ id: emailJobs.id });
  if (updated.length === 0) throw new ValidationError("Tidak ada email terjadwal yang dapat dibatalkan pada kampanye ini.");
  await createAuditLog({ actorUserId, action: "BROADCAST_CANCELLED", resourceType: "EMAIL_CAMPAIGN",
    resourceId: campaignId, reason: `${updated.length} pengiriman yang belum diproses dibatalkan.`, requestId });
  return { cancelledCount: updated.length };
}

export async function scheduleBroadcast(input: {
  campaignId?: string; templateId: string; scheduledAt: string; frequency: "ONCE" | "WEEKLY" | "MONTHLY"; occurrences: number; dailyLimit: number;
}, actorUserId?: string, requestId?: string) {
  const db = getDbClient();
  const template = (await db.select().from(emailTemplates).where(eq(emailTemplates.id, input.templateId)).limit(1))[0];
  if (!template || !template.code.startsWith(PREFIX) || template.status !== "ACTIVE") {
    throw new NotFoundError("Template BC aktif tidak ditemukan.");
  }
  const start = new Date(input.scheduledAt);
  if (Number.isNaN(start.getTime())) throw new ValidationError("Tanggal pengiriman tidak valid.");
  const campaignId = input.campaignId || randomUUID();
  const configuration = { templateId: input.templateId, scheduledAt: start.toISOString(),
    frequency: input.frequency, occurrences: input.occurrences, dailyLimit: input.dailyLimit };
  const [existingCampaignJob] = await db.select({ payload: emailJobs.payload }).from(emailJobs)
    .where(sql`${emailJobs.payload}->>'campaignId' = ${campaignId}`).limit(1);
  if (existingCampaignJob && JSON.stringify((existingCampaignJob.payload as Record<string, unknown>).configuration) !== JSON.stringify(configuration)) {
    throw new ConflictError("ID kampanye sudah digunakan untuk jadwal berbeda. Segarkan halaman lalu buat jadwal baru.");
  }
  if (!existingCampaignJob && start.getTime() < Date.now() + 60_000) {
    throw new ValidationError("Waktu kirim harus sekurangnya satu menit dari sekarang.");
  }
  const { unique } = await getBroadcastAudience();
  if (!unique.size) throw new ValidationError("Belum ada profil asatidz aktif dengan email valid.");
  const dates = broadcastDates(start, input.frequency, input.occurrences);
  const recipientCount = unique.size;
  if (recipientCount * dates.length > 5000) throw new ValidationError("Maksimal 5.000 email per jadwal. Kurangi jumlah pengulangan.");
  const slots = planBroadcastSlots(dates, recipientCount, input.dailyLimit);
  const jobs = dates.flatMap((_, occurrence) => [...unique.values()].map((person, index) => ({
    templateId: template.id,
    recipientEmail: person.email,
    recipientName: person.nama,
    payload: { templateCode: "BROADCAST_CUSTOM", campaignId, templateName: template.name,
      dailyLimit: input.dailyLimit, configuration, subjectTemplate: template.subjectTemplate, bodyTemplate: template.bodyTemplate,
      subject: renderBroadcast(template.subjectTemplate, person),
      bodyText: renderBroadcast(template.bodyTemplate, person) },
    scheduledAt: slots[occurrence][index],
    status: "QUEUED",
    idempotencyKey: `bc:${campaignId}:${occurrence}:${person.id}`,
  })));
  // A campaign has a bounded number of jobs so API requests cannot create an unbounded queue.
  let insertedCount = 0;
  for (let index = 0; index < jobs.length; index += 100) {
    const inserted = await db.insert(emailJobs).values(jobs.slice(index, index + 100))
      .onConflictDoNothing({ target: emailJobs.idempotencyKey }).returning({ id: emailJobs.id });
    insertedCount += inserted.length;
  }
  if (requestId && insertedCount > 0) await createAuditLog({ actorUserId: actorUserId || null, action: "BROADCAST_SCHEDULED",
    resourceType: "EMAIL_CAMPAIGN", resourceId: campaignId,
    reason: `${jobs.length} email dijadwalkan untuk ${unique.size} penerima dalam ${dates.length} pengiriman.`, requestId });
  return { campaignId, recipientCount, occurrenceCount: dates.length, dailyLimit: input.dailyLimit,
    jobCount: jobs.length, firstScheduledAt: dates[0], lastScheduledAt: jobs.at(-1)?.scheduledAt };
}
