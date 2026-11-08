import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { describe, expect, it } from "vitest";
import { PublicLayout } from "../../src/components/layouts/PublicLayout";
import { getPublicProgramAction, getPublicProgramStatus, groupPublicPrograms, PublicProgramsPage, sortPublicPrograms, type Program } from "../../src/pages/public/PublicProgramsPage";

const sample: Program = {
  slug: "daurah-ilmu",
  code: "DAURAH-ILMU",
  name: "Daurah Ilmu",
  subtitle: null,
  posterUrl: null,
  posterAlt: null,
  startDate: "2026-11-20",
  endDate: "2026-11-21",
  venueName: "Bandung",
  audienceMode: "PUBLIC_OPEN",
  status: "REGISTRATION_OPEN",
  registrationOpenAt: null,
  registrationCloseAt: null,
};

describe("public homepage", () => {
  it("introduces the foundation before the program list and connects public destinations", () => {
    const html = renderToStaticMarkup(<StaticRouter location="/"><PublicProgramsPage /></StaticRouter>);
    expect(html).toContain("Yayasan Tarbiyah Sunnah");
    expect(html.indexOf('id="tentang-yts"')).toBeLessThan(html.indexOf('id="program-terbaru"'));
    expect(html).toContain('href="https://tarbiyahsunnah.com/tentang-kami/"');
    expect(html).toContain('href="/login/ustadz"');
    expect(html).toContain('href="/ruang-asatidz"');
    expect(html).toContain('href="/programs"');
    expect(html).toContain('href="#konten-utama"');
  });

  it("keeps the Daurah navigation highlighted through event and invitation pages", () => {
    for (const path of ["/events/daurah-ilmu", "/events/daurah-ilmu/register", "/invitation/institution/token"]) {
      const html = renderToStaticMarkup(<StaticRouter location={path}><PublicLayout><p>Detail</p></PublicLayout></StaticRouter>);
      expect(html).toMatch(/class="public-site__nav-link public-site__nav-link--active" href="\/programs"/);
    }
  });

  it("presents /programs as a daurah history, not a selection catalog", () => {
    const html = renderToStaticMarkup(<StaticRouter location="/programs"><PublicProgramsPage /></StaticRouter>);
    expect(html).toContain('id="catalog-title"');
    expect(html).toContain("Riwayat Daurah Asatidz");
    expect(html).toContain("Telah dilaksanakan");
    expect(html).not.toContain("Temukan daurah yang sesuai");
    expect(html).not.toContain("Pilih program");
    expect(html).toContain('href="/login/ustadz"');
    expect(html).not.toContain('id="tentang-yts"');
    expect(html).not.toContain('id="public-home-title"');
  });

  it("uses a registration route only for an open regular or mixed program", () => {
    expect(getPublicProgramAction(sample)).toEqual({ label: "Daftar reguler", to: "/events/daurah-ilmu/register" });
    expect(getPublicProgramAction({ ...sample, audienceMode: "MIXED" }).to).toBe("/events/daurah-ilmu/register");
    expect(getPublicProgramAction({ ...sample, status: "PUBLISHED" }).to).toBe("/events/daurah-ilmu");
  });

  it("never exposes a generic invitation form without its private token", () => {
    for (const audienceMode of ["INSTITUTION_INVITATION", "INDIVIDUAL_INVITATION"]) {
      expect(getPublicProgramAction({ ...sample, audienceMode }).to).toBe("/events/daurah-ilmu");
      expect(getPublicProgramStatus({ ...sample, audienceMode })).toBe("Melalui undangan");
    }
    expect(getPublicProgramAction({ ...sample, status: "ONGOING" })).toEqual({
      label: "Lihat jadwal", to: "/events/daurah-ilmu#jadwal-kegiatan",
    });
  });

  it("does not advertise regular registration outside its configured window", () => {
    const now = new Date("2026-11-08T12:00:00+07:00");
    const upcoming = { ...sample, registrationOpenAt: "2026-11-09T00:00:00+07:00" };
    const ended = { ...sample, registrationCloseAt: "2026-11-07T23:59:00+07:00" };
    expect(getPublicProgramAction(upcoming, now).to).toBe("/events/daurah-ilmu");
    expect(getPublicProgramStatus(upcoming, now)).toBe("Pendaftaran segera dibuka");
    expect(getPublicProgramAction(ended, now).to).toBe("/events/daurah-ilmu");
    expect(getPublicProgramStatus(ended, now)).toBe("Batas daftar lewat");
  });

  it("does not offer direct regular registration when the regular allocation is zero", () => {
    const invitationOnly = { ...sample, audienceMode: "MIXED", regularQuota: 0 };
    expect(getPublicProgramAction(invitationOnly).to).toBe("/events/daurah-ilmu");
    expect(getPublicProgramStatus(invitationOnly)).toBe("Kuota reguler tidak tersedia");
  });

  it("places open programs first, then upcoming programs, with completed programs newest first", () => {
    const now = new Date("2026-11-08T12:00:00+07:00");
    const ordered = sortPublicPrograms([
      { ...sample, slug: "completed-old", status: "COMPLETED", startDate: "2026-01-01" },
      { ...sample, slug: "upcoming", status: "PUBLISHED", startDate: "2026-12-01" },
      { ...sample, slug: "completed-new", status: "COMPLETED", startDate: "2026-09-01" },
      { ...sample, slug: "open", status: "REGISTRATION_OPEN" },
    ], now);
    expect(ordered.map((program) => program.slug)).toEqual(["open", "upcoming", "completed-new", "completed-old"]);
  });

  it("groups completed daurah history separately from the active agenda", () => {
    const grouped = groupPublicPrograms([
      { ...sample, slug: "agenda", status: "REGISTRATION_OPEN" },
      { ...sample, slug: "older", status: "COMPLETED", startDate: "2025-01-01", endDate: "2025-01-02" },
      { ...sample, slug: "newer", status: "COMPLETED", startDate: "2026-01-01", endDate: "2026-01-02" },
    ]);
    expect(grouped.history.map((program) => program.slug)).toEqual(["newer", "older"]);
    expect(grouped.agenda.map((program) => program.slug)).toEqual(["agenda"]);
    expect(getPublicProgramStatus(grouped.history[0])).toBe("Telah dilaksanakan");
    expect(groupPublicPrograms([...grouped.history, ...grouped.agenda], "2025").history.map((program) => program.slug)).toEqual(["older"]);
  });
});
