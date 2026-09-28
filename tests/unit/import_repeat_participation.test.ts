import { describe, expect, it } from "vitest";
import { countPreviouslyApprovedEvents } from "../../netlify/functions/lib/services/importService";
import { submitPublicRegistrationSchema } from "../../netlify/functions/lib/validations/publicRegistrationValidation";

describe("pendaftaran langsung dan riwayat impor", () => {
  it("menerima formulir reguler lengkap tanpa OTP dan menolak kontak ganda", () => {
    const input = { fullName: "Ustadz Ahmad", email: "ahmad@example.org", whatsapp: "081234567890",
      city: "KOTA BANDUNG", province: "JAWA BARAT",
      consentConfirmed: true, delegates: [{ fullName: "Ustadz Hasan", email: "hasan@example.org", whatsapp: "081234567891", city: "KOTA BANDUNG", province: "JAWA BARAT" }] };
    expect(submitPublicRegistrationSchema.parse(input)).not.toHaveProperty("challengeToken");
    expect(submitPublicRegistrationSchema.safeParse({ ...input, delegates: [{ ...input.delegates[0], email: input.email }] }).success).toBe(false);
    expect(submitPublicRegistrationSchema.safeParse({ ...input, consentConfirmed: false }).success).toBe(false);
  });
  it("menghitung event terdahulu yang disetujui berdasarkan profil sama, bukan row impor ganda", () => {
    const rows = [
      { ustadzId: "same", eventId: "event-1" }, { ustadzId: "same", eventId: "event-1" },
      { ustadzId: "same", eventId: "event-2" }, { ustadzId: "another", eventId: "event-3" },
    ];
    expect(countPreviouslyApprovedEvents(rows, "same", "current")).toBe(2);
    expect(countPreviouslyApprovedEvents(rows, "same", "event-2")).toBe(1);
  });
});
