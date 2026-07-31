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

export const bulkApproveSchema = z.object({
  participantIds: z.array(z.string().uuid()).min(1, "Minimal 1 peserta untuk diapprove"),
});
