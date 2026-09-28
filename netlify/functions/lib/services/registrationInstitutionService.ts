import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { institutions } from "../db/schema";
import { ConflictError, ValidationError } from "../utils/errors";
import { getDbClient } from "../db/client";

type Database = ReturnType<typeof getDbClient>;

export function normalizeInstitutionName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

/** Idempotent for concurrent submissions of the same community name. */
export async function resolveRegistrationInstitution(db: Database, name?: string | null) {
  const normalized = normalizeInstitutionName(name || "");
  if (!normalized) return null;
  if (normalized.length < 3 || normalized.length > 180) throw new ValidationError("Nama lembaga/komunitas harus 3–180 karakter.");
  const key = normalized.toLocaleLowerCase("id-ID");
  const [byName] = await db.select({ id: institutions.id }).from(institutions)
    .where(sql`lower(trim(${institutions.name})) = ${key}`).limit(1);
  if (byName) return byName.id;
  const code = `REG-${createHash("sha256").update(key).digest("hex").slice(0, 16).toUpperCase()}`;
  const [created] = await db.insert(institutions).values({ code, name: normalized,
    institutionType: "COMMUNITY", verificationStatus: "UNVERIFIED", status: "ACTIVE" })
    .onConflictDoNothing({ target: institutions.code }).returning({ id: institutions.id });
  if (created) return created.id;
  const [existing] = await db.select({ id: institutions.id, name: institutions.name }).from(institutions)
    .where(eq(institutions.code, code)).limit(1);
  if (!existing || normalizeInstitutionName(existing.name).toLocaleLowerCase("id-ID") !== key) {
    throw new ConflictError("Nama lembaga/komunitas tidak dapat dicocokkan. Hubungi panitia.");
  }
  return existing.id;
}
