import { z } from "zod";

export const processCheckinSchema = z.object({
  qrTokenOrCode: z.string().min(4, "Token QR atau Kode Peserta wajib diisi"),
  sessionId: z.string().uuid().optional().nullable(),
  dayId: z.string().uuid().optional().nullable(),
  method: z.enum(["QR_SCAN", "MANUAL_CODE", "SEARCH_SELECT"]).default("QR_SCAN"),
}).refine((data) => !(data.sessionId && data.dayId), {
  message: "Pilih salah satu unit kehadiran: harian atau sesi.",
});

export const queryCheckinLogsSchema = z.object({
  limit: z.coerce.number().optional().default(20),
});

export const manualMarkAttendanceSchema = z.object({
  participantId: z.string().uuid("ID Peserta tidak valid"),
  sessionId: z.string().uuid().optional().nullable(),
  dayId: z.string().uuid().optional().nullable(),
  attendanceStatus: z.enum(["PRESENT", "LATE", "EXCUSED", "PERMITTED", "ABSENT"]),
  notes: z.string().optional().nullable(),
});

export const correctAttendanceSchema = z.object({
  attendanceStatus: z.enum(["PRESENT", "LATE", "EXCUSED", "PERMITTED", "ABSENT"]),
  reason: z.string().min(3, "Alasan koreksi presensi wajib diisi (minimal 3 karakter)"),
});
