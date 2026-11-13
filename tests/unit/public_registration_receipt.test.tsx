import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { PublicRegistrationReceipt } from "../../src/components/public/PublicRegistrationReceipt";
import { buildRegistrationAttendanceMessage, publicRundownPath, registrationAttendanceWhatsAppUrl, type ReceiptParticipant } from "../../src/lib/publicRegistrationReceipt";

const participants: (ReceiptParticipant & { qrToken: string; cardUrl: string })[] = [
  { fullName: "Ustadz Ahmad", email: "ahmad@example.test", participantCode: "PAR-001", qrToken: "pqr_first.secret", cardUrl: "/card?token=pqr_first.secret", registrationStatusUrl: "/confirm#pcf_first.signature", passwordSetupRequired: true },
  { fullName: "Ustadz Hasan", email: "hasan@example.test", participantCode: "PAR-002", qrToken: "pqr_second.secret", cardUrl: "/card?token=pqr_second.secret", registrationStatusUrl: "/confirm#pcf_second.signature", passwordSetupRequired: false },
];

afterEach(() => vi.unstubAllGlobals());

describe("bukti pendaftaran publik", () => {
  it("mengarahkan rundown ke jadwal kegiatan dan membuat draf WhatsApp tanpa token QR", () => {
    expect(publicRundownPath("daurah asatidz")).toBe("/events/daurah%20asatidz#jadwal-kegiatan");
    const message = buildRegistrationAttendanceMessage("Daurah Asatidz", participants);
    expect(message).toContain("Assalamu’alaikum");
    expect(message).toContain("Ustadz Ahmad — PAR-001");
    expect(message).toContain("Ustadz Hasan — PAR-002");
    expect(message).toContain("menanyakan informasi pendaftaran");
    expect(message).not.toContain("berencana hadir");
    expect(message).not.toContain("pqr_");
    expect(registrationAttendanceWhatsAppUrl("Daurah Asatidz", participants)).toBe(`https://wa.me/?text=${encodeURIComponent(message)}`);
    expect(registrationAttendanceWhatsAppUrl("Daurah Asatidz", participants, "081234567890"))
      .toBe(`https://wa.me/6281234567890?text=${encodeURIComponent(message)}`);
    expect(buildRegistrationAttendanceMessage("Daurah Asatidz", participants.slice(0, 1))).not.toContain("PAR-002");
  });

  it("menampilkan bukti tanpa QR, pemilih peserta, dan akses aktivasi email pribadi", () => {
    vi.stubGlobal("window", { location: { origin: "https://contoh.test" } });
    const html = renderToStaticMarkup(<MemoryRouter><PublicRegistrationReceipt event={{ name: "Daurah Asatidz", slug: "daurah-asatidz" }} participants={participants} emailQueued={2} /></MemoryRouter>);
    expect(html).toContain("Pilih peserta");
    expect(html).toContain("Menunggu persetujuan panitia");
    expect(html).toContain("QR presensi belum diterbitkan");
    expect(html).toContain("Ustadz Hasan · PAR-002");
    expect(html).not.toMatch(/aria-label="QR presensi|pqr_/);
    expect(html).toContain("Simpan bukti pendaftaran");
    expect(html).toContain("ahmad@example.test");
    expect(html).toContain("/login/ustadz#ustadz-activation-panel");
    expect(html).toContain("Rundown");
    expect(html).toContain('href="/events/daurah-asatidz#jadwal-kegiatan"');
    expect(html.indexOf('aria-label="Tautan bukti pendaftaran"')).toBeLessThan(html.indexOf('id="bukti-pendaftaran"'));
    expect(html.indexOf('id="akses-portal"')).toBeLessThan(html.indexOf('id="bukti-pendaftaran"'));
    expect(html).toContain("Buka draf WhatsApp");
    expect(html).toContain("Nomor panitia belum tersedia");
    expect(html).not.toContain("pqr_second.secret");
  });

  it("menampilkan sandi baru satu kali, tetapi sandi akun yang telah ada tidak dibuka", () => {
    vi.stubGlobal("window", { location: { origin: "https://contoh.test" } });
    const fresh = { ...participants[0], passwordSetupRequired: false,
      temporaryPassword: "BukuTamanPagiSabar123456", temporaryPasswordIssued: true };
    const html = renderToStaticMarkup(<MemoryRouter><PublicRegistrationReceipt event={{ name: "Daurah Asatidz", slug: "daurah-asatidz" }} participants={[fresh, participants[1]]} emailQueued={2} /></MemoryRouter>);
    expect(html).toContain("BukuTamanPagiSabar123456");
    expect(html).toContain("Salin sandi");
    expect(html).toContain("Masuk ke portal");
    expect(html).not.toContain("/login/ustadz#ustadz-activation-panel");
    const restored = renderToStaticMarkup(<MemoryRouter><PublicRegistrationReceipt event={{ name: "Daurah Asatidz", slug: "daurah-asatidz" }} participants={[{ ...fresh, temporaryPassword: undefined }]} emailQueued={1} /></MemoryRouter>);
    expect(restored).not.toContain("BukuTamanPagiSabar123456");
    expect(restored).toContain("Password awal tidak tersimpan");
    expect(restored).toContain("/login/ustadz#ustadz-activation-panel");
  });

  it("menghubungkan draf konfirmasi langsung ke nomor panitia event bila tersedia", () => {
    vi.stubGlobal("window", { location: { origin: "https://contoh.test" } });
    const html = renderToStaticMarkup(<MemoryRouter><PublicRegistrationReceipt event={{ name: "Daurah Asatidz", slug: "daurah-asatidz", publicContactWhatsapp: "6281234567890" }} participants={[participants[0]]} emailQueued={1} /></MemoryRouter>);
    expect(html).toContain("https://wa.me/6281234567890?text=");
    expect(html).toContain("Tanya panitia via WhatsApp");
    expect(html).toContain("Pesan ini tidak mengubah status pendaftaran");
  });

  it("menyediakan tautan keputusan pribadi, terpisah dari QR yang dapat dibagikan", () => {
    vi.stubGlobal("window", { location: { origin: "https://contoh.test" } });
    const withConfirmation = { ...participants[0], registrationStatusUrl: null, confirmationUrl: "/confirm#pcf_private.signature" };
    const html = renderToStaticMarkup(<MemoryRouter><PublicRegistrationReceipt event={{ name: "Daurah Asatidz", slug: "daurah-asatidz" }} participants={[withConfirmation]} emailQueued={1} /></MemoryRouter>);
    expect(html).toContain('href="https://contoh.test/confirm#pcf_private.signature"');
    expect(html).toContain("tanpa login");
    expect(html).not.toContain("pqr_");
  });

  it("membagikan tautan konfirmasi rombongan hanya ke nomor peserta yang dipilih", () => {
    vi.stubGlobal("window", { location: { origin: "https://contoh.test" } });
    const first = { ...participants[0], whatsapp: "081234567890", confirmationUrl: "/confirm#pcf_first.signature" };
    const second = { ...participants[1], whatsapp: "081234567891", confirmationUrl: "/confirm#pcf_second.signature" };
    const html = renderToStaticMarkup(<MemoryRouter><PublicRegistrationReceipt event={{ name: "Daurah Asatidz", slug: "daurah-asatidz" }} participants={[first, second]} emailQueued={2} /></MemoryRouter>);
    expect(html).toContain("Salin tautan");
    expect(html).toContain("Kirim ke WhatsApp peserta");
    expect(html).toContain("https://wa.me/6281234567890?text=");
    expect(html).toContain(encodeURIComponent("https://contoh.test/confirm#pcf_first.signature"));
    expect(html).not.toContain(encodeURIComponent("https://contoh.test/card?token=pqr_first.secret"));
    expect(html).not.toContain(encodeURIComponent("https://contoh.test/confirm#pcf_second.signature"));
    expect(html).not.toContain(encodeURIComponent("https://contoh.test/card?token=pqr_second.secret"));
  });
});
