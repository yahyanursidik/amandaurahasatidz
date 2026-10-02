import { z } from "zod";
import { ruangThreadCategories, ruangThreadStatuses } from "../db/schema/ruangAsatidz";

const title = z.string().trim().min(5).max(160);
const body = z.string().trim().min(10).max(5000);

export const createRuangThreadSchema = z.object({
  category: z.enum(ruangThreadCategories),
  subject: title,
  body,
  shareExperience: z.boolean().default(false),
}).strict().refine((input) => !input.shareExperience || input.category === "EXPERIENCE", {
  message: "Persetujuan berbagi hanya berlaku untuk pengalaman.", path: ["shareExperience"],
});

export const ruangReplySchema = z.object({ body: z.string().trim().min(2).max(5000) }).strict();
export const updateRuangThreadSchema = z.object({
  status: z.enum(ruangThreadStatuses).optional(),
  publicationStatus: z.enum(["PUBLISHED", "HIDDEN", "PENDING"]).optional(),
}).strict().refine((input) => input.status !== undefined || input.publicationStatus !== undefined, {
  message: "Pilih status yang akan diperbarui.",
});
export const ruangGreetingSchema = z.object({ title, body, isPublished: z.boolean() }).strict();
export const ruangListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  category: z.enum(ruangThreadCategories).optional(),
  status: z.enum(ruangThreadStatuses).optional(),
}).strict();

export type CreateRuangThreadInput = z.infer<typeof createRuangThreadSchema>;
export type UpdateRuangThreadInput = z.infer<typeof updateRuangThreadSchema>;
export type RuangGreetingInput = z.infer<typeof ruangGreetingSchema>;
export type RuangListQuery = z.infer<typeof ruangListQuerySchema>;