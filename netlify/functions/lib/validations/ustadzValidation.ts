import { z } from "zod";

export const createUstadzSchema = z.object({
  fullName: z.string().min(2, "Nama lengkap ustadz minimal 2 karakter"),
  titlePrefix: z.string().max(80).optional().nullable(),
  titleSuffix: z.string().max(120).optional().nullable(),
  email: z.string().email("Format email tidak valid").optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  whatsapp: z.string().max(30).optional().nullable(),
  birthPlace: z.string().max(120).optional().nullable(),
  birthDate: z.string().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  cityCode: z.string().max(30).optional().nullable(),
  provinceCode: z.string().max(30).optional().nullable(),
  educationSummary: z.string().max(2000).optional().nullable(),
  expertiseSummary: z.string().max(2000).optional().nullable(),
  institutionId: z.string().uuid().optional().nullable(),
  positionAtInstitution: z.string().max(160).optional().nullable(),
  isPrimaryInstitution: z.boolean().default(true),
});

export const updateUstadzSchema = createUstadzSchema.partial().extend({
  profileStatus: z.enum(["ACTIVE", "INACTIVE", "MERGED"]).optional(),
});

const optionalProfileText = (max: number) => z.string().trim().max(max).transform((value) => value || null).nullable().optional();
const profilePhone = z.string().trim().max(30).refine(
  (value) => !value || (/^[+\d\s().-]+$/.test(value) && value.replace(/\D/g, "").length >= 8 && value.replace(/\D/g, "").length <= 15),
  "Nomor telepon/WhatsApp tidak valid",
).transform((value) => value || null).nullable().optional();
const profileBirthDate = z.string().trim().refine((value) => {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01") return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && value <= new Date().toISOString().slice(0, 10);
}, "Tanggal lahir harus valid dan tidak di masa depan").transform((value) => value || null).nullable().optional();

// Contact email only: this endpoint never changes login credentials or affiliations.
export const updateUstadzSelfProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Nama lengkap minimal 2 karakter").max(160).optional(),
  email: z.string().trim().max(254).refine((value) => !value || z.string().email().safeParse(value).success, "Format email kontak tidak valid")
    .transform((value) => value.toLowerCase() || null).nullable().optional(),
  titlePrefix: optionalProfileText(80),
  titleSuffix: optionalProfileText(120),
  birthPlace: optionalProfileText(120),
  birthDate: profileBirthDate,
  phone: profilePhone,
  whatsapp: profilePhone,
  educationSummary: optionalProfileText(2000),
  expertiseSummary: optionalProfileText(2000),
  address: optionalProfileText(500),
  cityCode: optionalProfileText(30),
  provinceCode: optionalProfileText(30),
  city: optionalProfileText(160),
  province: optionalProfileText(160),
}).strict().refine((value) => Object.values(value).some((field) => field !== undefined), "Tidak ada perubahan profil yang dikirim");

export type UstadzSelfProfilePatch = z.infer<typeof updateUstadzSelfProfileSchema>;

export const queryUstadzSchema = z.object({
  search: z.string().optional(),
  institutionId: z.string().uuid().optional(),
  cityCode: z.string().optional(),
  provinceCode: z.string().optional(),
  profileStatus: z.enum(["ACTIVE", "INACTIVE", "MERGED", "ARCHIVED"]).optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(25),
});

export const createAffiliationSchema = z.object({
  institutionId: z.string().uuid("ID Lembaga tidak valid"),
  position: z.string().max(160).optional().nullable(),
  isPrimary: z.boolean().default(false),
  startDate: z.string().optional().nullable(),
});

export const updateAffiliationSchema = z.object({
  position: z.string().max(160).optional().nullable(),
  isPrimary: z.boolean().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const duplicateUstadzSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  excludeId: z.string().uuid().optional().nullable(),
});

export const mergeUstadzSchema = z.object({
  targetUstadzId: z.string().uuid("ID Ustadz target tidak valid"),
  sourceUstadzIds: z.array(z.string().uuid()).min(1, "Minimal 1 profil sumber untuk digabung"),
  notes: z.string().min(5, "Alasan penggabungan minimal 5 karakter"),
});
