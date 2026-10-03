import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileEditor, canLeaveProfile, createProfileEditor, isProfileDirty, profileDraft, profileEditorReducer, profilePatch, type PortalProfile } from "../../src/components/portal/ProfileEditor";
import { INDONESIA_REGENCIES } from "../../src/lib/indonesiaRegionData";

vi.mock("../../src/lib/eventApi", () => ({ eventApi: vi.fn() }));
import { eventApi } from "../../src/lib/eventApi";

const profile: PortalProfile = { id: "profile-test", fullName: "Abdullah", email: "kontak@example.invalid", loginEmail: "login@example.invalid", phone: "08123456789", whatsapp: null, birthDate: "1985-06-10", profileStatus: "ACTIVE", primaryInstitution: { institutionName: "Lembaga Uji", institutionCode: "TEST" } };
const region = INDONESIA_REGENCIES.find((entry) => entry.id === "3273")!;
const selectedRegion = () => ({ city: region.city, province: region.province, cityCode: region.id, provinceCode: region.provinceId });
const edit = (fields: Parameters<typeof profileEditorReducer>[1] & { type: "edit" }) => profileEditorReducer(createProfileEditor(profile), fields);
afterEach(() => { vi.clearAllMocks(); });

describe("portal profile editor state and safe PATCH payload", () => {
  it("normalizes nullable fields but does not invent WhatsApp from phone or login email from contact", () => {
    const draft = profileDraft({ ...profile, birthDate: "1985-06-10T00:00:00.000Z" });
    expect(draft.birthDate).toBe("1985-06-10");
    expect(draft.whatsapp).toBe("");
    expect(draft.titlePrefix).toBe("");
    expect(draft).not.toHaveProperty("loginEmail");
    expect(isProfileDirty(createProfileEditor(profile))).toBe(false);
  });
  it("allows all self-service fields and never submits identity, login email, status or affiliation", () => {
    const state = edit({ type: "edit", fields: { fullName: " Nama Baru ", email: " baru@example.invalid ", titlePrefix: "Dr.", titleSuffix: "Lc.", birthPlace: "Bandung", birthDate: "1990-01-05", phone: "+628123456789", whatsapp: "081234567890", address: "Jalan Uji", educationSummary: "S1", expertiseSummary: "Fiqih", ...selectedRegion() } });
    const patch = profilePatch(state, "2026-10-03");
    expect(patch).toMatchObject({ fullName: "Nama Baru", email: "baru@example.invalid", titlePrefix: "Dr.", titleSuffix: "Lc.", birthPlace: "Bandung", birthDate: "1990-01-05", phone: "+628123456789", whatsapp: "081234567890", address: "Jalan Uji", educationSummary: "S1", expertiseSummary: "Fiqih", ...selectedRegion() });
    for (const key of ["loginEmail", "userId", "id", "profileStatus", "primaryInstitution", "approvalStatus"]) expect(patch).not.toHaveProperty(key);
    expect(profile.loginEmail).toBe("login@example.invalid");
  });
  it("canonicalizes old names from a selected code and leaves legacy free text untouched on unrelated saves", () => {
    expect(profileDraft({ ...profile, cityCode: region.id, city: "Incorrect name", province: "Incorrect province" })).toMatchObject(selectedRegion());
    const state = createProfileEditor({ ...profile, city: "Bandung", province: "Jabar", cityCode: null });
    const patch = profilePatch(profileEditorReducer(state, { type: "edit", fields: { fullName: "Nama Baru" } }));
    for (const key of ["city", "province", "cityCode", "provinceCode"]) expect(patch).not.toHaveProperty(key);
  });
  it("requires a real matching selection, not manually typed or forged city/province codes", () => {
    for (const fields of [{ city: "Kota Bandung" }, { ...selectedRegion(), provinceCode: "11" }, { ...selectedRegion(), cityCode: "9999" }, { ...selectedRegion(), province: "Fake" }, { ...selectedRegion(), city: "Fake" }]) {
      expect(() => profilePatch(edit({ type: "edit", fields }))).toThrow("Pilih kabupaten/kota");
    }
    expect(profilePatch(edit({ type: "edit", fields: selectedRegion() }))).toMatchObject(selectedRegion());
  });
  it("allows empty optional fields and explicitly clears a previous selected region", () => {
    const state = createProfileEditor({ ...profile, ...selectedRegion() });
    const changed = profileEditorReducer(state, { type: "edit", fields: { email: "", birthDate: "", city: "", province: "", cityCode: "", provinceCode: "" } });
    expect(profilePatch(changed)).toMatchObject({ email: "", birthDate: "", city: "", province: "", cityCode: "", provinceCode: "" });
  });
  it.each(["", " ", "A"])("rejects invalid required name %j", (fullName) => {
    expect(() => profilePatch(edit({ type: "edit", fields: { fullName } }))).toThrow("Nama lengkap");
  });
  it.each(["not-email", "bad@", "name @example.invalid"])("rejects invalid contact email %j", (email) => {
    expect(() => profilePatch(edit({ type: "edit", fields: { email } }))).toThrow("Email kontak");
  });
  it.each(["2030-01-01", "2026-02-30", "2026-13-01", "1899-12-31", "invalid"])("rejects invalid/future birth date %j", (birthDate) => {
    expect(() => profilePatch(edit({ type: "edit", fields: { birthDate } }), "2026-10-03")).toThrow("Tanggal lahir");
  });
  it.each(["123", "phone text", "081234567890123456"])("rejects invalid phone and WhatsApp %j", (phone) => {
    expect(() => profilePatch(edit({ type: "edit", fields: { phone } }))).toThrow("Nomor telepon");
    expect(() => profilePatch(edit({ type: "edit", fields: { whatsapp: phone } }))).toThrow("Nomor WhatsApp");
  });
  it("resets to latest saved server canonical values, not the original profile", () => {
    const dirty = edit({ type: "edit", fields: { fullName: "Changed", ...selectedRegion() } });
    expect(isProfileDirty(dirty)).toBe(true);
    const saved = profileEditorReducer(dirty, { type: "saved", profile: { ...profile, fullName: "Server canonical", ...selectedRegion() }, preview: false });
    expect(isProfileDirty(saved)).toBe(false);
    expect(saved.message).toContain("Email login tidak berubah");
    const reset = profileEditorReducer(profileEditorReducer(saved, { type: "edit", fields: { fullName: "Other" } }), { type: "reset" });
    expect(reset.fields.fullName).toBe("Server canonical");
    expect(reset.fields).toEqual(saved.fields);
  });
  it("retains edits and specific server errors for retry; editing clears stale success/error", () => {
    const dirty = edit({ type: "edit", fields: { email: "changed@example.invalid" } });
    const failed = profileEditorReducer(profileEditorReducer(dirty, { type: "saving" }), { type: "error", message: "Email kontak sudah digunakan profil lain." });
    expect(failed.message).toBe("Email kontak sudah digunakan profil lain.");
    expect(failed.fields.email).toBe("changed@example.invalid");
    expect(isProfileDirty(failed)).toBe(true);
    expect(profileEditorReducer(failed, { type: "edit", fields: { email: "retry@example.invalid" } })).toMatchObject({ status: "idle", message: "" });
  });
  it("blocks editing/reset during save and navigation pending, and confirms discard only when dirty", () => {
    const clean = createProfileEditor(profile);
    const dirty = edit({ type: "edit", fields: { fullName: "Changed" } });
    const saving = profileEditorReducer(dirty, { type: "saving" });
    expect(profileEditorReducer(saving, { type: "edit", fields: { fullName: "Race" } })).toBe(saving);
    expect(profileEditorReducer(saving, { type: "reset" })).toBe(saving);
    const confirm = vi.fn(() => false);
    expect(canLeaveProfile(clean, confirm)).toBe(true);
    expect(canLeaveProfile(saving, confirm)).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
    expect(canLeaveProfile(dirty, confirm)).toBe(false);
    confirm.mockReturnValue(true);
    expect(canLeaveProfile(dirty, confirm)).toBe(true);
  });
  it("preview success explicitly never claims real persistence", () => {
    const saved = profileEditorReducer(createProfileEditor(profile), { type: "saved", profile, preview: true });
    expect(saved.message).toContain("tidak dikirim ke server");
    expect(isProfileDirty(saved)).toBe(false);
  });
});

describe("portal profile editor accessible UI (no real API)", () => {
  it("renders all fields and unchanged read-only login, province and restricted data", () => {
    const html = renderToStaticMarkup(<ProfileEditor profile={{ ...profile, ...selectedRegion() }} onSaved={vi.fn()} />);
    for (const key of ["fullName", "email", "titlePrefix", "titleSuffix", "birthPlace", "birthDate", "phone", "whatsapp", "address", "educationSummary", "expertiseSummary"]) expect(html).toContain(`id="profile-${key}"`);
    expect(html).toContain('aria-label="Edit profil peserta"');
    expect(html).toContain('id="profile-loginEmail" readonly=""');
    expect(html).toContain('value="login@example.invalid"');
    expect(html).toMatch(/id="profile-province"[^>]*readonly=""/);
    expect(html).toContain("Kode kabupaten/kota:");
    expect(html).toContain("bukan untuk mengganti email login");
    expect(html).toContain("Lembaga Uji");
    expect(html).toContain('role="status"');
    expect(html).toContain('type="submit" disabled=""');
    expect(eventApi).not.toHaveBeenCalled();
  });
  it("does not substitute contact email for unavailable account login email", () => {
    const html = renderToStaticMarkup(<ProfileEditor profile={{ ...profile, loginEmail: undefined }} onSaved={vi.fn()} preview />);
    expect(html).toContain('id="profile-loginEmail" readonly=""');
    expect(html).toContain('value="Tidak tersedia"');
    expect(html).toContain("tidak disimpan ke server");
    expect(eventApi).not.toHaveBeenCalled();
  });
});