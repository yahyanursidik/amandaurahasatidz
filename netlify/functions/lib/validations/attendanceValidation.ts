import { z } from "zod";

const unitSelection = {
  sessionId: z.string().uuid("ID sesi tidak valid").optional().nullable(),
  dayId: z.string().uuid("ID hari tidak valid").optional().nullable(),
};
const oneUnit = (data: { dayId?: string | null; sessionId?: string | null }) => Boolean(data.dayId) !== Boolean(data.sessionId);
const unitError = "Pilih tepat satu hari atau sesi kehadiran.";
const attendanceStatus = z.enum(["PRESENT", "LATE", "EXCUSED", "PERMITTED", "ABSENT"]);

export const selfCheckinSchema = z.object({
  eventId: z.string().uuid("ID event tidak valid"),
  ...unitSelection,
  rawLocationQrToken: z.string().trim().regex(/^loc_qr_[a-f0-9]{64}$/, "Pindai QR Lokasi yang sah."),
}).strict().refine(oneUnit, unitError);

export const locationQrIssueSchema = z.object({ ...unitSelection, rotate: z.boolean().default(false) })
  .strict().refine(oneUnit, unitError);

export const processCheckinSchema = z.object({
  qrTokenOrCode: z.string().trim().min(4, "Token QR atau Kode Peserta wajib diisi").max(512),
  ...unitSelection,
  method: z.enum(["QR_SCAN", "MANUAL_CODE", "SEARCH_SELECT"]).default("QR_SCAN"),
}).refine((data) => !(data.sessionId && data.dayId), {
  message: "Pilih salah satu unit kehadiran: harian atau sesi.",
});

export const publicKioskCheckinSchema = z.object({
  qrToken: z.string().trim().max(512).regex(/^pqr_[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}$/, "Pindai QR peserta yang sah."),
  ...unitSelection,
}).strict().refine(oneUnit, unitError);

export const queryCheckinLogsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const searchCheckinParticipantSchema = z.object({
  q: z.string().trim().min(2, "Ketik minimal dua karakter nama, lembaga, atau kode peserta.").max(80),
});

export const manualMarkAttendanceSchema = z.object({
  participantId: z.string().uuid("ID Peserta tidak valid"),
  ...unitSelection,
  attendanceStatus,
  notes: z.string().trim().max(500).optional().nullable(),
}).strict().refine(oneUnit, unitError);

export const correctAttendanceSchema = z.object({
  attendanceStatus,
  reason: z.string().trim().min(3, "Alasan koreksi presensi wajib diisi (minimal 3 karakter)").max(500),
}).strict();
