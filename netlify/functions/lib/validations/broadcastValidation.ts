import { z } from "zod";

export const broadcastTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(3).max(100),
  subject: z.string().trim().min(3).max(180).refine((value) => !/[\r\n]/.test(value), "Subjek email harus satu baris."),
  body: z.string().trim().min(10).max(10000),
});

export const scheduleBroadcastSchema = z.object({
  campaignId: z.string().uuid().optional(),
  templateId: z.string().uuid(),
  scheduledAt: z.string().datetime({ offset: true }),
  frequency: z.enum(["ONCE", "WEEKLY", "MONTHLY"]),
  occurrences: z.number().int().min(1).max(12),
  dailyLimit: z.number().int().min(1).max(5000),
}).refine((input) => input.frequency !== "ONCE" || input.occurrences === 1, {
  message: "Jadwal sekali kirim hanya memiliki satu pengiriman.",
});

export const testBroadcastSchema = z.object({
  recipientEmail: z.string().trim().email().max(254),
  recipientName: z.string().trim().min(2).max(120).optional(),
});

export const broadcastJobsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  status: z.enum(["ALL", "QUEUED", "SENT", "FAILED", "PROCESSING", "CANCELLED"]).default("ALL"),
});
