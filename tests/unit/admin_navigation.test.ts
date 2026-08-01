import { describe, expect, it } from "vitest";
import { getAdminNavItems } from "../../src/components/layouts/AdminLayout";
import { flattenSidebarNavItems, isNavigationItemActive } from "../../src/components/common/Sidebar";

describe("admin navigation information architecture", () => {
  it("adds event-scoped submenus when an event workspace is active", () => {
    const items = getAdminNavItems("/admin/events/7b62644d-91ee-43cf-b7c3-0514657fc01c/attendance");
    const eventMenu = items.find((item) => item.href === "/admin/events");

    expect(eventMenu?.children?.map((item) => item.label)).toEqual(expect.arrayContaining([
      "Ikhtisar event",
      "Pendaftaran",
      "Jadwal & sesi",
      "Tim pelaksana",
      "Absensi harian",
      "Komunikasi",
      "Laporan event",
      "Ubah event",
    ]));
    expect(eventMenu?.children?.find((item) => item.label === "Absensi harian")?.href)
      .toBe("/admin/events/7b62644d-91ee-43cf-b7c3-0514657fc01c/attendance");
  });

  it("keeps event-only tools out of the create-event route", () => {
    const items = getAdminNavItems("/admin/events/create");
    const eventMenu = items.find((item) => item.href === "/admin/events");

    expect(eventMenu?.children?.map((item) => item.label)).toEqual(["Semua event", "Buat event"]);
  });

  it("marks a parent menu active when one of its submenus is active", () => {
    const items = getAdminNavItems("/admin/ustadz/merge");
    const ustadzMenu = items.find((item) => item.href === "/admin/ustadz");

    expect(ustadzMenu).toBeDefined();
    expect(isNavigationItemActive("/admin/ustadz/merge", ustadzMenu!)).toBe(true);
  });

  it("flattens nested navigation into unique command-menu destinations", () => {
    const commandItems = flattenSidebarNavItems(getAdminNavItems("/admin"));
    const hrefs = commandItems.map((item) => item.href);

    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(commandItems.some((item) => item.label === "Gabungkan duplikat")).toBe(true);
    expect(commandItems.some((item) => item.keywords.includes("keamanan"))).toBe(true);
  });
});
