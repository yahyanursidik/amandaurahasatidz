import { z } from "zod";

export const createInvitationSchema = z.object({
  eventId: z.string().uuid("ID Event tidak valid"),
  invitationType: z.enum(["INSTITUTION", "INDIVIDUAL"]),
  institutionId: z.string().uuid().optional().nullable(),
  ustadzId: z.string().uuid().optional().nullable(),
  invitationNumber: z.string().min(2, "Nomor undangan minimal 2 karakter"),
  quota: z.coerce.number().min(1, "Kuota minimal 1 peserta").default(1),
  responseDeadline: z.string().optional().nullable(),
});

export const submitResponseSchema = z.object({
  captchaToken: z.string().optional(),
  emailVerificationCode: z.string().optional(),
  responseStatus: z.enum(["ACCEPTED", "DECLINED"]),
  notes: z.string().optional().nullable(),
  isFinal: z.boolean().default(false),
  delegates: z
    .array(
      z.object({
        fullName: z.string().min(2, "Nama delegasi minimal 2 karakter"),
        email: z.string().email("Format email delegasi tidak valid").optional().nullable(),
        phone: z.string().optional().nullable(),
      })
    )
    .optional(),
});
