import { z } from "zod";

export const createInstitutionSchema = z.object({
  code: z.string().min(2, "Kode lembaga minimal 2 karakter").max(50),
  name: z.string().min(3, "Nama lembaga minimal 3 karakter"),
  legalName: z.string().optional().nullable(),
  institutionType: z.string().optional().nullable(),
  email: z.string().email("Format email tidak valid").optional().nullable(),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  provinceCode: z.string().optional().nullable(),
  cityCode: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  website: z.string().url("Format URL website tidak valid").optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateInstitutionSchema = createInstitutionSchema.partial().extend({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  verificationStatus: z.enum(["UNVERIFIED", "VERIFIED"]).optional(),
});

export const queryInstitutionSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(25),
  search: z.string().optional(),
  provinceCode: z.string().optional(),
  cityCode: z.string().optional(),
  status: z.string().optional(),
  verificationStatus: z.string().optional(),
});

export const createRepresentativeSchema = z.object({
  name: z.string().min(2, "Nama perwakilan minimal 2 karakter"),
  email: z.string().email("Format email tidak valid"),
  phone: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  isPrimary: z.boolean().default(false),
});

export const updateRepresentativeSchema = createRepresentativeSchema.partial();
