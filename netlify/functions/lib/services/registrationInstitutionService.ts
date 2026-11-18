import { createHash } from "node:crypto";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { institutions } from "../db/schema";
import { ConflictError, ValidationError } from "../utils/errors";
import { getDbClient } from "../db/client";
import { knownInstitutionRegion } from "../../../../src/lib/institutionRegion";
import {
  INSTITUTION_APOSTROPHES,
  REGISTRATION_INSTITUTION_NAME_MAX,
  type RegistrationInstitutionSuggestion,
} from "../../../../src/lib/registrationInstitution";

type Database = ReturnType<typeof getDbClient>;

export function normalizeInstitutionName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function registrationInstitutionName(name?: string | null) {
  const normalized = normalizeInstitutionName(name || "");
  if (normalized && (normalized.length < 3 || normalized.length > REGISTRATION_INSTITUTION_NAME_MAX)) {
    throw new ValidationError("Nama lembaga/komunitas harus 3 sampai 180 karakter.");
  }
  return normalized;
}

const institutionIdentity = {
  id: institutions.id, name: institutions.name, status: institutions.status, deletedAt: institutions.deletedAt,
};
const activeInstitution = and(eq(institutions.status, "ACTIVE"), isNull(institutions.deletedAt));
const publicInstitution = and(activeInstitution, eq(institutions.verificationStatus, "VERIFIED"));
const active = (row: { status: string; deletedAt: Date | null }) => row.status === "ACTIVE" && !row.deletedAt;

export async function findRegistrationInstitutionSuggestions(search: string): Promise<RegistrationInstitutionSuggestion[]> {
  const name = sql<string>`btrim(regexp_replace(lower(translate(${institutions.name}, ${INSTITUTION_APOSTROPHES}, '')), '[^[:alnum:]]+', ' ', 'g'))`;
  const matchesAllWords = sql`not exists (select 1 from unnest(string_to_array(${search}, ' ')) as word(term)
    where strpos(${name}, word.term) = 0)`;
  const rank = sql`case when ${name} = ${search} then 0 when strpos(${name}, ${search}) = 1 then 1 else 2 end`;
  const rows = await getDbClient().select({
    id: institutions.id, name: institutions.name, cityCode: institutions.cityCode, provinceCode: institutions.provinceCode,
  }).from(institutions).where(and(publicInstitution, matchesAllWords))
    .orderBy(asc(rank), asc(institutions.name), asc(institutions.cityCode), asc(institutions.id)).limit(8);
  return rows.map((row) => {
    const { city, province } = knownInstitutionRegion(row.cityCode, row.provinceCode);
    return { id: row.id, name: row.name, region: [city, province].filter(Boolean).join(", ") || null };
  });
}

/** Both paths share the same code so concurrent registrations reuse the same record. */
async function createOrReuseRegistrationCommunity(db: Database, normalized: string) {
  const key = normalized.toLocaleLowerCase("id-ID");
  const code = `REG-${createHash("sha256").update(key).digest("hex").slice(0, 16).toUpperCase()}`;
  const [created] = await db.insert(institutions).values({ code, name: normalized,
    institutionType: "COMMUNITY", verificationStatus: "UNVERIFIED", status: "ACTIVE" })
    .onConflictDoNothing({ target: institutions.code }).returning(institutionIdentity);
  if (created) return created;
  const [existing] = await db.select(institutionIdentity).from(institutions)
    .where(eq(institutions.code, code)).limit(1).for("share");
  if (!existing || normalizeInstitutionName(existing.name).toLocaleLowerCase("id-ID") !== key) {
    throw new ConflictError("Nama lembaga/komunitas tidak dapat dicocokkan. Hubungi panitia.");
  }
  return existing;
}

export async function resolveRegistrationInstitution(db: Database, name?: string | null) {
  const normalized = registrationInstitutionName(name);
  if (!normalized) return null;
  const key = normalized.toLocaleLowerCase("id-ID");
  const [byName] = await db.select({ id: institutions.id }).from(institutions)
    .where(sql`lower(trim(${institutions.name})) = ${key}`).limit(1);
  return byName?.id ?? (await createOrReuseRegistrationCommunity(db, normalized)).id;
}

function unavailableInstitution() {
  return new ConflictError("Lembaga ini tidak dapat dipakai. Pilih lembaga lain atau kosongkan kolom ini.",
    { reason: "REGISTRATION_INSTITUTION_UNAVAILABLE" });
}

export async function resolvePublicRegistrationInstitution(db: Database, input: {
  institutionId?: string | null;
  institutionName?: string | null;
}) {
  if (input.institutionId) {
    const [selected] = await db.select({ id: institutions.id }).from(institutions)
      .where(and(eq(institutions.id, input.institutionId), publicInstitution)).limit(1).for("share");
    if (!selected) throw unavailableInstitution();
    return selected.id;
  }
  const normalized = registrationInstitutionName(input.institutionName);
  if (!normalized) return null;
  const key = normalized.toLocaleLowerCase("id-ID");
  const matches = await db.select(institutionIdentity).from(institutions)
    .where(sql`lower(btrim(regexp_replace(${institutions.name}, '[[:space:]]+', ' ', 'g'))) = ${key}`)
    .orderBy(desc(sql`(${activeInstitution})`), asc(institutions.id)).limit(2).for("share");
  const available = matches.filter(active);
  if (available.length > 1) {
    throw new ConflictError("Ada lebih dari satu lembaga dengan nama ini. Pilih lembaga sesuai wilayahnya atau hubungi panitia.",
      { reason: "REGISTRATION_INSTITUTION_AMBIGUOUS" });
  }
  if (available.length === 1) return available[0].id;
  if (matches.length) throw unavailableInstitution();

  const community = await createOrReuseRegistrationCommunity(db, normalized);
  if (!active(community)) throw unavailableInstitution();
  return community.id;
}
