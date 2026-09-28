import { describe, expect, it } from "vitest";
import { suggestRegencies } from "../../src/lib/indonesiaRegions";
import { submitResponseSchema, submitIndividualInvitationSchema } from "../../netlify/functions/lib/validations/invitationValidation";
import { resolveMatchingProfile } from "../../netlify/functions/lib/services/importService";
import { normalizeInstitutionName } from "../../netlify/functions/lib/services/registrationInstitutionService";

describe("wilayah, undangan, dan pencocokan impor", () => {
  it("menyarankan kabupaten/kota beserta provinsi setelah beberapa huruf", () => {
    const cities = [
      { id: "3273", provinceId: "32", city: "KOTA BANDUNG", province: "JAWA BARAT" },
      { id: "3204", provinceId: "32", city: "KABUPATEN BANDUNG", province: "JAWA BARAT" },
    ];
    expect(suggestRegencies(cities, "ban")).toHaveLength(2);
    expect(suggestRegencies(cities, "b")).toEqual([]);
  });

  it("merapikan nama lembaga/komunitas sebelum dicocokkan dengan data induk", () => {
    expect(normalizeInstitutionName("  Komunitas   Asatidz  Bandung  ")).toBe("Komunitas Asatidz Bandung");
  });

  it("memprioritaskan email spesifik ketika nomor WhatsApp dipakai oleh beberapa profil", () => {
    const profiles = [
      { id: "a", normalizedName: "adi sakti", email: "adi@example.org", phone: null, whatsapp: "081234567890" },
      { id: "b", normalizedName: "riadi", email: "riadi@example.org", phone: null, whatsapp: "081234567890" },
    ];
    expect(resolveMatchingProfile(profiles, { fullName: "Adi Sakti", email: "ADI@example.org", whatsapp: "081234567890" }))
      .toMatchObject({ profile: { id: "a" }, ambiguous: false });
    expect(resolveMatchingProfile(profiles, { fullName: "Riadi", whatsapp: "081234567890" }))
      .toMatchObject({ profile: { id: "b" }, ambiguous: false });
    expect(resolveMatchingProfile(profiles, { fullName: "Tak Dikenal", whatsapp: "081234567890" }).ambiguous).toBe(true);
  });

  it("menerima undangan lembaga tanpa OTP dan membatasi individu menjadi satu peserta", () => {
    const delegate = { fullName: "Ustadz Ahmad", email: "ahmad@example.org", whatsapp: "081234567890",
      city: "KOTA BANDUNG", province: "JAWA BARAT", isLead: true };
    expect(submitResponseSchema.safeParse({ responseStatus: "ACCEPTED", isFinal: true, delegates: [delegate] }).success).toBe(true);
    expect(submitIndividualInvitationSchema.safeParse({ responseStatus: "ACCEPTED", delegates: [delegate, { ...delegate, email: "lain@example.org" }] }).success).toBe(false);
  });
});
