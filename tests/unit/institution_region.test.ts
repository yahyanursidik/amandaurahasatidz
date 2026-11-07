import { describe, expect, it } from "vitest";
import { institutionCities, institutionProvinces, institutionRegionLabel } from "../../src/lib/institutionRegion";

describe("institution region labels", () => {
  it("offers named provinces and their cities", () => {
    expect(institutionProvinces.some((item) => item.code === "32")).toBe(true);
    expect(institutionCities("32").some((item) => item.id === "3273")).toBe(true);
  });

  it("keeps unknown legacy codes visible", () => {
    expect(institutionRegionLabel("9999", "99")).toEqual({ city: "9999", province: "99" });
  });
});
