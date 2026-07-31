import { z } from "zod";

const posterSourceSchema = z
  .string()
  .max(900_000, "Ukuran poster setelah optimasi terlalu besar")
  .refine(
    (value) =>
      value === "" ||
      value.startsWith("/images/") ||
      /^https?:\/\//i.test(value) ||
      /^data:image\/(?:jpeg|png|webp);base64,/i.test(value),
    "Sumber poster harus berupa unggahan gambar, URL HTTPS, atau aset gambar aplikasi"
  );

export const createEventSchema = z.object({
  code: z.string().min(2, "Kode event minimal 2 karakter"),
  slug: z.string().min(2, "Slug event minimal 2 karakter"),
  name: z.string().min(3, "Nama event minimal 3 karakter"),
  subtitle: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  posterUrl: posterSourceSchema.optional().nullable(),
  posterAlt: z.string().max(180, "Teks alternatif maksimal 180 karakter").optional().nullable(),
  posterFocalPoint: z.enum(["CENTER", "TOP", "BOTTOM"]).default("CENTER"),
  audienceMode: z.enum(["INSTITUTION_INVITATION", "PUBLIC_OPEN", "INDIVIDUAL_INVITATION"]).default("INSTITUTION_INVITATION"),
  attendanceMode: z.enum(["DAILY_AND_SESSION", "DAILY_ONLY", "SESSION_ONLY"]).default("DAILY_AND_SESSION"),
  timezone: z.string().default("Asia/Jakarta"),
  startDate: z.string({ required_error: "Tanggal mulai wajib diisi" }),
  endDate: z.string({ required_error: "Tanggal selesai wajib diisi" }),
  venueName: z.string().optional().nullable(),
  venueAddress: z.string().optional().nullable(),
  mapsUrl: z.string().url("Format URL Google Maps tidak valid").optional().or(z.literal("")).nullable(),
  registrationOpenAt: z.string().optional().nullable(),
  registrationCloseAt: z.string().optional().nullable(),
  invitationResponseDeadline: z.string().optional().nullable(),
  attendanceConfirmationDeadline: z.string().optional().nullable(),
  attendanceConfirmationRequired: z.boolean().default(true),
  lateConfirmationPolicy: z.enum(["BLOCK", "REVIEW", "ALLOW"]).default("BLOCK"),
  defaultInstitutionQuota: z.coerce.number().min(1).optional().nullable(),
  capacity: z.coerce.number().min(1).optional().nullable(),
});

export const updateEventSchema = createEventSchema.partial();

export const transitionEventSchema = z.object({
  action: z.enum([
    "PUBLISH",
    "OPEN_REGISTRATION",
    "CLOSE_REGISTRATION",
    "START_EVENT",
    "COMPLETE_EVENT",
    "ARCHIVE",
    "CANCEL",
  ]),
});

export const createEventDaySchema = z.object({
  dayNumber: z.coerce.number().min(1),
  date: z.string(),
  title: z.string().optional().nullable(),
  checkinOpenAt: z.string().optional().nullable(),
  checkinCloseAt: z.string().optional().nullable(),
});

export const createEventSessionSchema = z.object({
  eventDayId: z.string().uuid(),
  title: z.string().min(2, "Judul sesi minimal 2 karakter"),
  sessionType: z.enum(["MATERIAL", "BREAK", "OPENING", "CLOSING"]).default("MATERIAL"),
  speakerUstadzId: z.string().uuid().optional().nullable(),
  moderatorName: z.string().optional().nullable(),
  startAt: z.string(),
  endAt: z.string(),
  room: z.string().optional().nullable(),
  attendanceRequired: z.boolean().default(true),
  checkinRequired: z.boolean().default(true),
  checkinOpenAt: z.string().optional().nullable(),
  checkinCloseAt: z.string().optional().nullable(),
  sortOrder: z.coerce.number().default(0),
});

export const assignCommitteeSchema = z.object({
  userId: z.string().uuid("ID Pengguna tidak valid"),
  committeeRole: z.enum(["EVENT_ADMIN", "COMMITTEE_LEAD", "REGISTRATION_OFFICER", "CHECKIN_OFFICER", "INFORMATION_OFFICER"]),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
  permissions: z.array(z.string()).optional().nullable(),
});

export const updateCommitteeAssignmentSchema = assignCommitteeSchema.omit({ userId: true }).partial();
