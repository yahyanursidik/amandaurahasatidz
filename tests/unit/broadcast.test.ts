import { describe, expect, it } from "vitest";
import { broadcastDates, broadcastHtml, planBroadcastSlots, renderBroadcast, validateBroadcastContent } from "../../netlify/functions/lib/services/broadcastService";
import { nextBroadcastDay } from "../../netlify/functions/lib/services/emailQueueService";

describe("BC sapaan asatidz", () => {
  it("mengganti variabel personal tanpa menafsirkan input sebagai template", () => {
    expect(renderBroadcast("Salam {{nama}} ({{email}})", { nama: "Ustadz {{email}}", email: "a@example.com" }))
      .toBe("Salam Ustadz {{email}} (a@example.com)");
    expect(() => validateBroadcastContent("Salam {{password}}", "Pesan cukup panjang")).toThrow();
    expect(() => validateBroadcastContent("Salam {{nama", "Pesan cukup panjang")).toThrow();
  });

  it("menjadwalkan akhir bulan secara stabil dan satu kali kirim", () => {
    const start = new Date("2026-01-31T09:00:00.000Z");
    expect(broadcastDates(start, "MONTHLY", 3).map((date) => date.toISOString())).toEqual([
      "2026-01-31T09:00:00.000Z", "2026-02-28T09:00:00.000Z", "2026-03-31T09:00:00.000Z",
    ]);
    expect(broadcastDates(start, "ONCE", 12)).toHaveLength(1);
  });

  it("membagi penerima sesuai batas per hari WIB, termasuk saat pengulangan saling bertumpuk", () => {
    const starts = [new Date("2026-01-01T16:00:00Z"), new Date("2026-01-02T16:00:00Z")];
    const slots = planBroadcastSlots(starts, 3, 2);
    expect(slots.map((group) => group.map((date) => date.toISOString()))).toEqual([
      ["2026-01-01T16:00:00.000Z", "2026-01-01T16:00:00.000Z", "2026-01-02T16:00:00.000Z"],
      ["2026-01-02T16:00:00.000Z", "2026-01-03T16:00:00.000Z", "2026-01-03T16:00:00.000Z"],
    ]);
    expect(() => planBroadcastSlots(starts, 1, 0)).toThrow();
  });

  it("menghindari HTML aktif di email kampanye dan email uji", () => {
    expect(broadcastHtml("<script>alert('x')</script>"))
      .toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
  });

  it("menunda ke pukul 08.00 WIB pada hari berikutnya ketika batas harian tercapai", () => {
    expect(nextBroadcastDay(new Date("2026-01-01T10:00:00Z")).toISOString()).toBe("2026-01-02T01:00:00.000Z");
  });
});
