import { describe, expect, it } from "vitest";
import { assertPublicRegistrationOpen } from "../../netlify/functions/lib/services/publicRegistrationService";
import { assertValidQuotaAllocation, isRegularRegistrationSource, quotaForSource } from "../../netlify/functions/lib/services/eventQuota";
import { createEventSchema } from "../../netlify/functions/lib/validations/eventValidation";

const openEvent = {
  audienceMode: "MIXED",
  status: "REGISTRATION_OPEN",
  regularQuota: 12,
  registrationOpenAt: new Date("2026-09-01T00:00:00Z"),
  registrationCloseAt: new Date("2026-10-01T00:00:00Z"),
};

describe("jalur dan kuota program", () => {
  it("memisahkan alokasi reguler dan undangan", () => {
    const event = { capacity: 30, regularQuota: 10, invitationQuota: 20 };
    expect(() => assertValidQuotaAllocation(event)).not.toThrow();
    expect(quotaForSource(event, "DIRECT_PUBLIC")).toBe(10);
    expect(quotaForSource(event, "INSTITUTION_DELEGATION")).toBe(20);
    expect(isRegularRegistrationSource("DIRECT_ADMIN_UPLOAD")).toBe(true);
  });

  it("menolak jumlah alokasi yang melampaui kapasitas", () => {
    expect(() => assertValidQuotaAllocation({ capacity: 20, regularQuota: 10, invitationQuota: 11 })).toThrow(/Jumlah kuota/);
  });

  it("menjaga status, tanggal, dan kuota nol pada formulir publik", () => {
    expect(() => assertPublicRegistrationOpen(openEvent, new Date("2026-09-20T00:00:00Z"))).not.toThrow();
    expect(() => assertPublicRegistrationOpen({ ...openEvent, regularQuota: 0 }, new Date("2026-09-20T00:00:00Z"))).toThrow(/ditutup/);
    expect(() => assertPublicRegistrationOpen({ ...openEvent, audienceMode: "INSTITUTION_INVITATION" }, new Date("2026-09-20T00:00:00Z"))).toThrow(/undangan/);
    expect(() => assertPublicRegistrationOpen(openEvent, new Date("2026-10-02T00:00:00Z"))).toThrow(/ditutup/);
  });

  it("memvalidasi mode gabungan saat membuat event", () => {
    const base = { code: "ADA-27", slug: "ada-27", name: "Daurah 27", startDate: "2027-01-01", endDate: "2027-01-02", audienceMode: "MIXED", capacity: 20, regularQuota: 8, invitationQuota: 12 };
    expect(createEventSchema.safeParse(base).success).toBe(true);
    expect(createEventSchema.safeParse({ ...base, invitationQuota: 13 }).success).toBe(false);
  });
});
