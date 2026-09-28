import { describe, expect, it } from "vitest";
import { updateUstadzDirectoryQuery } from "../../src/lib/ustadzDirectoryQuery";
import { queryUstadzSchema } from "../../netlify/functions/lib/validations/ustadzValidation";

describe("navigasi direktori asatidz", () => {
  it("mempertahankan pencarian/status ketika lanjut halaman dan tidak menghapus nomor halaman", () => {
    const current = new URLSearchParams("search=ahmad&profileStatus=ACTIVE&page=2");
    const next = updateUstadzDirectoryQuery(current, "page", "3");
    expect(next.get("page")).toBe("3");
    expect(next.get("search")).toBe("ahmad");
    expect(next.get("profileStatus")).toBe("ACTIVE");
    expect(queryUstadzSchema.parse(Object.fromEntries(next)).page).toBe(3);
  });
  it("memulai dari halaman pertama saat kata pencarian berubah", () => {
    const next = updateUstadzDirectoryQuery(new URLSearchParams("page=4&search=lama"), "search", "baru");
    expect(next.get("page")).toBeNull();
    expect(next.get("search")).toBe("baru");
  });
});
