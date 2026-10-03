import { z } from "zod";

export const regionCodes = ["3273", "3277", "3204", "3217", "3211"] as const;
export const sumedangDistricts = ["Jatinangor", "Cimanggung", "Tanjungsari", "Sukasari", "Pamulihan"];
const district = z.string().trim().max(120).transform(value => value.replace(/^kec(?:amatan)?\.?\s*/i, ""));
const text = (max: number) => z.string().trim().max(max);
const realDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const time = Date.parse(value); return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}, "Tanggal tidak valid.");
export const versionSchema = z.object({ expectedVersion: z.number().int().min(1).max(2147483646) }).strict();
export const idSchema = z.string().uuid();
export const workStatuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "ARCHIVED"] as const;
export const publications = ["DRAFT", "PENDING", "APPROVED", "REJECTED", "HIDDEN"] as const;
export const categories = ["MAPPING", "TEACHER", "QURAN", "YOUTH_FAMILY", "FACILITIES", "ACCESS", "COLLABORATION", "PROGRESS", "SENSITIVE", "OTHER"] as const;
export function validRegion(value: { cityCode: string; district: string }) {
  return (regionCodes as readonly string[]).includes(value.cityCode) && (value.cityCode !== "3211" || sumedangDistricts.some(d => d.toLowerCase() === value.district.toLowerCase()));
}
const regionCheck = <T extends { cityCode: string; district: string }>(value: T, ctx: z.RefinementCtx) => {
  if (!validRegion(value)) ctx.addIssue({ code: "custom", path: ["district"], message: "Wilayah di luar cakupan atau kecamatan Sumedang belum dipilih." });
};
const phone = text(40).refine(value => !value || /^\+?\d{8,15}$/.test(value.replace(/[\s().-]/g, "")), "Nomor kontak tidak valid.");
const locationFields = z.object({
  institutionId: idSchema.nullable(), name: text(200).min(3), type: z.enum(["MOSQUE", "PESANTREN", "FOUNDATION", "STUDY_GROUP", "EDUCATION", "OTHER"]),
  address: text(1000).min(3), cityCode: z.enum(regionCodes), district,
  latitude: z.number().finite().min(-7.5).max(-6.3).nullable(), longitude: z.number().finite().min(106.9).max(108.3).nullable(),
  programs: text(4000), needs: text(4000), isPublished: z.boolean(), isVerified: z.boolean(),
  officialPhone: phone, picName: text(200), picPhone: phone, officialContactShared: z.boolean(), picContactShared: z.boolean(),
  contactConsentConfirmed: z.boolean(), contactConsentSource: text(1000),
});
function locationCheck(value: z.infer<typeof locationFields>, ctx: z.RefinementCtx) {
  regionCheck(value, ctx);
  if ((value.latitude === null) !== (value.longitude === null)) ctx.addIssue({ code: "custom", path: ["latitude"], message: "Koordinat harus berupa pasangan atau kosong keduanya." });
  if ((value.officialContactShared || value.picContactShared) && (!value.contactConsentConfirmed || !value.contactConsentSource)) ctx.addIssue({ code: "custom", path: ["contactConsentConfirmed"], message: "Izin berbagi kontak memerlukan konfirmasi dan sumber persetujuan." });
  if (value.officialContactShared && !value.officialPhone) ctx.addIssue({ code: "custom", path: ["officialPhone"], message: "Nomor lembaga diperlukan." });
  if (value.picContactShared && (!value.picName || !value.picPhone)) ctx.addIssue({ code: "custom", path: ["picPhone"], message: "Nama dan nomor PIC diperlukan untuk berbagi." });
}
export const locationSchema = locationFields.strict().superRefine(locationCheck);
export const locationUpdateSchema = locationFields.extend(versionSchema.shape).strict().superRefine(locationCheck);
const reportFields = z.object({ title: text(200).min(3), body: text(20000), category: z.enum(categories), cityCode: z.enum(regionCodes), district,
  locationId: idSchema.nullable(), observedAt: realDate, source: text(1000), urgency: z.enum(["NORMAL", "HIGH"]), audience: z.enum(["SHARED", "ADMIN_ONLY"]), hideAuthor: z.boolean() });
function reportCheck(value: z.infer<typeof reportFields>, ctx: z.RefinementCtx) {
  regionCheck(value, ctx);
  if (value.category === "SENSITIVE" && value.audience !== "ADMIN_ONLY") ctx.addIssue({ code: "custom", path: ["audience"], message: "Laporan sensitif hanya untuk pengelola." });
}
export const reportSchema = reportFields.strict().superRefine(reportCheck);
export const reportUpdateSchema = reportFields.extend(versionSchema.shape).strict().superRefine(reportCheck);
export function submissionError(value: { title: string; body: string; source: string; observedAt: string }) {
  if (value.title.trim().length < 3 || value.body.trim().length < 10 || !value.source.trim()) return "Lengkapi judul, isi minimal 10 karakter, dan sumber sebelum mengajukan.";
  if (/\[\s*ISI\s*:|\{\{[^}]+\}\}/i.test(`${value.title}\n${value.body}\n${value.source}`)) return "Placeholder template belum dilengkapi.";
  if (value.observedAt > new Date().toISOString().slice(0, 10)) return "Tanggal pengamatan tidak boleh di masa depan.";
  return null;
}
export const submitSchema = versionSchema.extend({ reviewed: z.literal(true) }).strict();
export const moderateSchema = versionSchema.extend({ decision: z.enum(["APPROVED", "REJECTED", "HIDDEN"]), reason: text(2000).min(3) }).strict();
export const followupSchema = versionSchema.extend({ workStatus: z.enum(workStatuses), followupSummary: text(4000), coordinatorName: text(200), dueDate: realDate.nullable() }).strict();
export const listSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: text(120).optional(), cityCode: z.enum(regionCodes).optional(), district: district.optional(),
  category: z.enum(categories).optional(), publicationStatus: z.enum(publications).optional(), workStatus: z.enum(workStatuses).optional(),
  mine: z.enum(["true", "false"]).optional(),
}).strict();