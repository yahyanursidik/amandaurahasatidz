import { describe, expect, it } from "vitest";
import { resolvePublicInvitationUrl } from "../../src/lib/publicInvitationUrl";
import { getNextEventStatus } from "../../netlify/functions/lib/services/eventStateService";
import { updateEventSessionSchema } from "../../netlify/functions/lib/validations/eventValidation";
import { getRegularRegistrationState } from "../../src/lib/regularRegistration";

describe("jalur pendaftaran dan sesi event", () => {
  it("mengizinkan undangan pribadi pada domain aplikasi, menolak tautan eksternal", () => {
    const origin = "https://daurah.example.org";
    expect(resolvePublicInvitationUrl("/invitation/institution/lembaga/inv_tok_123", origin))
      .toBe(`${origin}/invitation/institution/lembaga/inv_tok_123`);
    expect(resolvePublicInvitationUrl("https://evil.example/invitation/individual/tok", origin)).toBeNull();
    expect(resolvePublicInvitationUrl("/events/daurah/register", origin)).toBeNull();
  });
  it("membolehkan membuka ulang event tertutup dan menolak selesai yang sudah final", () => {
    expect(getNextEventStatus("REGISTRATION_CLOSED", "OPEN_REGISTRATION")).toBe("REGISTRATION_OPEN");
    expect(() => getNextEventStatus("COMPLETED", "OPEN_REGISTRATION")).toThrow();
  });
  it("memvalidasi edit parsial sesi tanpa mengizinkan pindah hari melalui PATCH", () => {
    expect(updateEventSessionSchema.parse({ room: "Aula utama" })).toEqual({ room: "Aula utama" });
    expect(updateEventSessionSchema.safeParse({ eventDayId: "00000000-0000-4000-8000-000000000001" }).success).toBe(false);
    expect(updateEventSessionSchema.safeParse({}).success).toBe(false);
  });
  it("menampilkan form hanya pada jalur reguler yang dibuka dan belum melewati tenggat", () => {
    const program = { audienceMode: "MIXED", status: "REGISTRATION_OPEN", regularQuota: 20,
      regularApproved: 4, invitationApproved: 2, capacity: 30,
      registrationOpenAt: "2026-11-01T00:00:00+07:00", registrationCloseAt: "2026-12-01T00:00:00+07:00" };
    const now = new Date("2026-11-12T00:00:00+07:00");
    expect(getRegularRegistrationState(program, now).open).toBe(true);
    expect(getRegularRegistrationState({ ...program, status: "PUBLISHED" }, now).reason).toMatch(/belum membuka/);
    expect(getRegularRegistrationState({ ...program, status: "PUBLISHED", registrationCloseAt: "2026-10-01T00:00:00+07:00" }, now).reason).toMatch(/jadwal pendaftaran sudah lewat/i);
    expect(getRegularRegistrationState({ ...program, registrationCloseAt: "2026-10-01T00:00:00+07:00" }, now).reason).toMatch(/sudah lewat/);
    expect(getRegularRegistrationState({ ...program, regularApproved: 20 }, now).reason).toMatch(/penuh/);
    expect(getRegularRegistrationState({ ...program, audienceMode: "INSTITUTION_INVITATION" }, now).open).toBe(false);
  });
});
