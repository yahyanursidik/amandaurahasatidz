import { createHash } from "node:crypto";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { institutions } from "../db/schema";
import { ConflictError, ValidationError } from "../utils/errors";
import { getDbClient } from "../db/client";
import { knownInstitutionRegion } from "../../../../src/lib/institutionRegion";
import {
  REGISTRATION_INSTITUTION_NAME_MAX,
  REGISTRATION_INSTITUTION_PAGE_SIZE,
  type RegistrationInstitutionProposal,
} from "../../../../src/lib/registrationInstitution";
import { rankRegistrationInstitutions } from "./registrationInstitutionSearch";

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
  cityCode: institutions.cityCode, provinceCode: institutions.provinceCode,
};
const activeInstitution = and(eq(institutions.status, "ACTIVE"), isNull(institutions.deletedAt));
// REG- plus a 16-digit hash identifies names submitted through registration.
const publicInstitution = and(activeInstitution, sql`(${institutions.verificationStatus} = 'VERIFIED' or ${institutions.code} !~* '^REG-[0-9a-f]{16}$')`);
const active = (row: { status: string; deletedAt: Date | null }) => row.status === "ACTIVE" && !row.deletedAt;

export async function findRegistrationInstitutionSuggestions({ search, page }: { search: string; page: number }) {
  const rows = await getDbClient().select({
    id: institutions.id, name: institutions.name, cityCode: institutions.cityCode, provinceCode: institutions.provinceCode,
  }).from(institutions).where(publicInstitution);
  const options = rankRegistrationInstitutions(rows.map((row) => {
    const { city, province } = knownInstitutionRegion(row.cityCode, row.provinceCode);
    return { id: row.id, name: row.name, region: [city, province].filter(Boolean).join(", ") || null };
  }), search);
  const pageSize = REGISTRATION_INSTITUTION_PAGE_SIZE;
  return {
    data: options.slice((page - 1) * pageSize, page * pageSize),
    meta: { page, pageSize, total: options.length, pageCount: Math.max(1, Math.ceil(options.length / pageSize)) },
  };
}

/** Both paths share the same code so concurrent registrations reuse the same record. */
async function createOrReuseRegistrationCommunity(db: Database, normalized: string, region?: Pick<RegistrationInstitutionProposal, "provinceCode" | "cityCode">) {
  const key = normalized.toLocaleLowerCase("id-ID");
  const code = `REG-${createHash("sha256").update(key).digest("hex").slice(0, 16).toUpperCase()}`;
  const [created] = await db.insert(institutions).values({ code, name: normalized,
    institutionType: "COMMUNITY", verificationStatus: "UNVERIFIED", status: "ACTIVE",
    cityCode: region?.cityCode, provinceCode: region?.provinceCode })
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
  institutionProposal?: RegistrationInstitutionProposal | null;
}) {
  if (input.institutionId) {
    const [selected] = await db.select({ id: institutions.id }).from(institutions)
      .where(and(eq(institutions.id, input.institutionId), publicInstitution)).limit(1).for("share");
    if (!selected) throw unavailableInstitution();
    return selected.id;
  }
  const proposal = input.institutionProposal;
  const normalized = registrationInstitutionName(proposal?.name ?? input.institutionName);
  if (!normalized) return null;
  const key = normalized.toLocaleLowerCase("id-ID");
  const matches = await db.select(institutionIdentity).from(institutions)
    .where(sql`lower(btrim(regexp_replace(${institutions.name}, '[[:space:]]+', ' ', 'g'))) = ${key}`)
    .orderBy(asc(institutions.id)).for("share");
  const regionMatches = (row: { cityCode: string | null; provinceCode: string | null }) =>
    (!proposal?.provinceCode || !row.provinceCode || proposal.provinceCode === row.provinceCode)
    && (!proposal?.cityCode || !row.cityCode || proposal.cityCode === row.cityCode);
  const available = matches.filter((row) => active(row) && regionMatches(row));
  if (available.length > 1) {
    throw new ConflictError("Ada lebih dari satu lembaga dengan nama ini. Pilih lembaga sesuai wilayahnya atau hubungi panitia.",
      { reason: "REGISTRATION_INSTITUTION_AMBIGUOUS" });
  }
  if (available.length === 1) return available[0].id;
  const regionConflict = () => new ConflictError(
    "Nama ini sudah tercatat di wilayah lain. Pilih lembaga dari daftar atau sertakan nama cabang pada usulan baru.",
    { reason: "REGISTRATION_INSTITUTION_AMBIGUOUS" },
  );
  if (matches.some(active)) throw regionConflict();
  if (matches.length) throw unavailableInstitution();

  const community = await createOrReuseRegistrationCommunity(db, normalized, proposal ?? undefined);
  if (!active(community)) throw unavailableInstitution();
  if (!regionMatches(community)) throw regionConflict();
  return community.id;
}
