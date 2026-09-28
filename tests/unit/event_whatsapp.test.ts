import { describe, expect, it } from "vitest";
import { buildEventWhatsAppMessage, buildEventWhatsAppUrl } from "../../src/lib/eventWhatsApp";
import { eventCatalogQuerySchema } from "../../netlify/functions/lib/validations/eventValidation";

const event = { name: "Daurah Fikih", slug: "daurah-fikih", startDate: "2026-11-12", endDate: "2026-11-13", venueName: "Masjid Kota", status: "REGISTRATION_OPEN", audienceMode: "MIXED" };

describe("berbagi event WhatsApp", () => {
  it("menghasilkan pesan undangan umum tanpa bocoran tautan atau kode pribadi", () => {
    const text = buildEventWhatsAppMessage("INVITATION", event, "https://example.org");
    expect(text).toContain("https://example.org/events/daurah-fikih");
    expect(text).toContain("tautan pribadi");
    expect(text).not.toContain("/invitation/");
  });

  it("membagikan jalur reguler hanya ketika status dan audience mengizinkan", () => {
    expect(buildEventWhatsAppMessage("REGULAR", event, "https://example.org"))
      .toContain("https://example.org/events/daurah-fikih/register");
    expect(buildEventWhatsAppMessage("REGULAR", { ...event, status: "PUBLISHED" }, "https://example.org"))
      .not.toContain("/register");
  });

  it("memvalidasi nomor tujuan sebelum membuat wa.me", () => {
    expect(buildEventWhatsAppUrl("Assalamu'alaikum", "081234567890"))
      .toBe("https://wa.me/6281234567890?text=Assalamu'alaikum");
    expect(buildEventWhatsAppUrl("Pesan", "invalid")).toBeNull();
    expect(buildEventWhatsAppUrl("Pesan")).toBe("https://wa.me/?text=Pesan");
  });

  it("membatasi ukuran halaman katalog yang diminta klien", () => {
    expect(eventCatalogQuerySchema.parse({ page: "2", pageSize: "12" }).pageSize).toBe(12);
    expect(eventCatalogQuerySchema.safeParse({ pageSize: "500" }).success).toBe(false);
  });
});
