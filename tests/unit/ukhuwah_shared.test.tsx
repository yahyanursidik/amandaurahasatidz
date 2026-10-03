import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { UkhuwahMap, projectCoordinate, unprojectCoordinate, hasMapCoordinates } from "../../src/components/ukhuwah/UkhuwahMap";
import { UKHUWAH_REPORT_TEMPLATES, canManageUkhuwah, isUkhuwahRegion, unresolvedUkhuwahFields,
  ukhuwahPhoneUrl, emptyUkhuwahLocation, type UkhuwahLocation } from "../../src/lib/ukhuwah";
import { ROLE_PERMISSIONS } from "../../src/config/permissions";
import { accessControlProvider } from "../../src/lib/refine/accessControlProvider";
import { vi } from "vitest";

describe("Peta Ukhuwah shared contract and privacy defaults", () => {
  it("provides eight constructive templates with a locked sensitive audience", () => {
    expect(UKHUWAH_REPORT_TEMPLATES).toHaveLength(8);
    expect(new Set(UKHUWAH_REPORT_TEMPLATES.map((t) => t.id)).size).toBe(8);
    expect(UKHUWAH_REPORT_TEMPLATES.find((t) => t.category === "SENSITIVE")?.audience).toBe("ADMIN_ONLY");
    expect(UKHUWAH_REPORT_TEMPLATES.every((t) => unresolvedUkhuwahFields(t.body))).toBe(true);
  });
  it("does not publish locations or grant contact consent by default", () => {
    expect(emptyUkhuwahLocation()).toMatchObject({ isPublished: false, isVerified: false,
      officialContactShared: false, picContactShared: false, contactConsentConfirmed: false, latitude: null, longitude: null });
  });
  it.each(["3273", "3277", "3204", "3217"])("includes operational area %s", (code) => expect(isUkhuwahRegion(code, "")).toBe(true));
  it("limits Sumedang to selected named districts, not the entire regency", () => {
    expect(isUkhuwahRegion("3211", "Kec. Jatinangor")).toBe(true);
    expect(isUkhuwahRegion("3211", "Pamulihan")).toBe(true);
    expect(isUkhuwahRegion("3211", "Sumedang Selatan")).toBe(false);
    expect(isUkhuwahRegion("3211", "")).toBe(false);
    expect(isUkhuwahRegion("3171", "")).toBe(false);
  });
  it("creates contact links only from validated numeric contact values", () => {
    expect(ukhuwahPhoneUrl("0812 3456 7890", true)).toBe("https://wa.me/6281234567890");
    expect(ukhuwahPhoneUrl("+62 812 3456 7890")).toBe("tel:+6281234567890");
    expect(ukhuwahPhoneUrl("javascript:alert(1)")).toBeNull();
    expect(ukhuwahPhoneUrl("123")).toBeNull();
  });
  it("allows only active, unscoped global managers", () => {
    expect(canManageUkhuwah([{ roleCode: "SYSTEM_ADMIN" }])).toBe(true);
    expect(canManageUkhuwah([{ roleCode: "SUPER_ADMIN", eventId: "event" }])).toBe(false);
    expect(canManageUkhuwah([{ roleCode: "SYSTEM_ADMIN", institutionId: "institution" }])).toBe(false);
    expect(canManageUkhuwah([{ roleCode: "SYSTEM_ADMIN", endsAt: "2000-01-01" }])).toBe(false);
    expect(canManageUkhuwah([{ roleCode: "SYSTEM_ADMIN", isActive: false }])).toBe(false);
    expect(canManageUkhuwah([{ roleCode: "SUPER_ADMIN", status: "INACTIVE" }])).toBe(false);
    expect(canManageUkhuwah([{ roleCode: "EVENT_ADMIN" }, { roleCode: "DATA_STEWARD" }])).toBe(false);
  });
  it("does not give event staff cross-event map management permission", () => {
    expect(ROLE_PERMISSIONS.USTADZ).toContain("ukhuwah.contribute");
    expect(ROLE_PERMISSIONS.SYSTEM_ADMIN).toContain("ukhuwah.moderate");
    expect(ROLE_PERMISSIONS.EVENT_ADMIN).not.toContain("ukhuwah.manage");
    expect(ROLE_PERMISSIONS.DATA_STEWARD).not.toContain("ukhuwah.manage");
  });
  it("connects separate protected admin and portal routes without a public map route", () => {
    const app = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
    expect(app).toContain('path="/admin/peta-ukhuwah/*"');
    expect(app).toContain('path="/portal/peta-ukhuwah/*"');
    expect(app).not.toContain('path="/peta-ukhuwah');
  });
  it("maps Refine operations to ukhuwah rather than unrelated event permissions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { effectivePermissions: ["ukhuwah.access", "ukhuwah.contribute"] } }) }));
    try {
      expect(await accessControlProvider.can({ resource: "ukhuwah", action: "list" })).toMatchObject({ can: true });
      expect(await accessControlProvider.can({ resource: "ukhuwah", action: "create" })).toMatchObject({ can: true });
      expect(await accessControlProvider.can({ resource: "ukhuwah", action: "edit" })).toMatchObject({ can: false });
      expect(await accessControlProvider.can({ resource: "ukhuwah", action: "moderate" })).toMatchObject({ can: false });
    } finally { vi.unstubAllGlobals(); }
  });
});
describe("native map geometry and no-network initial rendering", () => {
  it("rejects malformed, missing and unsupported map coordinates", () => {
    expect(hasMapCoordinates({ latitude: -6.91, longitude: 107.61 })).toBe(true);
    for (const value of [null, NaN, Infinity, 90, -91]) expect(hasMapCoordinates({ latitude: value, longitude: 107 })).toBe(false);
    for (const value of [null, NaN, Infinity, 181, -181]) expect(hasMapCoordinates({ latitude: -6.9, longitude: value })).toBe(false);
  });
  it("clamps panning at Mercator latitude limits", () => {
    expect(unprojectCoordinate(0, -1e9, 9).latitude).toBeCloseTo(85.05112878);
    expect(unprojectCoordinate(0, 1e9, 9).latitude).toBeCloseTo(-85.05112878);
  });
  it.each([9, 11, 16])("round-trips Bandung coordinates at zoom %i", (zoom) => {
    const point = projectCoordinate(-6.917, 107.619, zoom);
    const actual = unprojectCoordinate(point.x, point.y, zoom);
    expect(actual.latitude).toBeCloseTo(-6.917, 7);
    expect(actual.longitude).toBeCloseTo(107.619, 7);
  });
  it("renders pins but no external tiles before an explicit user choice", () => {
    const location = { ...emptyUkhuwahLocation(), id: "one", name: '<script>alert("x")</script>', latitude: -6.91, longitude: 107.61,
      version: 1, createdAt: "", updatedAt: "" } satisfies UkhuwahLocation;
    const html = renderToStaticMarkup(<UkhuwahMap locations={[location]} onSelect={() => undefined} />);
    expect(html).toContain("Aktifkan latar peta");
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script>');
    expect(html).toContain('aria-label="Perbesar peta"');
    expect(html).toContain("lokasi pada halaman ini");
  });
});