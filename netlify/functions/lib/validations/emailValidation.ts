import { z } from "zod";

export const enqueueEmailSchema = z.object({
  templateCode: z.enum([
    "INVITATION_INSTITUTION",
    "INVITATION_INDIVIDUAL",
    "REGISTRATION_CONFIRMED",
    "OTP_CODE",
  ]),
  recipientEmail: z.string().email("Format email penerima tidak valid"),
  recipientName: z.string().optional().nullable(),
  variables: z.record(z.any()).default({}),
  idempotencyKey: z.string().min(8, "Idempotency key minimal 8 karakter"),
});

export const retryEmailJobSchema = z.object({
  jobId: z.string().uuid("ID Email Job tidak valid"),
});
