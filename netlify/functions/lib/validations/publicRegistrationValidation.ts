import { z } from "zod";
import { isValidInstitutionRegion } from "../../../../src/lib/institutionRegion";
import { registrationInstitutionSearchKey, REGISTRATION_INSTITUTION_NAME_MAX } from "../../../../src/lib/registrationInstitution";

export const registrationInstitutionSearchSchema = z.object({
  search: z.string().trim().max(REGISTRATION_INSTITUTION_NAME_MAX).default("")
    .refine((value) => !value || !!registrationInstitutionSearchKey(value), "Masukkan nama atau wilayah lembaga.")
    .transform(registrationInstitutionSearchKey),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

const institutionProposalSchema = z.object({
  name: z.string().trim().max(REGISTRATION_INSTITUTION_NAME_MAX)
    .refine((value) => registrationInstitutionSearchKey(value).replaceAll(" ", "").length >= 3, "Isi nama lengkap lembaga."),
  provinceCode: z.string().regex(/^\d{2}$/).nullable().optional(),
  cityCode: z.string().regex(/^\d{4}$/).nullable().optional(),
}).strict().refine(({ provinceCode, cityCode }) => isValidInstitutionRegion(provinceCode, cityCode), {
  path: ["cityCode"], message: "Pilih kabupaten/kota yang sesuai dengan provinsi lembaga.",
});

export const submitPublicRegistrationSchema = z.object({
  fullName: z.string().trim().min(3, "Nama lengkap minimal 3 karakter").max(150),
  email: z.string().trim().email("Alamat email tidak valid"),
  whatsapp: z.string().trim().min(9, "Nomor WhatsApp minimal 9 digit").max(20),
  address: z.string().trim().max(500).optional().nullable(),
  institutionId: z.string().uuid("Pilihan lembaga tidak valid").optional().nullable(),
  institutionProposal: institutionProposalSchema.optional().nullable(),
  institutionName: z.string().trim().max(REGISTRATION_INSTITUTION_NAME_MAX).refine((value) => value.length === 0 || value.length >= 3,
    "Nama lembaga/komunitas minimal 3 karakter jika diisi").optional().nullable(),
  city: z.string().trim().min(2, "Kabupaten/kota wajib diisi").max(120),
  province: z.string().trim().min(2, "Provinsi wajib diisi").max(120),
  cityCode: z.string().trim().max(30).optional().nullable(),
  provinceCode: z.string().trim().max(30).optional().nullable(),
  consentConfirmed: z.literal(true, { message: "Persetujuan penggunaan data peserta wajib diberikan" }),
  delegates: z.array(z.object({
    fullName: z.string().trim().min(3, "Nama peserta minimal 3 karakter").max(150),
    email: z.string().trim().email("Email peserta tidak valid"),
    whatsapp: z.string().trim().min(9, "WhatsApp peserta minimal 9 digit").max(20),
    address: z.string().trim().max(500).optional().nullable(),
    city: z.string().trim().min(2, "Kabupaten/kota anggota wajib diisi").max(120),
    province: z.string().trim().min(2, "Provinsi anggota wajib diisi").max(120),
    cityCode: z.string().trim().max(30).optional().nullable(),
    provinceCode: z.string().trim().max(30).optional().nullable(),
  })).max(19, "Maksimal 20 asatidz dalam satu rombongan, termasuk ketua").default([]),
}).superRefine((value, context) => {
  if ([value.institutionId, value.institutionName, value.institutionProposal].filter(Boolean).length > 1) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["institutionId"], message: "Gunakan satu pilihan lembaga." });
  }
  const emails = [value.email, ...value.delegates.map((delegate) => delegate.email)].map((email) => email.trim().toLowerCase());
  if (new Set(emails).size !== emails.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ["delegates"], message: "Setiap asatidz harus memakai email pribadi yang berbeda." });
});
