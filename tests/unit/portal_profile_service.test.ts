import { beforeEach, describe, expect, it, vi } from "vitest";
import { ustadzProfiles } from "../../netlify/functions/lib/db/schema";
import { updateUstadzSelfProfileSchema } from "../../netlify/functions/lib/validations/ustadzValidation";
import { INDONESIA_REGENCIES } from "../../src/lib/indonesiaRegionData";

const mocks = vi.hoisted(() => ({ own: vi.fn(), update: vi.fn(), audit: vi.fn() }));
vi.mock("../../netlify/functions/lib/repositories/portalProfileRepository", () => ({
  findOwnPortalProfileRepository: mocks.own, updateOwnPortalProfileRepository: mocks.update,
}));
vi.mock("../../netlify/functions/lib/services/auditService", () => ({ createAuditLog: mocks.audit }));
import { preparePortalProfileChanges, updatePortalProfileService } from "../../netlify/functions/lib/services/portalProfileService";

const userId = "44444444-4444-4444-8444-444444444444";
const loginEmail = "login@example.invalid";
const profile = {
  id: "11111111-1111-4111-8111-111111111111", userId, fullName: "Nama Lama", normalizedName: "nama lama",
  email: "contact@example.invalid", cityCode: "obsolete-code", provinceCode: "old-province", profileStatus: "ACTIVE",
  deletedAt: null, mergedIntoId: null, updatedAt: new Date("2026-01-01"),
} as typeof ustadzProfiles.$inferSelect;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.own.mockResolvedValue(profile);
  mocks.update.mockImplementation(async (existing, _actor, changes) => ({ ...existing, ...changes }));
});

describe("portal profile validation", () => {
  it("accepts all editable fields, trims and clears optional values", () => {
    expect(updateUstadzSelfProfileSchema.parse({ fullName: " Nama Baru ", email: " CONTACT@EXAMPLE.INVALID ",
      titlePrefix: "Dr.", titleSuffix: "Lc.", birthPlace: "Bandung", birthDate: "1990-02-28", phone: "081234567890",
      whatsapp: "", address: "", educationSummary: "S1", expertiseSummary: "Fiqih" })).toMatchObject({
      fullName: "Nama Baru", email: "contact@example.invalid", whatsapp: null, address: null,
    });
  });
  it.each([{}, { fullName: " " }, { fullName: "A" }, { fullName: "a".repeat(161) }, { email: "invalid" },
    { birthDate: "2026-02-30" }, { birthDate: "9999-01-01" }, { birthDate: "1990-2-01" }, { phone: "abc12345" },
    { phone: "123" }, { address: "a".repeat(501) }, { expertiseSummary: "a".repeat(2001) }])("rejects invalid input %j", (input) => {
    expect(updateUstadzSelfProfileSchema.safeParse(input).success).toBe(false);
  });
  it.each(["loginEmail", "userId", "id", "profileStatus", "approvalStatus", "institutionId", "affiliations", "passwordHash"])("rejects protected field %s", (key) => {
    expect(updateUstadzSelfProfileSchema.safeParse({ fullName: "Nama Baru", [key]: "forbidden" }).success).toBe(false);
  });
});

describe("portal profile service", () => {
  it("updates own name and CONTACT email only, never trusts a supplied profile id", async () => {
    const result = await updatePortalProfileService(userId, loginEmail, { fullName: " Nama Baru ", email: "new-contact@example.invalid" }, "request");
    expect(mocks.own).toHaveBeenCalledWith(userId);
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith(profile, userId, { fullName: "Nama Baru", normalizedName: "nama baru", email: "new-contact@example.invalid" });
    expect(result).toMatchObject({ fullName: "Nama Baru", email: "new-contact@example.invalid", loginEmail });
    expect(mocks.audit).toHaveBeenCalledOnce();
  });
  it("rejects restricted payload even from direct service callers", async () => {
    await expect(updatePortalProfileService(userId, loginEmail, { profileStatus: "ACTIVE" }, "request")).rejects.toMatchObject({ statusCode: 422 });
    expect(mocks.own).not.toHaveBeenCalled();
  });
  it("does not update missing ownership", async () => {
    mocks.own.mockResolvedValue(undefined);
    await expect(updatePortalProfileService(userId, loginEmail, { address: "new" }, "request")).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each([{ deletedAt: new Date() }, { mergedIntoId: "other" }, { profileStatus: "ARCHIVED" }, { profileStatus: "MERGED" }])("preserves archived/merged restrictions %j", async (fields) => {
    mocks.own.mockResolvedValue({ ...profile, ...fields });
    await expect(updatePortalProfileService(userId, loginEmail, { address: "new" }, "request")).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects concurrent ownership/profile change and does not audit success", async () => {
    mocks.update.mockResolvedValue(undefined);
    await expect(updatePortalProfileService(userId, loginEmail, { address: "new" }, "request")).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("allows omitted or unchanged legacy codes without blocking unrelated fields", () => {
    expect(preparePortalProfileChanges(profile, { address: "new" })).toEqual({ address: "new" });
    expect(preparePortalProfileChanges(profile, { address: "new", cityCode: "obsolete-code", provinceCode: "old-province" })).toEqual({ address: "new" });
  });
  it("derives canonical region from city code, not client labels", async () => {
    const region = INDONESIA_REGENCIES[0];
    const result = await updatePortalProfileService(userId, loginEmail, { cityCode: region.id, city: "spoof", province: "spoof" }, "request");
    expect(mocks.update.mock.calls[0][2]).toEqual({ cityCode: region.id, provinceCode: region.provinceId });
    expect(result).toMatchObject({ city: region.city, province: region.province, provinceCode: region.provinceId });
  });
  it.each([{ cityCode: "invalid-new-code" }, { provinceCode: "99" }, { city: "free-text" },
    { cityCode: "3273", provinceCode: "99" }])("rejects invalid region changes %j", (input) => {
    expect(() => preparePortalProfileChanges(profile, input)).toThrow();
  });
  it("clears optional contact email, birth date, phone and all region fields", async () => {
    await updatePortalProfileService(userId, loginEmail, { email: "", birthDate: "", phone: "", cityCode: "", provinceCode: "", city: "", province: "" }, "request");
    expect(mocks.update.mock.calls[0][2]).toEqual({ email: null, birthDate: null, phone: null, cityCode: null, provinceCode: null });
  });
});