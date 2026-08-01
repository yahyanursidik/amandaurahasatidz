import { z } from "zod";

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
  participantIds: z.array(z.string().uuid()).min(1, "Minimal 1 peserta untuk diapprove"),
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
