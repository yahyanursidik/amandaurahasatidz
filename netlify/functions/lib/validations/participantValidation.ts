import { z } from "zod";
import { normalizeName, normalizePhone } from "../utils/normalization";

// Local to manual entry: accept Indonesian mobile numbers beginning with 8,
// 08, 62 or +62 without changing the shared normalization helper.
const manualPhoneSchema = z.string().trim().max(30)
  .regex(/^\+?[\d\s().-]+$/, "Nomor telepon tidak valid")
  .transform((value) => {
    const digits = value.replace(/\D/g, "");
    return normalizePhone(digits.startsWith("8") ? `62${digits}` : digits) || "";
  })
  .refine((value) => /^628\d{7,11}$/.test(value), "Gunakan nomor seluler Indonesia yang valid");

export const manualParticipantSchema = z.object({
  fullName: z.string().trim().min(3, "Nama lengkap wajib diisi").max(160)
    .refine((value) => Boolean(normalizeName(value)), "Nama lengkap tidak valid"),
  email: z.string().trim().email("Email tidak valid").max(254).transform((value) => value.toLowerCase()),
  whatsapp: manualPhoneSchema,
  phone: manualPhoneSchema.optional().nullable(),
  institutionName: z.string().trim().max(180).optional().nullable()
    .refine((value) => !value || value.replace(/\s+/g, " ").length >= 3, "Nama lembaga minimal 3 karakter"),
  address: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  attendanceConfirmed: z.boolean().optional(),
});

export const createParticipantSchema = z.object({
  ustadzId: z.string().uuid("ID Ustadz tidak valid"),
  institutionId: z.string().uuid().optional().nullable(),
  invitationId: z.string().uuid().optional().nullable(),
  isDelegationLead: z.boolean().default(false),
  notes: z.string().optional().nullable(),
});

export const updateParticipantStatusSchema = z.object({
  fromStatus: z.string().optional().nullable(),
  toStatus: z.enum(["INVITED", "CONFIRMED", "APPROVED", "WAITLISTED", "REJECTED", "CANCELLED", "REPLACED"]),
  reason: z.string().optional().nullable(),
});

export const approveParticipantSchema = z.object({
  notes: z.string().optional().nullable(),
});

export const waitlistParticipantSchema = z.object({
  reason: z.string().min(2, "Alasan pengalihan ke waitlist wajib diisi"),
});

export const declineParticipantSchema = z.object({
  reason: z.string().min(2, "Alasan penolakan peserta wajib diisi"),
});

export const cancelParticipantSchema = z.object({
  reason: z.string().min(2, "Alasan pembatalan peserta wajib diisi"),
});

export const replaceParticipantSchema = z.object({
  oldParticipantId: z.string().uuid("ID Peserta lama tidak valid"),
  newUstadzId: z.string().uuid("ID Ustadz baru tidak valid"),
  reason: z.string().min(3, "Alasan penggantian peserta wajib diisi"),
});

export const replacePortalDelegationMemberSchema = z.object({
  targetParticipantId: z.string().uuid("ID peserta yang diganti tidak valid"),
  fullName: z.string().trim().min(3, "Nama asatidz pengganti wajib diisi").max(160),
  email: z.string().trim().email("Email asatidz pengganti tidak valid").max(254),
  phone: z.string().trim().min(8, "Nomor telepon minimal 8 digit").max(30).optional().nullable(),
  whatsapp: z.string().trim().min(8, "Nomor WhatsApp minimal 8 digit").max(30),
  address: z.string().trim().max(500).optional().nullable(),
  reason: z.string().trim().min(5, "Jelaskan alasan perubahan minimal 5 karakter").max(500),
});

export const bulkApproveSchema = z.object({
  participantIds: z.array(z.string().uuid())
    .min(1, "Minimal 1 peserta untuk diapprove")
    .max(25, "Maksimal 25 peserta per permintaan approval")
    .refine((ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length,
      "ID peserta tidak boleh duplikat"),
});

export const provisionParticipantPortalAccountSchema = z.object({
  resetExisting: z.boolean().optional().default(false),
});

export const importParticipantRowSchema = z.object({
  fullName: z.string().optional().default(""),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  institutionCode: z.string().optional().nullable(),
  institutionName: z.string().optional().nullable(),
  participantCode: z.string().optional().nullable(),
  isDelegationLead: z.boolean().optional().default(false),
  approvalStatus: z.string().optional().default("PENDING_REVIEW"),
  notes: z.string().optional().nullable(),
});

export const previewParticipantImportSchema = z.object({
  rows: z.array(importParticipantRowSchema).min(1, "Minimal 1 baris peserta untuk dipreview").max(500, "Maksimal 500 peserta per impor"),
});

export const commitParticipantImportSchema = previewParticipantImportSchema.extend({
  approved: z.boolean(),
});

export const requestPasswordSetupSchema = z.object({
  email: z.string().trim().email("Format email tidak valid"),
  portal: z.enum(["admin", "committee", "ustadz"]),
});

export const completePasswordSetupSchema = requestPasswordSetupSchema.extend({
  challengeToken: z.string().min(20, "Sesi aktivasi tidak valid"),
  otp: z.string().regex(/^\d{6}$/, "Kode aktivasi harus 6 digit"),
  newPassword: z
    .string()
    .min(10, "Password minimal 10 karakter")
    .max(128)
    .regex(/[A-Z]/, "Password harus memuat huruf besar")
    .regex(/[a-z]/, "Password harus memuat huruf kecil")
    .regex(/\d/, "Password harus memuat angka"),
});
