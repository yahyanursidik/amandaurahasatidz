import { z } from "zod";

export const createUstadzSchema = z.object({
  fullName: z.string().min(2, "Nama lengkap minimal 2 karakter"),
  titlePrefix: z.string().optional().nullable(),
  titleSuffix: z.string().optional().nullable(),
  email: z.string().email("Format email tidak valid").optional().nullable(),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  birthPlace: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  cityCode: z.string().optional().nullable(),
  provinceCode: z.string().optional().nullable(),
  educationSummary: z.string().optional().nullable(),
  expertiseSummary: z.string().optional().nullable(),
});

export const updateUstadzSchema = createUstadzSchema.partial().extend({
  profileStatus: z.enum(["ACTIVE", "INACTIVE", "MERGED"]).optional(),
});

export const queryUstadzSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(25),
  search: z.string().optional(),
  cityCode: z.string().optional(),
  provinceCode: z.string().optional(),
  profileStatus: z.string().optional(),
});

export const createAffiliationSchema = z.object({
  institutionId: z.string().uuid("ID Lembaga tidak valid"),
  position: z.string().optional().nullable(),
  isPrimary: z.boolean().default(false),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

export const mergeUstadzSchema = z.object({
  sourceUstadzId: z.string().uuid("ID Ustadz sumber tidak valid"),
  targetUstadzId: z.string().uuid("ID Ustadz target tidak valid"),
});
