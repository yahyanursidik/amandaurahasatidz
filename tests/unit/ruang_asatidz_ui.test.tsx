import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { ruangApi, categoryLabels, statusLabels, publicationLabels } from "../../src/lib/ruangAsatidz";
import { RuangAsatidzPage } from "../../src/pages/portal/RuangAsatidzPage";
import { getAdminNavItems } from "../../src/components/layouts/AdminLayout";
import { RuangAsatidzAdminPage } from "../../src/pages/admin/RuangAsatidzAdminPage";

const auth = vi.hoisted(() => ({ assignments: [{ roleCode: "SUPER_ADMIN", eventId: null as string | null, institutionId: null as string | null }] }));
vi.mock("@refinedev/core", () => ({ useGetIdentity: () => ({ data: { id: "admin", name: "Admin", email: "admin@example.org", assignments: auth.assignments }, isLoading: false }) }));

vi.mock("../../src/components/common/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));

afterEach(() => { vi.unstubAllGlobals(); auth.assignments = [{ roleCode: "SUPER_ADMIN", eventId: null, institutionId: null }]; });
function renderPortal(path: string) {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><RuangAsatidzPage /></MemoryRouter>);
}
function renderAdmin(path: string) {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><RuangAsatidzAdminPage /></MemoryRouter>);
}

describe("Ruang Asatidz layar pengelola", () => {
  it.each(["/admin/ruang-asatidz", "/admin/ruang-asatidz/moderasi", "/admin/ruang-asatidz/tindak-lanjut"])("menampilkan kotak masuk terfilter di %s", (path) => {
    const html = renderAdmin(path);
    expect(html).toContain("Kotak masuk");
    expect(html).toContain("Moderasi pengalaman");
    expect(html).toContain("Tindak lanjut");
    expect(html).not.toContain("Akses pengelola diperlukan");
  });
  it("pengelola dapat membuat sapaan dengan status draf sebagai bawaan", () => {
    const html = renderAdmin("/admin/ruang-asatidz/sapaan");
    expect(html).toContain("Simpan sapaan");
    expect(html).toContain("Publikasikan sapaan di portal");
    expect(html).not.toMatch(/type="checkbox"[^>]*checked/);
  });
  it.each([
    { roleCode: "EVENT_ADMIN", eventId: "event", institutionId: null },
    { roleCode: "SYSTEM_ADMIN", eventId: "event", institutionId: null },
  ])("menolak pengelola tanpa assignment global: $roleCode", (assignment) => {
    auth.assignments = [assignment];
    const html = renderAdmin("/admin/ruang-asatidz");
    expect(html).toContain("Akses pengelola diperlukan");
    expect(html).not.toContain("Detail percakapan pribadi");
  });
});

describe("Ruang Asatidz UI dan navigasi", () => {
  it("memperlihatkan tiga pilar dan akses tanpa membuat request saat SSR", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const html = renderPortal("/portal/ruang-asatidz");
    for (const text of ["Disapa", "Didengar", "Terhubung", "Pribadi secara default", "bukan kanal darurat", "Sapaan dari YTS"]) expect(html).toContain(text);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    ["saran", "Saran Anda berarti"], ["pengalaman", "Setiap pengalaman berharga"], ["kebutuhan", "Mari sampaikan kebutuhan Anda"],
  ])("rute %s memperlihatkan formulir sesuai kategori", (path, title) => {
    const html = renderPortal(`/portal/ruang-asatidz/${path}`);
    expect(html).toContain(title);
    expect(html).toContain('maxLength="160"');
    expect(html).toContain('maxLength="5000"');
    expect(html).toContain("Kirim pesan");
  });
  it("pengalaman meminta izin nama penulis, tanpa checkbox terpilih otomatis", () => {
    const html = renderPortal("/portal/ruang-asatidz/pengalaman");
    expect(html).toContain("termasuk nama saya sebagai penulis");
    expect(html).toContain("setelah disetujui moderator YTS");
    expect(html).not.toMatch(/type="checkbox"[^>]*checked/);
  });
  it("kebutuhan tidak menjanjikan pemenuhan dan tidak menampilkan izin publikasi", () => {
    const html = renderPortal("/portal/ruang-asatidz/kebutuhan");
    expect(html).toContain("bukan jaminan bantuan atau pemenuhan");
    expect(html).not.toContain('type="checkbox"');
  });
  it("riwayat berisi filter/pagination dan pertanyaan pribadi", () => {
    const html = renderPortal("/portal/ruang-asatidz/pesan");
    expect(html).toContain("Semua kategori");
    expect(html).toContain("Semua status");
    expect(html).toContain("Sebelumnya");
    expect(html).toContain("Berikutnya");
    expect(html).toContain("Mulai percakapan");
  });
  it("papan hanya menjelaskan pengalaman berizin dan tidak memperlihatkan data kontak", () => {
    const html = renderPortal("/portal/ruang-asatidz/terhubung");
    expect(html).toContain("Terhubung lewat pengalaman");
    expect(html).toContain("Percakapan pribadi dan balasannya tidak tampil");
    expect(html).not.toContain("mailto:");
    expect(html).not.toContain("wa.me/");
  });
  it("rute tidak dikenal menampilkan halaman tidak ditemukan tanpa fallback formulir", () => {
    const html = renderPortal("/portal/ruang-asatidz/not-real");
    expect(html).toContain("Halaman tidak ditemukan");
    expect(html).not.toContain("Kirim pesan");
  });
  it("admin submenu tidak terikat id event", () => {
    const nav = getAdminNavItems("/admin/ruang-asatidz/moderasi");
    const ruang = nav.find((item) => item.href === "/admin/ruang-asatidz");
    expect(ruang?.children?.map((item) => item.href)).toEqual([
      "/admin/ruang-asatidz", "/admin/ruang-asatidz/tindak-lanjut", "/admin/ruang-asatidz/moderasi", "/admin/ruang-asatidz/sapaan",
    ]);
    const app = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
    expect(app).toContain('path="/portal/ruang-asatidz/*"');
    expect(app).toContain('path="/admin/ruang-asatidz/*"');
  });
  it("label UI mencakup seluruh state terpisah", () => {
    expect(Object.keys(categoryLabels)).toHaveLength(4);
    expect(Object.keys(statusLabels)).toHaveLength(5);
    expect(Object.keys(publicationLabels)).toHaveLength(4);
    expect(statusLabels.NEW).not.toBe(statusLabels.READ);
  });
});

describe("ruangApi mengikuti pola sesi aplikasi", () => {
  it("mengembalikan pagination utuh dan menambahkan token/cookies", async () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => "session-token" } });
    const payload = { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: payload }), { headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    expect(await ruangApi("/ruang-asatidz/threads")).toEqual(payload);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/ruang-asatidz/threads"), expect.objectContaining({ credentials: "include", headers: expect.objectContaining({ authorization: "session-token" }) }));
  });
  it("storage yang dinonaktifkan tetap memungkinkan autentikasi cookie", async () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => { throw new Error("Storage blocked"); } } });
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), { headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    expect(await ruangApi("/ruang-asatidz/greetings")).toEqual([]);
    expect(fetch).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ credentials: "include" }));
  });
  it("menjaga header/AbortSignal dan memperlihatkan error API tanpa sukses palsu", async () => {
    const controller = new AbortController();
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "Percakapan sudah ditutup." } }), { status: 409, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    await expect(ruangApi("/ruang-asatidz/threads/id/replies", { method: "POST", headers: { Authorization: "explicit-token" }, signal: controller.signal, body: JSON.stringify({ body: "Terima kasih" }) })).rejects.toThrow("Percakapan sudah ditutup.");
    expect(fetch).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ signal: controller.signal, headers: expect.objectContaining({ authorization: "explicit-token" }) }));
  });
});