import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { InvitationRegistrationPage } from "../../src/pages/public/InvitationRegistrationPage";

afterEach(() => vi.unstubAllGlobals());

describe("bukti konfirmasi undangan", () => {
  it("menyatukan kartu rombongan, rundown, WhatsApp panitia, dan akun pribadi", () => {
    const proof = {
      event: {
        invitation: { invitationNumber: "UND-1", quota: 2, status: "ACCEPTED" },
        event: { name: "Daurah Ilmu", slug: "daurah-ilmu", startDate: "2027-01-01", endDate: "2027-01-02",
          publicContactWhatsapp: "6281234567890" },
        institution: { name: "Ma'had Aman", code: "MA-1" },
      },
      result: {
        message: "Konfirmasi tersimpan", emailQueued: 2,
        participants: [
          { id: "person-a", participantCode: "P-AAA", registrationStatusUrl: "/confirm#pcf_one.signature" },
          { id: "person-b", participantCode: "P-BBB", registrationStatusUrl: "/confirm#pcf_two.signature" },
        ],
        portalAccounts: [
          { participantId: "person-a", participantName: "Ustadz Ahmad", email: "ahmad@example.id",
            temporaryPassword: "BukuTamanPagiSabar123456", passwordSetupRequired: false, loginUrl: "/login/ustadz" },
          { participantId: "person-b", participantName: "Ustadz Hasan", email: "hasan@example.id",
            temporaryPassword: null, passwordSetupRequired: true, loginUrl: "/login/ustadz" },
        ],
      },
    };
    vi.stubGlobal("window", { location: { origin: "https://contoh.id" }, sessionStorage: {
      getItem: (key: string) => key === "registration:invitation:institution:token" ? JSON.stringify(proof) : null,
    } });
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={["/invitation/institution/token"]}>
      <Routes><Route path="/invitation/institution/:token" element={<InvitationRegistrationPage />} /></Routes>
    </MemoryRouter>);
    expect(html).toContain("Pilih peserta");
    expect(html).not.toMatch(/aria-label="QR presensi|pqr_/);
    expect(html).toContain("https://contoh.id/confirm#pcf_one.signature");
    expect(html).toContain("Simpan bukti pendaftaran");
    expect(html).toContain("BukuTamanPagiSabar123456");
    expect(html).toContain("Ustadz Hasan · P-BBB");
    expect(html).toContain("/events/daurah-ilmu#jadwal-kegiatan");
    expect(html).toContain("https://wa.me/6281234567890?text=");
    expect(html).toContain("/login/ustadz");
    expect(html.indexOf('id="akses-portal"')).toBeLessThan(html.indexOf('id="bukti-pendaftaran"'));
    expect(html).not.toContain("pqr_two.signature");
  });
});
