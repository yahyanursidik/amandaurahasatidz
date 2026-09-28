import { getDbClient } from "../db/client";
import { emailJobs, emailDeliveries, emailTemplates } from "../db/schema";
import { eq, and, desc, sql, lt, lte, or, gte } from "drizzle-orm";
import { renderEmailTemplate, renderHtmlEmailTemplate } from "./emailTemplateEngine";
import { sendTransactionalEmail } from "./emailTransport";
import { logInfo, logError } from "../utils/logger";
import { createAuditLog } from "./auditService";
import { ConflictError, NotFoundError } from "../utils/errors";
import { broadcastHtml } from "./broadcastService";

export function nextBroadcastDay(now = new Date()) {
  // 08:00 WIB tomorrow, independent of the server's own timezone.
  const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric",
    month: "2-digit", day: "2-digit" }).format(now);
  return new Date(Date.parse(`${key}T08:00:00+07:00`) + 86_400_000);
}

async function campaignDailyLimitReached(db: ReturnType<typeof getDbClient>, payload: Record<string, unknown>, now = new Date()) {
  const campaignId = payload.campaignId;
  const dailyLimit = payload.dailyLimit;
  if (typeof campaignId !== "string" || typeof dailyLimit !== "number" || !Number.isInteger(dailyLimit) || dailyLimit < 1) return false;
  const end = new Date(nextBroadcastDay(now).getTime() - 8 * 3_600_000);
  const start = new Date(end.getTime() - 86_400_000);
  const [result] = await db.select({ count: sql<number>`count(*)::int` }).from(emailJobs).where(and(
    sql`${emailJobs.payload}->>'campaignId' = ${campaignId}`,
    or(eq(emailJobs.status, "SENT"), eq(emailJobs.status, "PROCESSING")),
    gte(emailJobs.updatedAt, start), lt(emailJobs.updatedAt, end),
    sql`${emailJobs.payload}->>'isTest' is distinct from 'true'`,
  ));
  return (result?.count || 0) >= dailyLimit;
}

export interface EnqueueOptions {
  templateCode: string;
  recipientEmail: string;
  recipientName?: string | null;
  variables: Record<string, any>;
  idempotencyKey: string;
  maxAttempts?: number;
}

export async function enqueueEmailJob(options: EnqueueOptions) {
  const db = getDbClient();

  // 1. Idempotency Key Check (Compliance Point 5)
  const existingJob = await db
    .select()
    .from(emailJobs)
    .where(eq(emailJobs.idempotencyKey, options.idempotencyKey))
    .limit(1);

  if (existingJob.length > 0) {
    logInfo("EMAIL_QUEUE", `Email job with idempotencyKey '${options.idempotencyKey}' already exists. Skipping duplicate.`);
    return { job: existingJob[0], isDuplicate: true };
  }

  // Render template with variable whitelist (plain text for payload storage)
  const rendered = renderEmailTemplate(options.templateCode, options.variables);

  let template = (
    await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.code, options.templateCode))
      .limit(1)
  )[0];
  if (!template) {
    template = (
      await db
        .insert(emailTemplates)
        .values({
          code: options.templateCode,
          name: options.templateCode === "OTP_CODE" ? "Kode verifikasi akun" : options.templateCode,
          subjectTemplate: rendered.subject,
          bodyTemplate: rendered.body,
          status: "ACTIVE",
        })
        .returning()
    )[0];
  }

  const inserted = await db
    .insert(emailJobs)
    .values({
      idempotencyKey: options.idempotencyKey,
      templateId: template.id,
      recipientEmail: options.recipientEmail,
      recipientName: options.recipientName || null,
      payload: {
        templateCode: options.templateCode,
        variables: options.variables,
        subject: rendered.subject,
        bodyText: rendered.body,
      },
      status: "QUEUED",
      scheduledAt: new Date(),
      maxAttempts: options.maxAttempts || 3,
      attemptCount: 0,
    })
    .returning();

  return { job: inserted[0], isDuplicate: false };
}

export async function processEmailQueueWorker(workerId = "worker-1", batchSize = 10, requestId = "req-worker") {
  const db = getDbClient();
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60000);

  // 2. Safe Locking Query (Compliance Point 4)
  const jobsToProcess = await db
    .select()
    .from(emailJobs)
    .where(
      and(
        or(eq(emailJobs.status, "QUEUED"), eq(emailJobs.status, "PENDING")),
        lte(emailJobs.scheduledAt, new Date()),
        or(
          sql`${emailJobs.lockedAt} IS NULL`,
          lt(emailJobs.lockedAt, fiveMinutesAgo)
        )
      )
    )
    .limit(batchSize);

  const processedResults = [];

  for (const job of jobsToProcess) {
    const payloadObj = (job.payload as Record<string, unknown>) || {};
    if (await campaignDailyLimitReached(db, payloadObj)) {
      await db.update(emailJobs).set({ scheduledAt: nextBroadcastDay(), updatedAt: new Date() })
        .where(and(eq(emailJobs.id, job.id), or(eq(emailJobs.status, "QUEUED"), eq(emailJobs.status, "PENDING"))));
      processedResults.push({ jobId: job.id, status: "DEFERRED", reason: "Batas email harian kampanye tercapai." });
      continue;
    }
    // Claim atomically: a second worker must not send the same job.
    const claimed = await db
      .update(emailJobs)
      .set({
        status: "PROCESSING",
        lockedAt: new Date(),
        lockedBy: workerId,
        attemptCount: sql`${emailJobs.attemptCount} + 1`,
        updatedAt: new Date(),
      })
      .where(and(
        eq(emailJobs.id, job.id),
        or(eq(emailJobs.status, "QUEUED"), eq(emailJobs.status, "PENDING")),
        lte(emailJobs.scheduledAt, new Date()),
        or(sql`${emailJobs.lockedAt} IS NULL`, lt(emailJobs.lockedAt, fiveMinutesAgo)),
      ))
      .returning({ attemptCount: emailJobs.attemptCount });
    if (claimed.length === 0) continue;

    try {
      const templateCode = String(payloadObj.templateCode || "");
      const variables: Record<string, any> = (payloadObj.variables as Record<string, any>) || {};

      // Render HTML email template untuk pengiriman nyata
      let subjectStr: string;
      let htmlBody: string;
      let textBody: string;

        if (templateCode === "BROADCAST_CUSTOM") {
          subjectStr = String(payloadObj.subject || "Sapaan untuk Asatidz");
          textBody = String(payloadObj.bodyText || "");
          htmlBody = broadcastHtml(textBody);
        } else {
          try {
            const rendered = renderHtmlEmailTemplate(templateCode, variables);
            subjectStr = rendered.subject;
            htmlBody = rendered.htmlBody;
            textBody = rendered.textBody;
          } catch {
            subjectStr = String(payloadObj.subject || "Email Notification");
            textBody = String(payloadObj.bodyText || "");
            htmlBody = broadcastHtml(textBody);
          }
        }

      logInfo(requestId, `Mengirim email ke ${job.recipientEmail}: ${subjectStr}`);

      const sendResult = await sendTransactionalEmail({
        to: job.recipientEmail,
        toName: job.recipientName || undefined,
        subject: subjectStr,
        htmlBody,
        textBody,
        requestId,
      });

      if (!sendResult.success) {
        throw Object.assign(new Error(sendResult.error || "Pengiriman email gagal"), { retryable: sendResult.retryable === true });
      }

      // Mark delivery success
      const delivery = await db
        .insert(emailDeliveries)
        .values({
          emailJobId: job.id,
          provider: sendResult.provider,
          providerMessageId: sendResult.messageId || `${sendResult.provider.toLowerCase()}_${job.id}`,
          status: "ACCEPTED",
          sentAt: new Date(),
        })
        .returning();

      await db
        .update(emailJobs)
        .set({
          status: "SENT",
          lockedAt: null,
          lockedBy: null,
          updatedAt: new Date(),
        })
        .where(eq(emailJobs.id, job.id));

      processedResults.push({ jobId: job.id, status: "SENT", deliveryId: delivery[0].id });
    } catch (err: any) {
      logError(requestId, `Failed sending email job ${job.id}`, err);

      const nextAttempts = claimed[0].attemptCount;
      const isDeadLetter = nextAttempts >= (job.maxAttempts || 3);
      const nextStatus = isDeadLetter ? "DEAD_LETTER" : err.retryable === true ? "QUEUED" : "FAILED";

      await db
        .update(emailJobs)
        .set({
          status: nextStatus,
          lastError: err.message || "Failed email dispatch",
          scheduledAt: nextStatus === "QUEUED" ? new Date(Date.now() + Math.min(30, 2 ** nextAttempts) * 60_000) : job.scheduledAt,
          lockedAt: null,
          lockedBy: null,
          updatedAt: new Date(),
        })
        .where(eq(emailJobs.id, job.id));

      if (isDeadLetter) {
        await createAuditLog({
          actorUserId: null,
          action: "EMAIL_JOB_DEAD_LETTER",
          resourceType: "EMAIL_JOB",
          resourceId: job.id,
          reason: `Email job ${job.id} beralih ke DEAD_LETTER setelah ${nextAttempts} retries gagal. Error: ${err.message}`,
          requestId,
        });
      }

      processedResults.push({ jobId: job.id, status: nextStatus, error: err.message });
    }
  }

  return {
    processedCount: processedResults.length,
    results: processedResults,
  };
}

export async function retryEmailJobService(jobId: string, actorUserId: string, requestId: string) {
  const db = getDbClient();
  const job = await db.select().from(emailJobs).where(eq(emailJobs.id, jobId)).limit(1);

  if (job.length === 0) {
    throw new NotFoundError("Email job tidak ditemukan.");
  }
  if (job[0].status !== "FAILED" && job[0].status !== "DEAD_LETTER") {
    throw new ConflictError("Hanya email berstatus gagal yang dapat diantrekan ulang.");
  }

  const updated = await db
    .update(emailJobs)
    .set({
      status: "QUEUED",
      attemptCount: 0,
      lastError: null,
      lockedAt: null,
      lockedBy: null,
      updatedAt: new Date(),
    })
    .where(and(eq(emailJobs.id, jobId), or(eq(emailJobs.status, "FAILED"), eq(emailJobs.status, "DEAD_LETTER"))))
    .returning();
  if (!updated[0]) throw new ConflictError("Status email berubah. Segarkan antrean lalu coba lagi.");

  await createAuditLog({
    actorUserId,
    action: "EMAIL_JOB_MANUAL_RETRY",
    resourceType: "EMAIL_JOB",
    resourceId: jobId,
    reason: `Manual retry dipemicu untuk email job ${jobId}.`,
    requestId,
  });

  return updated[0];
}

export async function getEmailJobsDashboardService() {
  const db = getDbClient();
  return await db
    .select({
      id: emailJobs.id,
      recipientEmail: emailJobs.recipientEmail,
      recipientName: emailJobs.recipientName,
      templateName: sql<string | null>`${emailJobs.payload}->>'templateName'`,
      subject: sql<string | null>`${emailJobs.payload}->>'subject'`,
      status: emailJobs.status,
      scheduledAt: emailJobs.scheduledAt,
      createdAt: emailJobs.createdAt,
      updatedAt: emailJobs.updatedAt,
      attemptCount: emailJobs.attemptCount,
      maxAttempts: emailJobs.maxAttempts,
      lastError: emailJobs.lastError,
    })
    .from(emailJobs)
    .orderBy(desc(emailJobs.createdAt))
    .limit(50);
}
