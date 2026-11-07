import { describe, expect, it } from "vitest";
import { getUstadzCompletenessPercent } from "../../netlify/functions/lib/repositories/ustadzRepository";

const completeProfile = {
  email: "ustadz@example.id", phone: "081234567890", whatsapp: null,
  address: "Bandung", cityCode: "3273", provinceCode: "32",
  educationSummary: "Pendidikan", expertiseSummary: "Kajian",
};

describe("kelengkapan profil asatidz", () => {
  it("menghitung tujuh aspek dan menerima telepon sebagai alternatif WhatsApp", () => {
    expect(getUstadzCompletenessPercent(completeProfile)).toBe(100);
  });
  it("menggunakan batas yang sama dengan filter perlu dilengkapi", () => {
    const profile = { ...completeProfile, email: null, educationSummary: null, expertiseSummary: null };
    expect(getUstadzCompletenessPercent(profile)).toBe(57);
    expect(getUstadzCompletenessPercent(profile)).toBeLessThan(70);
  });
});
