import { z } from "zod";

export const communicationAudienceSchema = z.enum([
    "ALL_PARTICIPANTS",
    "SPECIFIC_INSTITUTION",
    "APPROVED_ONLY",
    "UNCONFIRMED_ONLY",
    "ATTENDED_SPECIFIC_DAY",
    "COMMITTEE_ONLY",
  ]);

const communicationFields = {
  title: z.string().trim().min(3, "Judul pengumuman minimal 3 karakter").max(300),
  body: z.string().trim().min(5, "Isi pengumuman minimal 5 karakter").max(50000),
  emailSubject: z.string().trim().max(300).refine((text) => !/[\r\n]/.test(text), "Subjek email harus satu baris.").optional().nullable(),
  audienceType: communicationAudienceSchema.default("ALL_PARTICIPANTS"),
  sendEmailNotification: z.boolean().default(false),
};

export const createAnnouncementSchema = z.object({
  ...communicationFields,
  targetInstitutionId: z.string().uuid().optional().nullable(),
}).superRefine((value, context) => {
  if (value.audienceType === "SPECIFIC_INSTITUTION" && !value.targetInstitutionId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["targetInstitutionId"], message: "Pilih lembaga tujuan pengumuman." });
  }
});

export const publishAnnouncementSchema = z.object({
  sendEmailNotification: z.boolean().optional(),
  expectedUpdatedAt: z.string().datetime().optional(),
});

export const communicationTemplateSchema = z.object({
  ...communicationFields,
  name: z.string().trim().min(2).max(150),
  category: z.string().trim().min(1).max(80).default("CUSTOM"),
});

export const updateCommunicationTemplateSchema = communicationTemplateSchema.partial();
