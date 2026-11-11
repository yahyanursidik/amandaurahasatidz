import { z } from "zod";
import { normalizePhone } from "../utils/normalization";

export const publicProgramQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
  search: z.string().trim().max(100).default(""),
  view: z.enum(["all", "featured", "history", "agenda"]).default("all"),
});
export type PublicProgramQuery = z.infer<typeof publicProgramQuerySchema>;

export const eventCatalogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().trim().max(100).default(""),
  status: z.enum(["ALL", "DRAFT", "PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING", "COMPLETED", "ARCHIVED", "CANCELLED"]).default("ALL"),
});

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

const eventDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus berformat YYYY-MM-DD")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Tanggal event tidak valid");

export const createEventSchema = z.object({
  code: z.string().min(2, "Kode event minimal 2 karakter"),
  slug: z.string().min(2, "Slug event minimal 2 karakter"),
  name: z.string().min(3, "Nama event minimal 3 karakter"),
  subtitle: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  posterUrl: posterSourceSchema.optional().nullable(),
  posterAlt: z.string().max(180, "Teks alternatif maksimal 180 karakter").optional().nullable(),
  posterFocalPoint: z.enum(["CENTER", "TOP", "BOTTOM"]).default("CENTER"),
  audienceMode: z.enum(["INSTITUTION_INVITATION", "PUBLIC_OPEN", "INDIVIDUAL_INVITATION", "MIXED"]).default("INSTITUTION_INVITATION"),
  attendanceMode: z.enum(["DAILY_AND_SESSION", "DAILY_ONLY", "SESSION_ONLY"]).default("DAILY_AND_SESSION"),
  timezone: z.enum(["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"]).default("Asia/Jakarta"),
  startDate: eventDateSchema,
  endDate: eventDateSchema,
  venueName: z.string().optional().nullable(),
  venueAddress: z.string().optional().nullable(),
  publicContactWhatsapp: z.string().trim().max(24).refine((value) => !value || /^[+\d\s().-]+$/.test(value) && /^628\d{8,12}$/.test(normalizePhone(value) || ""),
    "Nomor WhatsApp panitia harus nomor seluler Indonesia yang valid").optional().nullable(),
  mapsUrl: z.string().url("Format URL Google Maps tidak valid").optional().or(z.literal("")).nullable(),
  registrationOpenAt: z.string().optional().nullable(),
  registrationCloseAt: z.string().optional().nullable(),
  invitationResponseDeadline: z.string().optional().nullable(),
  attendanceConfirmationDeadline: z.string().optional().nullable(),
  attendanceConfirmationRequired: z.boolean().default(true),
  lateConfirmationPolicy: z.enum(["BLOCK", "REVIEW", "ALLOW"]).default("BLOCK"),
  defaultInstitutionQuota: z.coerce.number().int().min(1).optional().nullable(),
  capacity: z.coerce.number().int().min(1).optional().nullable(),
  regularQuota: z.coerce.number().int().min(0).optional().nullable(),
  invitationQuota: z.coerce.number().int().min(0).optional().nullable(),
}).superRefine((value, context) => {
  if (value.capacity != null && value.regularQuota != null && value.regularQuota > value.capacity) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["regularQuota"], message: "Kuota reguler tidak boleh melebihi kapasitas total." });
  }
  if (value.capacity != null && value.invitationQuota != null && value.invitationQuota > value.capacity) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["invitationQuota"], message: "Kuota undangan tidak boleh melebihi kapasitas total." });
  }
  if (value.capacity != null && value.regularQuota != null && value.invitationQuota != null && value.regularQuota + value.invitationQuota > value.capacity) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["capacity"], message: "Jumlah kuota reguler dan undangan tidak boleh melebihi kapasitas total." });
  }
});

export const updateEventSchema = createEventSchema.innerType().partial();

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

export const updateEventDaySchema = createEventDaySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "Isi setidaknya satu perubahan hari kegiatan.",
);

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

export const updateEventSessionSchema = createEventSessionSchema.omit({ eventDayId: true }).partial().refine(
  (value) => Object.keys(value).length > 0,
  "Isi setidaknya satu perubahan sesi.",
);

export const assignCommitteeSchema = z.object({
  userId: z.string().uuid("ID Pengguna tidak valid"),
  committeeRole: z.enum(["EVENT_ADMIN", "COMMITTEE_ADMIN", "COMMITTEE_LEAD", "REGISTRATION_OFFICER", "CHECKIN_OFFICER", "INFORMATION_OFFICER"]),
  startsAt: z.string().datetime({ offset: true }).optional().nullable(),
  endsAt: z.string().datetime({ offset: true }).optional().nullable(),
  permissions: z.array(z.string()).optional().nullable(),
});

export const updateCommitteeAssignmentSchema = assignCommitteeSchema.omit({ userId: true }).partial();
