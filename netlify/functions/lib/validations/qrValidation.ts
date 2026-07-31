import { z } from "zod";

export const verifyQrTokenSchema = z.object({
  eventId: z.string().uuid("ID Event tidak valid"),
  qrTokenOrCode: z.string().min(6, "Token QR atau Kode Peserta tidak valid"),
});
