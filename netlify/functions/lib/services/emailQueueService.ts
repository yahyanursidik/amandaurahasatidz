import { getDbClient } from "../db/client";
import { emailJobs, emailDeliveries, emailTemplates } from "../db/schema";
import { eq, and, asc, desc, sql, lt, lte, or, gte, isNull, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { renderEmailTemplate, renderHtmlEmailTemplate } from "./emailTemplateEngine";
import { sendTransactionalEmail } from "./emailTransport";
import { logInfo, logError } from "../utils/logger";
import { createAuditLog } from "./auditService";
import { ConflictError, NotFoundError } from "../utils/errors";
import { broadcastHtml } from "./broadcastService";
import { getTransactionalEmailSettings } from "./transactionalEmailSettingsService";
import type { TransactionalEmailCopy } from "./transactionalEmailCopy";
import { isRegistrationWorkflowEmail, prepareRegistrationEmailForDelivery } from "./participantCardEmailService";

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
  eventId?: string;
  renderedContent?: { subject: string; bodyText: string; htmlBody: string };
  templateCode: string;
  recipientEmail: string;
  recipientName?: string | null;
  variables: Record<string, any>;
  idempotencyKey: string;
  maxAttempts?: number;
}

const UNCERTAIN_DELIVERY = "Status penerimaan belum diketahui. Periksa penyedia sebelum mencoba ulang; pengiriman sebelumnya mungkin berhasil.";
const LEGACY_PASSWORD_OTP = "Kode aktivasi lama tidak dikirim. Minta kode baru dari halaman masuk.";
const expiredQueuedOtp = (job: { payload: unknown; idempotencyKey: string; createdAt: Date }, now = new Date()) => {
  const payload = job.payload as { templateCode?: string; variables?: { expiresMinutes?: number | string } } | null;
  if (payload?.templateCode !== "OTP_CODE") return null;
  if (job.idempotencyKey.startsWith("password_setup_")) return LEGACY_PASSWORD_OTP;
  const minutes = Number(payload.variables?.expiresMinutes || 5);
  if (!Number.isFinite(minutes) || minutes <= 0 || now.getTime() + 15_000 >= job.createdAt.getTime() + minutes * 60_000) {
    return "Kode verifikasi kedaluwarsa atau hampir kedaluwarsa. Minta kode baru.";
  }
  return null;
};

async function settleStaleEmailClaims(db: ReturnType<typeof getDbClient>, cutoff: Date, batchSize: number) {
  const staleClaim = and(eq(emailJobs.status, "PROCESSING"),
    lt(sql`coalesce(${emailJobs.lockedAt}, ${emailJobs.updatedAt})`, cutoff));
  const stale = await db.select({ id: emailJobs.id, payload: emailJobs.payload, idempotencyKey: emailJobs.idempotencyKey,
    createdAt: emailJobs.createdAt }).from(emailJobs).where(staleClaim).limit(batchSize);
  const results: Array<{ jobId: string; status: string; reason?: string; error?: string; deliveryId?: string }> = [];
  for (const job of stale) {
    // The provider may have accepted the email just before execution stopped. Check only the current attempt.
    const accepted = sql`exists (select 1 from ${emailDeliveries} where ${emailDeliveries.emailJobId} = ${emailJobs.id}
      and ${emailDeliveries.sentAt} >= coalesce(${emailJobs.lockedAt}, ${emailJobs.updatedAt}))`;
    const expired = expiredQueuedOtp(job);
    const result = await db.update(emailJobs).set({
      status: sql`case when ${accepted} then 'SENT' when ${Boolean(expired)} then 'CANCELLED' else 'DELIVERY_UNCERTAIN' end`,
      lastError: sql`case when ${accepted} then null else ${expired || UNCERTAIN_DELIVERY} end`,
      lockedAt: null, lockedBy: null, updatedAt: new Date(),
    }).where(and(eq(emailJobs.id, job.id), staleClaim)).returning({ status: emailJobs.status, reason: emailJobs.lastError });
    if (result[0]) results.push({ jobId: job.id, status: result[0].status, reason: result[0].reason || undefined });
  }
  return results;
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
  const rendered = options.templateCode === "ANNOUNCEMENT_CUSTOM" && options.renderedContent
    ? { subject: options.renderedContent.subject, body: options.renderedContent.bodyText }
    : renderEmailTemplate(options.templateCode, options.variables);

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
        .onConflictDoNothing({ target: emailTemplates.code })
        .returning()
    )[0];
    if (!template) template = (await db.select().from(emailTemplates).where(eq(emailTemplates.code, options.templateCode)).limit(1))[0];
  }

  const inserted = await db
    .insert(emailJobs)
    .values({
      idempotencyKey: options.idempotencyKey,
      templateId: template.id,
      eventId: options.eventId || null,
      recipientEmail: options.recipientEmail,
      recipientName: options.recipientName || null,
      payload: {
        templateCode: options.templateCode,
        variables: options.variables,
        subject: rendered.subject,
        bodyText: rendered.body,
        ...(options.renderedContent ? { htmlBody: options.renderedContent.htmlBody } : {}),
      },
      status: "QUEUED",
      scheduledAt: new Date(),
      maxAttempts: options.maxAttempts || 3,
      attemptCount: 0,
    })
    .onConflictDoNothing({ target: emailJobs.idempotencyKey })
    .returning();

  return { job: inserted[0], isDuplicate: inserted.length === 0 };
}

export async function processEmailQueueWorker(workerId = "worker-1", batchSize = 10, requestId = "req-worker", jobIds?: string[]) {
  const selectedIds = jobIds ? [...new Set(jobIds)].filter((id) => /^[a-f0-9-]{36}$/i.test(id)).slice(0, 100) : undefined;
  if (selectedIds && !selectedIds.length) return { processedCount: 0, results: [] };
  const db = getDbClient();
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60000);
  const lease = `${workerId}:${randomUUID()}`;
  const startedAt = Date.now();
  // An action-bound dispatch must never reconcile or deliver another campaign's jobs.
  const processedResults = selectedIds ? [] as Awaited<ReturnType<typeof settleStaleEmailClaims>>
    : await settleStaleEmailClaims(db, fiveMinutesAgo, batchSize);

  // 2. Safe Locking Query (Compliance Point 4)
  const jobsToProcess = await db
    .select()
    .from(emailJobs)
    .where(
      and(
        or(eq(emailJobs.status, "QUEUED"), eq(emailJobs.status, "PENDING")),
        selectedIds ? inArray(emailJobs.id, selectedIds) : undefined,
        lte(emailJobs.scheduledAt, new Date()),
        or(
          sql`${emailJobs.lockedAt} IS NULL`,
          lt(emailJobs.lockedAt, fiveMinutesAgo)
        )
      )
    )
    .orderBy(asc(emailJobs.scheduledAt), asc(emailJobs.id))
    .limit(batchSize);

  let emailCopy: TransactionalEmailCopy | undefined;

  for (const job of jobsToProcess) {
    if (Date.now() - startedAt >= 12_000) break;
    const payloadObj = (job.payload as Record<string, unknown>) || {};
    if (selectedIds && !isRegistrationWorkflowEmail(String(payloadObj.templateCode || ""))) continue;
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
        lockedBy: lease,
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
    const ownsClaim = and(eq(emailJobs.id, job.id), eq(emailJobs.status, "PROCESSING"), eq(emailJobs.lockedBy, lease));
    let acceptedByProvider = false;

    try {
      const otpError = expiredQueuedOtp(job);
      if (otpError) {
        await db.update(emailJobs).set({ status: "CANCELLED", lastError: otpError,
          lockedAt: null, lockedBy: null, updatedAt: new Date() }).where(ownsClaim);
        processedResults.push({ jobId: job.id, status: "CANCELLED", reason: otpError });
        continue;
      }
      let templateCode = String(payloadObj.templateCode || "");
      let variables = (payloadObj.variables as Record<string, unknown>) || {};
      const isRegistration = isRegistrationWorkflowEmail(templateCode);
      if (isRegistration) {
        const current = await prepareRegistrationEmailForDelivery(db, { ...job, payload: payloadObj }, templateCode);
        if (!current) {
          const reason = "Status atau alamat pendaftaran tidak lagi sesuai; email ini tidak dikirim.";
          await db.update(emailJobs).set({ status: "CANCELLED", lastError: reason,
            lockedAt: null, lockedBy: null, updatedAt: new Date() }).where(ownsClaim);
          processedResults.push({ jobId: job.id, status: "CANCELLED", reason });
          continue;
        }
        templateCode = current.code;
        variables = current.variables;
      }

      // Render HTML email template untuk pengiriman nyata
      let subjectStr: string;
      let htmlBody: string;
      let textBody: string;

      if (templateCode === "ANNOUNCEMENT_CUSTOM") {
        subjectStr = String(payloadObj.subject || "Pengumuman");
        textBody = String(payloadObj.bodyText || "");
        // Trusted server-rendered snapshot; never regenerate from mutable templates/event data.
        htmlBody = String(payloadObj.htmlBody || broadcastHtml(textBody));
      } else if (templateCode === "BROADCAST_CUSTOM") {
        subjectStr = String(payloadObj.subject || "Sapaan untuk Asatidz");
        textBody = String(payloadObj.bodyText || "");
        htmlBody = broadcastHtml(textBody);
      } else {
        // Baca hanya saat email transaksi benar-benar akan dikirim; BC tertunda tidak perlu query tambahan.
        if (!emailCopy && templateCode !== "OTP_CODE") emailCopy = (await getTransactionalEmailSettings()).settings;
        try {
          const rendered = renderHtmlEmailTemplate(templateCode, variables, emailCopy);
          subjectStr = rendered.subject;
          htmlBody = rendered.htmlBody;
          textBody = rendered.textBody;
        } catch (error) {
          // Never send the stored legacy body for registration; it may contain an early QR.
          if (isRegistration) throw error;
          subjectStr = String(payloadObj.subject || "Email Notification");
          textBody = String(payloadObj.bodyText || "");
          htmlBody = broadcastHtml(textBody);
        }
      }

      logInfo(requestId, `Mengirim email antrean ${job.id}`);

      const sendResult = await sendTransactionalEmail({
        to: job.recipientEmail,
        toName: job.recipientName || undefined,
        subject: subjectStr,
        htmlBody,
        textBody,
        requestId,
      });

      if (!sendResult.success) {
        throw Object.assign(new Error(sendResult.error || "Pengiriman email gagal"),
          { retryable: sendResult.retryable === true, deliveryUncertain: sendResult.deliveryUncertain === true });
      }
      acceptedByProvider = true;

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
          lastError: null,
          lockedAt: null,
          lockedBy: null,
          updatedAt: new Date(),
        })
        .where(ownsClaim);

      processedResults.push({ jobId: job.id, status: "SENT", deliveryId: delivery[0].id });
    } catch (err: any) {
      logError(requestId, `Failed sending email job ${job.id}`, err);
      if (acceptedByProvider) {
        // Do not requeue a message the provider accepted. A later run reconciles the delivery record.
        processedResults.push({ jobId: job.id, status: "PROCESSING", reason: UNCERTAIN_DELIVERY });
        continue;
      }

      const nextAttempts = claimed[0].attemptCount;
      const isDeadLetter = nextAttempts >= (job.maxAttempts || 3);
      const nextStatus = err.deliveryUncertain === true ? "DELIVERY_UNCERTAIN"
        : isDeadLetter ? "DEAD_LETTER" : err.retryable === true ? "QUEUED" : "FAILED";

      await db
        .update(emailJobs)
        .set({
          status: nextStatus,
          lastError: nextStatus === "DELIVERY_UNCERTAIN" ? UNCERTAIN_DELIVERY : err.message || "Failed email dispatch",
          scheduledAt: nextStatus === "QUEUED" ? new Date(Date.now() + Math.min(30, 2 ** nextAttempts) * 60_000) : job.scheduledAt,
          lockedAt: null,
          lockedBy: null,
          updatedAt: new Date(),
        })
        .where(ownsClaim);

      if (nextStatus === "DEAD_LETTER") {
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

export async function retryEmailJobService(jobId: string, actorUserId: string, requestId: string, acknowledgeUncertain = false) {
  const db = getDbClient();
  const job = await db.select().from(emailJobs).where(eq(emailJobs.id, jobId)).limit(1);

  if (job.length === 0) {
    throw new NotFoundError("Email job tidak ditemukan.");
  }
  const current = job[0];
  const otpError = expiredQueuedOtp(current);
  if (otpError) throw new ConflictError(otpError);
  if (current.status === "DELIVERY_UNCERTAIN" && !acknowledgeUncertain) throw new ConflictError(UNCERTAIN_DELIVERY);
  if (!["FAILED", "DEAD_LETTER", "DELIVERY_UNCERTAIN"].includes(current.status)) {
    throw new ConflictError("Hanya email gagal atau perlu verifikasi yang dapat diantrekan ulang.");
  }

  const updated = await db
    .update(emailJobs)
    .set({
      status: "QUEUED",
      attemptCount: 0,
      lastError: null,
      lockedAt: null,
      lockedBy: null,
      scheduledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(emailJobs.id, jobId), eq(emailJobs.status, current.status), isNull(emailJobs.lockedAt)))
    .returning();
  if (!updated[0]) throw new ConflictError("Status email berubah. Segarkan antrean lalu coba lagi.");

  await createAuditLog({
    actorUserId,
    action: "EMAIL_JOB_MANUAL_RETRY",
    resourceType: "EMAIL_JOB",
    resourceId: jobId,
    reason: current.status === "DELIVERY_UNCERTAIN" ? "Admin menyatakan telah memeriksa penyedia sebelum mengirim ulang." : "Admin mengantrekan ulang email gagal.",
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
