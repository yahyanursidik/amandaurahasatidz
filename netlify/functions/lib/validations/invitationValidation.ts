import { z } from "zod";

export const createInvitationSchema = z.object({
  eventId: z.string().uuid("ID Event tidak valid"),
  invitationType: z.enum(["INSTITUTION", "INDIVIDUAL"]),
  institutionId: z.string().uuid().optional().nullable(),
  ustadzId: z.string().uuid().optional().nullable(),
  invitationNumber: z.string().trim().min(2, "Nomor undangan minimal 2 karakter").max(120, "Nomor undangan maksimal 120 karakter"),
  quota: z.coerce.number().min(1, "Kuota minimal 1 peserta").default(1),
  responseDeadline: z.string().optional().nullable(),
}).superRefine((value, context) => {
  if (value.invitationType === "INSTITUTION" && !value.institutionId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["institutionId"],
      message: "Pilih lembaga penerima undangan",
    });
  }
  if (value.invitationType === "INDIVIDUAL" && !value.ustadzId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ustadzId"],
      message: "Pilih asatidz penerima undangan individu",
    });
  }
});

export const submitResponseSchema = z.object({
  captchaToken: z.string().optional(),
  verificationToken: z.string().min(20, "Bukti verifikasi undangan tidak valid"),
  responseStatus: z.enum(["ACCEPTED", "DECLINED"]),
  notes: z.string().max(1000, "Catatan maksimal 1000 karakter").optional().nullable(),
  isFinal: z.boolean().default(false),
  delegates: z
    .array(
      z.object({
        existingProfileId: z.string().uuid().optional().nullable(),
        fullName: z.string().min(2, "Nama delegasi minimal 2 karakter"),
        email: z.string().trim().email("Format email delegasi tidak valid"),
        phone: z.string().min(8, "Nomor telepon minimal 8 digit").optional().nullable(),
        whatsapp: z.string().min(8, "Nomor WhatsApp minimal 8 digit").optional().nullable(),
        address: z.string().max(500, "Alamat delegasi maksimal 500 karakter").optional().nullable(),
        isLead: z.boolean().default(false),
      })
    )
    .optional(),
}).superRefine((value, context) => {
  const delegates = value.delegates || [];
  if (value.responseStatus === "ACCEPTED" && delegates.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["delegates"],
      message: "Minimal satu delegasi wajib didaftarkan saat lembaga menyatakan hadir",
    });
  }
  if (value.responseStatus === "ACCEPTED" && delegates.filter((delegate) => delegate.isLead).length !== 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["delegates"],
      message: "Pilih tepat satu ketua rombongan",
    });
  }
  const normalizedEmails = delegates.map((delegate) => delegate.email.toLowerCase());
  if (new Set(normalizedEmails).size !== normalizedEmails.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["delegates"],
      message: "Setiap peserta wajib menggunakan email portal yang berbeda",
    });
  }
});

export const requestInvitationOtpSchema = z.object({
  email: z.string().trim().email("Format email perwakilan tidak valid"),
});

export const verifyInvitationOtpSchema = z.object({
  email: z.string().trim().email("Format email perwakilan tidak valid"),
  code: z.string().trim().regex(/^\d{6}$/, "Kode OTP harus terdiri dari 6 digit"),
  challengeToken: z.string().min(20, "Sesi OTP tidak valid"),
});

export const verifyInstitutionAccessCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(8, "Kode unik lembaga tidak lengkap")
    .max(12, "Kode unik lembaga tidak valid")
    .regex(/^[A-Za-z0-9-]+$/, "Kode unik lembaga hanya boleh berisi huruf, angka, dan tanda hubung"),
});
