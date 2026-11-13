import { z } from "zod";

export const verifyQrTokenSchema = z.object({
  eventId: z.string().uuid("ID Event tidak valid"),
  qrTokenOrCode: z.string().trim().min(4, "Token QR atau Kode Peserta tidak valid").max(512),
});
