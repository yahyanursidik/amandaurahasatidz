import { getDbClient } from "../db/client";
import { emailJobs, emailDeliveries, emailTemplates } from "../db/schema";
import { eq, and, desc, sql, lt, or } from "drizzle-orm";
import { renderEmailTemplate, renderHtmlEmailTemplate } from "./emailTemplateEngine";
import { sendEmailViaSMTP } from "./smtpTransport";
import { logInfo, logError } from "../utils/logger";
import { createAuditLog } from "./auditService";

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

  // Fallback dummy templateId UUID for queue insertion
  const templateId = "00000000-0000-0000-0000-000000000001";

  const inserted = await db
    .insert(emailJobs)
    .values({
      idempotencyKey: options.idempotencyKey,
      templateId,
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
        or(
          sql`${emailJobs.lockedAt} IS NULL`,
          lt(emailJobs.lockedAt, fiveMinutesAgo)
        )
      )
    )
    .limit(batchSize);

  const processedResults = [];

  for (const job of jobsToProcess) {
    // Lock job
    await db
      .update(emailJobs)
      .set({
        status: "PROCESSING",
        lockedAt: new Date(),
        lockedBy: workerId,
        attemptCount: sql`${emailJobs.attemptCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(emailJobs.id, job.id));

    try {
      const payloadObj = (job.payload as any) || {};
      const templateCode: string = payloadObj.templateCode || "";
      const variables: Record<string, any> = payloadObj.variables || {};

      // Render HTML email template untuk pengiriman nyata
      let subjectStr: string;
      let htmlBody: string;
      let textBody: string;

      try {
        const rendered = renderHtmlEmailTemplate(templateCode, variables);
        subjectStr = rendered.subject;
        htmlBody = rendered.htmlBody;
        textBody = rendered.textBody;
      } catch {
        // Fallback: gunakan payload yang sudah di-render saat enqueue
        subjectStr = payloadObj.subject || "Email Notification";
        htmlBody = `<p>${payloadObj.bodyText || ""}</p>`;
        textBody = payloadObj.bodyText || "";
      }

      logInfo(requestId, `Mengirim email ke ${job.recipientEmail}: ${subjectStr}`);

      // Kirim email nyata via SMTP
      const smtpResult = await sendEmailViaSMTP({
        to: job.recipientEmail,
        toName: job.recipientName || undefined,
        subject: subjectStr,
        htmlBody,
        textBody,
        requestId,
      });

      if (!smtpResult.success) {
        throw new Error(smtpResult.error || "SMTP send failed");
      }

      // Mark delivery success
      const delivery = await db
        .insert(emailDeliveries)
        .values({
          emailJobId: job.id,
          provider: "SMTP_CUSTOM",
          providerMessageId: smtpResult.messageId || `smtp_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          status: "DELIVERED",
          sentAt: new Date(),
          deliveredAt: new Date(),
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

      const nextAttempts = (job.attemptCount || 0) + 1;
      const isDeadLetter = nextAttempts >= (job.maxAttempts || 3);
      const nextStatus = isDeadLetter ? "DEAD_LETTER" : "FAILED";

      await db
        .update(emailJobs)
        .set({
          status: nextStatus,
          lastError: err.message || "Failed email dispatch",
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
    throw new Error(`Email job ID ${jobId} tidak ditemukan.`);
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
    .where(eq(emailJobs.id, jobId))
    .returning();

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
  return await db.select().from(emailJobs).orderBy(desc(emailJobs.createdAt)).limit(50);
}
