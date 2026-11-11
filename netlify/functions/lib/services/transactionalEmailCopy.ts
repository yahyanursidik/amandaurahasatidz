import { z } from "zod";

export const TRANSACTIONAL_EMAIL_COPY_CODE = "TRANSACTIONAL_EMAIL_COPY_SETTINGS";

const salutation = z.string().trim().min(10).max(350)
  .refine((value) => value.includes("{{name}}") && !/{{|}}/.test(value.replaceAll("{{name}}", "")),
    "Sapaan harus memuat {{name}} dan tidak boleh memakai variabel lain.");

export const transactionalEmailCopySchema = z.object({
  openingArabic: z.string().trim().min(20).max(1200)
    .refine((value) => !/{{|}}/.test(value), "Pembuka Arab tidak memakai variabel."),
  individualSalutation: salutation,
  institutionSalutation: salutation,
}).strict();

export type TransactionalEmailCopy = z.infer<typeof transactionalEmailCopySchema>;

export const updateTransactionalEmailCopySchema = z.object({
  settings: transactionalEmailCopySchema,
  expectedVersion: z.number().int().positive().nullable(),
}).strict();

export const DEFAULT_TRANSACTIONAL_EMAIL_COPY: TransactionalEmailCopy = {
  openingArabic: "بسم الله الرحمن الرحيم\n\nالحمد لله رب العالمين، والصلاة والسلام على رسول الله، وعلى آله وصحبه أجمعين، وبعد.",
  individualSalutation: "Al Ustadz Al Faadhil {{name}}, yang semoga dirahmati Allah Azza wa Jalla,",
  institutionSalutation: "Kepada Pimpinan {{name}}, yang semoga dirahmati Allah Azza wa Jalla,",
};

export function parseTransactionalEmailCopy(raw: string | null | undefined): TransactionalEmailCopy {
  if (!raw) return DEFAULT_TRANSACTIONAL_EMAIL_COPY;
  try {
    const parsed = transactionalEmailCopySchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_TRANSACTIONAL_EMAIL_COPY;
  } catch {
    return DEFAULT_TRANSACTIONAL_EMAIL_COPY;
  }
}

export function stripLegacyEmailGreeting(body: string): string {
  return body
    .replace(/^Assalamu['’]alaikum[^\n]*\n\s*\n/i, "")
    .replace(/^(?:Yth\.|Kepada Yth\.|Kepada Perwakilan) [^\n]*\n\s*\n/i, "");
}

export function transactionalEmailOpening(
  code: string,
  variables: Record<string, unknown>,
  copy: TransactionalEmailCopy,
): string {
  // Kode sekali pakai perlu cepat dibaca; jangan tambahkan pembuka panjang.
  if (code === "OTP_CODE") return "";
  const institutionName = String(variables.institutionName || "").trim();
  const personName = String(variables.ustadzName || variables.recipientName || "").trim();
  const rawName = institutionName || personName;
  if (!rawName) return copy.openingArabic;
  const name = institutionName ? rawName : rawName.replace(/^(?:al\s+)?(?:ustadz|ustad|ust\.)\s+/i, "");
  const template = institutionName ? copy.institutionSalutation : copy.individualSalutation;
  return `${copy.openingArabic}\n\n${template.replaceAll("{{name}}", name)}`;
}
