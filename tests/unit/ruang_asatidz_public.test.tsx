import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { RuangAsatidzPublicPage } from "../../src/pages/public/RuangAsatidzPublicPage";
import { PublicProgramsPage } from "../../src/pages/public/PublicProgramsPage";
import { PublicLayout } from "../../src/components/layouts/PublicLayout";
import { ruangAsatidzLoginReturnPath } from "../../src/lib/ruangAsatidzLogin";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const render = (children: React.ReactNode, path = "/ruang-asatidz") => renderToStaticMarkup(
  <StaticRouter location={path}>{children}</StaticRouter>,
);

describe("public Ruang Asatidz", () => {
  it("renders a dedicated anonymous introduction without private API/storage access or SSR warnings", () => {
    const fetch = vi.fn(() => { throw new Error("Unexpected private request"); });
    const storage = vi.fn(() => { throw new Error("Unexpected token access"); });
    const error = vi.spyOn(console, "error");
    const warn = vi.spyOn(console, "warn");
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("window", { localStorage: { getItem: storage } });
    const html = render(<RuangAsatidzPublicPage />);
    expect(html).toContain("<h1");
    for (const text of ["Ruang Asatidz", "Disapa. Didengar. Terhubung.", "Pribadi secara default", "terbuka untuk umum", "bukan kanal darurat"]) expect(html).toContain(text);
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("<form");
    expect(fetch).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("links each action to its account-only portal route", () => {
    const html = render(<RuangAsatidzPublicPage />);
    for (const path of ["", "/saran", "/pengalaman", "/kebutuhan", "/pesan", "/terhubung"]) {
      expect(html).toContain(`href="/portal/ruang-asatidz${path}"`);
    }
    expect(html).toContain("Jika belum masuk");
    expect(html).toContain("aktivasi akun");
    expect(html).toContain("Tidak ditampilkan di halaman publik ini");
  });

  it("exposes the public page in navigation and marks the current section", () => {
    const html = render(<PublicLayout><p>Content</p></PublicLayout>);
    expect(html).toContain('aria-label="Navigasi publik"');
    expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/ruang-asatidz"/);
    expect(html).toContain('href="/programs"');
    expect(html).toContain('href="/login/ustadz"');
  });

  it("keeps the public page discoverable publicly without linking out of the asatidz portal", () => {
    expect(render(<PublicProgramsPage />, "/programs")).toContain("Kenali Ruang Asatidz");
    const portalLayout = readFileSync(new URL("../../src/components/layouts/PortalLayout.tsx", import.meta.url), "utf8");
    expect(portalLayout).not.toContain('href: "/ruang-asatidz"');
    expect(portalLayout).toContain('href: "/portal/ruang-asatidz"');
    const portalPage = readFileSync(new URL("../../src/pages/portal/RuangAsatidzPage.tsx", import.meta.url), "utf8");
    expect(portalPage).not.toContain('to="/ruang-asatidz"');
  });
});

describe("safe Ruang return destination after login", () => {
  it.each(["", "/saran", "/pengalaman", "/kebutuhan", "/pesan", "/terhubung", "/pesan/22222222-2222-4222-8222-222222222222"])("returns the requested route %s", (suffix) => {
    const path = `/portal/ruang-asatidz${suffix}`;
    expect(ruangAsatidzLoginReturnPath("ustadz", path)).toBe(path);
    expect(ruangAsatidzLoginReturnPath("ustadz", `${path}/`)).toBe(path);
  });
  it.each([undefined, null, {}, "https://evil.invalid", "//evil.invalid", "/admin", "/portal/ruang-asatidz-evil", "/portal/ruang-asatidz/../admin", "/portal/ruang-asatidz/saran?redirect=https://evil.invalid", "/portal/ruang-asatidz/pesan/not-a-uuid"])("rejects arbitrary or malformed destinations %#", (from) => {
    expect(ruangAsatidzLoginReturnPath("ustadz", from)).toBeNull();
  });
  it.each(["admin", "committee"])("does not override another portal login: %s", (portal) => {
    expect(ruangAsatidzLoginReturnPath(portal, "/portal/ruang-asatidz")).toBeNull();
  });
});