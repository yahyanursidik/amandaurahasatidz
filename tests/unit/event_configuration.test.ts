import { describe, expect, it } from "vitest";
import type { EventFormValues } from "../../src/components/admin/events/EventForm";
import {
  includesInstitutionInvitation,
  includesInvitationRegistration,
  includesRegularRegistration,
  validateEventConfiguration,
} from "../../src/lib/eventConfiguration";
import { assertQuotaCoversApproved } from "../../netlify/functions/lib/services/eventQuota";
import { createEventSchema } from "../../netlify/functions/lib/validations/eventValidation";

const base: EventFormValues = {
  code: "DAURAH-01", slug: "daurah-01", name: "Daurah Asatidz", subtitle: "", description: "",
  posterUrl: "", posterAlt: "", posterFocalPoint: "CENTER", audienceMode: "MIXED",
  attendanceMode: "DAILY_AND_SESSION", timezone: "Asia/Jakarta",
  startDate: "2027-02-10", endDate: "2027-02-12", registrationOpenAt: "2027-01-01T08:00",
  registrationCloseAt: "2027-02-01T17:00", invitationResponseDeadline: "2027-02-09T17:00",
  attendanceConfirmationDeadline: "", attendanceConfirmationRequired: true, lateConfirmationPolicy: "BLOCK",
  venueName: "", venueAddress: "", publicContactWhatsapp: "", mapsUrl: "",
  defaultInstitutionQuota: "2", capacity: "100", regularQuota: "40", invitationQuota: "60",
};

describe("konfigurasi event daurah", () => {
  it("menghubungkan pilihan jalur dengan aturan reguler, undangan, dan lembaga", () => {
    expect(includesRegularRegistration("PUBLIC_OPEN")).toBe(true);
    expect(includesInvitationRegistration("PUBLIC_OPEN")).toBe(false);
    expect(includesInstitutionInvitation("INDIVIDUAL_INVITATION")).toBe(false);
    expect(includesRegularRegistration("MIXED")).toBe(true);
    expect(includesInstitutionInvitation("MIXED")).toBe(true);
  });

  it("menolak urutan tanggal, tenggat, dan kuota yang bertentangan sebelum menyimpan", () => {
    expect(validateEventConfiguration(base)).toEqual({});
    const errors = validateEventConfiguration({ ...base, endDate: "2027-02-09",
      registrationCloseAt: "2027-01-01T07:00", invitationResponseDeadline: "2027-02-10T08:00",
      capacity: "90", regularQuota: "40.5" });
    expect(errors.endDate).toBeTruthy();
    expect(errors.registrationCloseAt).toBeTruthy();
    expect(errors.invitationResponseDeadline).toBeTruthy();
    expect(errors.regularQuota).toBeTruthy();
    expect(errors.capacity).toBeTruthy();
  });

  it("menolak kuota baru yang lebih kecil dari peserta disetujui", () => {
    expect(() => assertQuotaCoversApproved({ capacity: 30, regularQuota: 10, invitationQuota: 20 },
      { regular: 11, invitation: 5 })).toThrow(/Kuota reguler/);
    expect(() => assertQuotaCoversApproved({ capacity: 15 }, { regular: 10, invitation: 6 })).toThrow(/Kapasitas total/);
    expect(() => assertQuotaCoversApproved({ capacity: 21 }, { regular: 8, invitation: 12, total: 22 })).toThrow(/Kapasitas total/);
  });

  it("menolak pecahan kursi, tanggal tidak nyata, dan zona waktu tidak didukung di API", () => {
    const payload = { code: base.code, slug: base.slug, name: base.name,
      startDate: base.startDate, endDate: base.endDate, timezone: base.timezone };
    expect(createEventSchema.safeParse({ ...payload, capacity: 1.5 }).success).toBe(false);
    expect(createEventSchema.safeParse({ ...payload, capacity: 2, regularQuota: 3 }).success).toBe(false);
    expect(createEventSchema.safeParse({ ...payload, defaultInstitutionQuota: 2.5 }).success).toBe(false);
    expect(createEventSchema.safeParse({ ...payload, startDate: "2027-02-30" }).success).toBe(false);
    expect(createEventSchema.safeParse({ ...payload, timezone: "UTC" }).success).toBe(false);
  });
});
