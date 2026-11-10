import { ZodError, type ZodTypeAny, type output } from "zod";
import { ValidationError } from "./errors";

export function validateRequestData<T extends ZodTypeAny>(schema: T, data: unknown): output<T> {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const formattedErrors: Record<string, string> = {};
      error.errors.forEach((err) => {
        const fieldName = err.path.join(".");
        formattedErrors[fieldName] = err.message;
      });
      throw new ValidationError("Validasi payload gagal.", { fieldErrors: formattedErrors });
    }
    throw error;
  }
}
