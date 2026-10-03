import { z } from "zod";
import { ValidationError } from "../utils/errors";

export const ytsNoteId = z.string().uuid();
export const ytsNoteFlag = z.enum(["BLUE", "YELLOW", "RED", "GREEN"]);
const fields = { title: z.string().trim().min(3).max(200), body: z.string().trim().min(3).max(10000), flag: ytsNoteFlag };
export const ytsNoteCreate = z.object(fields).strict();
export const ytsNoteVersion = z.object({ expectedVersion: z.number().int().min(1).max(2147483646) }).strict();
export const ytsNoteUpdate = ytsNoteCreate.extend(ytsNoteVersion.shape).strict();
export const ytsNoteArchive = ytsNoteVersion.extend({ archived: z.boolean() }).strict();
export const ytsNoteList = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(20),
  archived: z.enum(["true", "false"]).default("false"), flag: ytsNoteFlag.optional(),
}).strict();
export const ytsNoteSummaryQuery = z.object({ ids: z.string().max(1900).transform(value => value.split(",")).pipe(z.array(ytsNoteId).min(1).max(50)) }).strict();
export function parseYtsNotes<S extends z.ZodTypeAny>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError(result.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; "));
  return result.data;
}