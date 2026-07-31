import { z } from "zod";

export const emailWebhookPayloadSchema = z.object({
  provider: z.string().default("RESEND"),
  providerMessageId: z.string().min(1, "providerMessageId wajib ada"),
  eventType: z.enum(["DELIVERED", "BOUNCED", "COMPLAINED", "OPENED", "CLICKED"]),
  timestamp: z.string().optional(),
  recipientEmail: z.string().email().optional(),
  reason: z.string().optional().nullable(),
});
