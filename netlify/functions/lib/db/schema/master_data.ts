import { pgTable, uuid, text, timestamp, boolean, date, index } from "drizzle-orm/pg-core";
import { users } from "./foundation";

// 5. institutions
export const institutions = pgTable(
  "institutions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").unique().notNull(),
    name: text("name").notNull(),
    legalName: text("legal_name"),
    institutionType: text("institution_type"),
    email: text("email"),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    address: text("address"),
    provinceCode: text("province_code"),
    cityCode: text("city_code"),
    district: text("district"),
    postalCode: text("postal_code"),
    website: text("website"),
    status: text("status").notNull().default("ACTIVE"),
    verificationStatus: text("verification_status").notNull().default("UNVERIFIED"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_institutions_name").on(table.name),
  ]
);

// 6. institution_representatives
export const institutionRepresentatives = pgTable(
  "institution_representatives",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutions.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    position: text("position"),
    isPrimary: boolean("is_primary").notNull().default(false),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_inst_rep_inst").on(table.institutionId),
  ]
);

// 7. ustadz_profiles
export const ustadzProfiles = pgTable(
  "ustadz_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").unique().references(() => users.id),
    fullName: text("full_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    titlePrefix: text("title_prefix"),
    titleSuffix: text("title_suffix"),
    email: text("email"),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    birthPlace: text("birth_place"),
    birthDate: date("birth_date"),
    address: text("address"),
    cityCode: text("city_code"),
    provinceCode: text("province_code"),
    educationSummary: text("education_summary"),
    expertiseSummary: text("expertise_summary"),
    profilePhotoObjectKey: text("profile_photo_object_key"),
    profileStatus: text("profile_status").notNull().default("ACTIVE"),
    mergedIntoId: uuid("merged_into_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_ustadz_norm_name").on(table.normalizedName),
    index("idx_ustadz_email").on(table.email),
    index("idx_ustadz_phone").on(table.phone),
  ]
);

// 8. ustadz_institution_affiliations
export const ustadzInstitutionAffiliations = pgTable(
  "ustadz_institution_affiliations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ustadzId: uuid("ustadz_id").notNull().references(() => ustadzProfiles.id, { onDelete: "cascade" }),
    institutionId: uuid("institution_id").notNull().references(() => institutions.id, { onDelete: "cascade" }),
    position: text("position"),
    isPrimary: boolean("is_primary").notNull().default(false),
    startDate: date("start_date"),
    endDate: date("end_date"),
    status: text("status").notNull().default("ACTIVE"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verifiedBy: uuid("verified_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_affil_ustadz").on(table.ustadzId),
    index("idx_affil_inst").on(table.institutionId),
  ]
);
