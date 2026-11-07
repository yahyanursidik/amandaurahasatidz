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
  it("mengirim filter kualitas, duplikat, dan lembaga bersama pagination", () => {
    const institutionId = "11111111-1111-4111-8111-111111111111";
    const current = new URLSearchParams({ quality: "incomplete", duplicate: "true", institutionId, page: "2" });
    const next = updateUstadzDirectoryQuery(current, "page", "3");
    const query = queryUstadzSchema.parse(Object.fromEntries(next));
    expect(query).toMatchObject({ quality: "incomplete", duplicate: "true", institutionId, page: 3 });
    expect(updateUstadzDirectoryQuery(next, "search", "Ahmad").has("page")).toBe(false);
  });
  it("tidak menggabungkan filter arsip dengan kualitas direktori aktif", () => {
    const next = updateUstadzDirectoryQuery(new URLSearchParams("quality=incomplete&duplicate=true&participation=attended"), "profileStatus", "ARCHIVED");
    expect(next.get("quality")).toBeNull();
    expect(next.get("duplicate")).toBeNull();
    expect(next.get("participation")).toBeNull();
    expect(next.get("profileStatus")).toBe("ARCHIVED");
  });
  it("menerima filter asatidz yang pernah hadir lintas event", () => {
    const query = queryUstadzSchema.parse(Object.fromEntries(new URLSearchParams("participation=attended&page=2")));
    expect(query.participation).toBe("attended");
    expect(query.page).toBe(2);
  });
});
