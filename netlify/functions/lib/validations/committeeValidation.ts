import { z } from "zod";

export const committeeRoleSchema = z.enum([
  "EVENT_ADMIN",
  "COMMITTEE_ADMIN",
  "COMMITTEE_LEAD",
  "REGISTRATION_OFFICER",
  "CHECKIN_OFFICER",
  "INFORMATION_OFFICER",
]);

export const committeeAccountRoleSchema = z.enum([
  "COMMITTEE_ORGANIZER", ...committeeRoleSchema.options,
]);

export const createCommitteeMemberSchema = z.object({
  name: z.string().trim().min(3, "Nama panitia minimal 3 karakter"),
  email: z.string().trim().email("Format email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  eventId: z.string().uuid("Pilih event penugasan pertama").optional().nullable(),
  committeeRole: committeeAccountRoleSchema,
  startsAt: z.string().datetime({ offset: true }).optional().nullable(),
  endsAt: z.string().datetime({ offset: true }).optional().nullable(),
}).superRefine((value, context) => {
  if (value.committeeRole !== "COMMITTEE_ORGANIZER" && !value.eventId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["eventId"], message: "Pilih event penugasan pertama" });
  }
});

export const committeeGlobalAccessSchema = z.object({ enabled: z.boolean() });

export const updateCommitteeMemberSchema = z.object({
  name: z.string().trim().min(3).optional(),
  email: z.string().trim().email().optional(),
  password: z.string().min(8).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const queryCommitteeSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  eventId: z.string().uuid().optional(),
});

export const committeeDashboardQuerySchema = z.object({
  eventId: z.string().uuid("Pilih event penugasan untuk melihat dashboard panitia"),
});
