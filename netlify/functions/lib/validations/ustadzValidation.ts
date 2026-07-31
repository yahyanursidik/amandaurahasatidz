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

// Allowed fields for Ustadz self-update (Compliance Point 6 & 7)
export const updateUstadzSelfProfileSchema = z.object({
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  educationSummary: z.string().optional().nullable(),
  expertiseSummary: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  // approvalStatus, fullName, institutionId are strictly omitted/not allowed!
});

export const queryUstadzSchema = z.object({
  search: z.string().optional(),
  institutionId: z.string().uuid().optional(),
  cityCode: z.string().optional(),
  provinceCode: z.string().optional(),
  profileStatus: z.enum(["ACTIVE", "INACTIVE", "MERGED"]).optional(),
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
