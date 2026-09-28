import crypto from "crypto";
import { getDbClient } from "../db/client";
import { emailDeliveries, emailJobs } from "../db/schema";
import { eq } from "drizzle-orm";
import { NotFoundError, UnauthorizedError } from "../utils/errors";
import { logInfo } from "../utils/logger";

export function verifyWebhookSignature(signature: string | undefined, rawBody: string, secret: string): boolean {
  if (!signature || !secret) return false;

  const expectedSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch (_err) {
    return false;
  }
}

export async function processWebhookIdempotentService(
  payload: {
    provider?: string;
    providerMessageId: string;
    eventType: string;
    recipientEmail?: string;
    reason?: string | null;
  },
  signature?: string,
  rawBody?: string,
  requestId = "req-webhook"
) {
  const provider = payload.provider || "RESEND";
  const webhookSecret = process.env.WEBHOOK_SECRET || "";

  if (!rawBody || !verifyWebhookSignature(signature, rawBody, webhookSecret)) throw new UnauthorizedError("Signature webhook tidak valid atau belum dikonfigurasi.");

  const db = getDbClient();

  // 1. Idempotency Lookup by providerMessageId
  const existingDelivery = await db
    .select()
    .from(emailDeliveries)
    .where(eq(emailDeliveries.providerMessageId, payload.providerMessageId))
    .limit(1);

  if (existingDelivery.length > 0) {
    const del = existingDelivery[0];
    const updateData: Record<string, any> = { updatedAt: new Date() };

    if (payload.eventType === "DELIVERED") {
      updateData.status = "DELIVERED";
      updateData.deliveredAt = new Date();
    } else if (payload.eventType === "BOUNCED") {
      updateData.status = "BOUNCED";
      updateData.bouncedAt = new Date();
    } else if (payload.eventType === "COMPLAINED") {
      updateData.status = "COMPLAINED";
      updateData.complainedAt = new Date();
    } else if (payload.eventType === "OPENED") {
      // Compliance Point 9: Record openedAt as metric only, not absolute proof of reading
      updateData.openedAt = new Date();
    }

    await db.update(emailDeliveries).set(updateData).where(eq(emailDeliveries.id, del.id));

    logInfo(requestId, `Webhook idempotently updated delivery ${del.id} with event ${payload.eventType}`);
    return { status: "IDEMPOTENT_UPDATED", deliveryId: del.id };
  }

  throw new NotFoundError(`ID email dari ${provider} tidak ditemukan pada antrean aplikasi.`);
}
