import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { describe, expect, it } from "vitest";
import { PublicEventRegistrationPage } from "../../src/pages/public/PublicEventRegistrationPage";

const event = {
  name: "Daurah Asatidz Bandung", slug: "daurah-coba", startDate: "2027-02-10", endDate: "2027-02-12",
  venueName: "Bandung", publicContactWhatsapp: "6281234567890", status: "REGISTRATION_OPEN",
  audienceMode: "MIXED", regularQuota: 20, regularApproved: 0, capacity: 30, invitationApproved: 0,
  registrationOpenAt: null, registrationCloseAt: null,
};

describe("formulir reguler publik", () => {
  it("menempatkan peserta pertama dan rombongan dengan tindakan yang jelas", () => {
    const html = renderToStaticMarkup(<StaticRouter location="/events/daurah-coba"><PublicEventRegistrationPage embeddedEvent={event} /></StaticRouter>);
    expect(html).toContain("Daftar sebagai peserta");
    expect(html).toContain("Data peserta pertama");
    expect(html).toContain("Nama yang mengisi formulir juga ikut terdaftar");
    expect(html).toContain("Tambah anggota");
    expect(html).toContain("Daftarkan 1 peserta");
    expect(html).toContain("Email menjadi nama pengguna untuk masuk portal");
    expect(html).toContain("Saya setuju data saya digunakan panitia");
    expect(html).toContain("Butuh bantuan? WhatsApp panitia");
    expect(html).not.toContain("Anggota 2");
  });

  it("tidak menawarkan kirim saat jalur reguler ditutup", () => {
    const html = renderToStaticMarkup(<StaticRouter location="/events/daurah-coba"><PublicEventRegistrationPage embeddedEvent={{ ...event, status: "REGISTRATION_CLOSED" }} /></StaticRouter>);
    expect(html).toContain("Formulir reguler belum dapat diisi");
    expect(html).not.toContain("Daftarkan 1 peserta");
  });
});
