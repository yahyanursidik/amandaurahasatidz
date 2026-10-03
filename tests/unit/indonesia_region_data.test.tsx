import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { INDONESIA_REGENCIES, findIndonesianRegency } from "../../src/lib/indonesiaRegionData";
import { loadIndonesianRegencies, suggestRegencies } from "../../src/lib/indonesiaRegions";
import { RegionFields } from "../../src/components/public/RegionFields";

describe("bundled Indonesian regions", () => {
  it("contains 514 unique BPS regencies across 38 provinces", () => {
    expect(INDONESIA_REGENCIES).toHaveLength(514);
    expect(new Set(INDONESIA_REGENCIES.map((r) => r.id)).size).toBe(514);
    expect(new Set(INDONESIA_REGENCIES.map((r) => r.provinceId)).size).toBe(38);
    expect(INDONESIA_REGENCIES.every((r) => r.id.startsWith(r.provinceId))).toBe(true);
    expect(findIndonesianRegency("3273")).toMatchObject({ city: "KOTA BANDUNG", province: "JAWA BARAT", provinceId: "32" });
    expect(findIndonesianRegency("9999")).toBeUndefined();
  });
  it("loads without any network request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    try {
      expect(await loadIndonesianRegencies()).toBe(INDONESIA_REGENCIES);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally { fetchMock.mockRestore(); }
  });
  it.each(["bandung barat", "barat bandung", "kab. bandung barat", "jawa bandung barat"])("matches multiple words %s", (query) => {
    expect(suggestRegencies(INDONESIA_REGENCIES, query).some((r) => r.id === "3217")).toBe(true);
  });
  it("distinguishes kota and kabupaten and handles punctuation", () => {
    expect(suggestRegencies(INDONESIA_REGENCIES, "kota bandung").map((r) => r.id)).toEqual(["3273"]);
    expect(suggestRegencies(INDONESIA_REGENCIES, "b")).toEqual([]);
    expect(suggestRegencies(INDONESIA_REGENCIES, "   ")).toEqual([]);
    expect(suggestRegencies(INDONESIA_REGENCIES, "kota", 3)).toHaveLength(3);
  });
  it("renders optional disabled profile fields with a read-only automatic province", () => {
    const html = renderToStaticMarkup(<RegionFields prefix="test" value={{ city: "KOTA BANDUNG", province: "JAWA BARAT", cityCode: "3273", provinceCode: "32" }} onChange={() => {}} disabled required={false} readOnlyProvince requireSelection />);
    expect(html).toContain('role="combobox"');
    expect(html).toContain('readonly=""');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('required=""');
    expect(html).not.toContain("Provinsi *");
  });
});