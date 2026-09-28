import { z } from "zod";

export const createAnnouncementSchema = z.object({
  title: z.string().min(3, "Judul pengumuman minimal 3 karakter"),
  body: z.string().min(5, "Isi pengumuman minimal 5 karakter"),
  audienceType: z.enum([
    "ALL_PARTICIPANTS",
    "SPECIFIC_INSTITUTION",
    "APPROVED_ONLY",
    "UNCONFIRMED_ONLY",
    "ATTENDED_SPECIFIC_DAY",
    "COMMITTEE_ONLY",
  ]).default("ALL_PARTICIPANTS"),
  targetInstitutionId: z.string().uuid().optional().nullable(),
  sendEmailNotification: z.boolean().default(false),
}).superRefine((value, context) => {
  if (value.audienceType === "SPECIFIC_INSTITUTION" && !value.targetInstitutionId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["targetInstitutionId"], message: "Pilih lembaga tujuan pengumuman." });
  }
});

export const publishAnnouncementSchema = z.object({
  sendEmailNotification: z.boolean().default(false),
});
