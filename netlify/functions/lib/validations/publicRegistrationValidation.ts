import { z } from "zod";

export const submitPublicRegistrationSchema = z.object({
  fullName: z.string().trim().min(3, "Nama lengkap minimal 3 karakter").max(150),
  email: z.string().trim().email("Alamat email tidak valid"),
  whatsapp: z.string().trim().min(9, "Nomor WhatsApp minimal 9 digit").max(20),
  address: z.string().trim().max(500).optional().nullable(),
  consentConfirmed: z.literal(true, { message: "Persetujuan pengiriman data rombongan wajib diberikan" }),
  delegates: z.array(z.object({
    fullName: z.string().trim().min(3, "Nama peserta minimal 3 karakter").max(150),
    email: z.string().trim().email("Email peserta tidak valid"),
    whatsapp: z.string().trim().min(9, "WhatsApp peserta minimal 9 digit").max(20),
    address: z.string().trim().max(500).optional().nullable(),
  })).max(19, "Maksimal 20 asatidz dalam satu rombongan, termasuk ketua").default([]),
}).superRefine((value, context) => {
  const emails = [value.email, ...value.delegates.map((delegate) => delegate.email)].map((email) => email.trim().toLowerCase());
  if (new Set(emails).size !== emails.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ["delegates"], message: "Setiap asatidz harus memakai email pribadi yang berbeda." });
});
