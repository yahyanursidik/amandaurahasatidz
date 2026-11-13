import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ADMIN_GUIDE_STAGES, AdminGuidePage, resolveGuideAction } from "../../src/pages/admin/AdminGuidePage";

vi.mock("@refinedev/core", () => ({
  useGetIdentity: () => ({ data: { assignments: [{ roleCode: "SUPER_ADMIN" }] }, isLoading: false }),
}));
vi.mock("../../src/components/common/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));

const EVENT_ID = "7b62644d-91ee-43cf-b7c3-0514657fc01c";

describe("panduan kerja admin", () => {
  it("covers the event workflow from configuration to daily check-in and reporting", () => {
    expect(ADMIN_GUIDE_STAGES.map((stage) => stage.id)).toEqual([
      "draft", "schedule", "publish", "registration", "communication", "attendance", "reports",
    ]);
    const content = ADMIN_GUIDE_STAGES.flatMap((stage) => [stage.title, ...stage.steps]).join(" ");
    expect(content).toMatch(/kuota/i);
    expect(content).toMatch(/lembaga/i);
    expect(content).toMatch(/QR pribadi/i);
    expect(content).toMatch(/hari jeda/i);
    expect(content).toMatch(/ekspor/i);
  });

  it("uses the event list as a safe fallback and deep-links only with a valid event ID", () => {
    const kiosk = ADMIN_GUIDE_STAGES.find((stage) => stage.id === "attendance")!.actions.find((action) => action.to === "/kiosk")!;
    expect(resolveGuideAction(kiosk, null)).toBe("/admin/events");
    expect(resolveGuideAction(kiosk, "not-an-event")).toBe("/admin/events");
    expect(resolveGuideAction(kiosk, EVENT_ID)).toBe(`/admin/events/${EVENT_ID}/kiosk`);
  });

  it("renders one navigable page with contextual links and supporting modules", () => {
    const html = renderToStaticMarkup(<StaticRouter location={`/admin/panduan?eventId=${EVENT_ID}`}><AdminGuidePage /></StaticRouter>);
    expect(html).toContain("Panduan kerja admin");
    expect(html).toContain('href="#attendance"');
    expect(html).toContain(`href="/admin/events/${EVENT_ID}/kiosk"`);
    expect(html).toContain("Data pendukung");
    expect(html).toContain('href="/admin/institutions"');
    expect(html).toContain('href="/admin/email-jobs"');
  });

  it("directs administrators without event context to the event list first", () => {
    const html = renderToStaticMarkup(<StaticRouter location="/admin/panduan"><AdminGuidePage /></StaticRouter>);
    expect(html).toContain("Belum memilih event");
    expect(html).toContain('href="/admin/events"');
    expect(html).toContain("Pilih event · Perangkat kiosk");
    expect(html).not.toContain('href="/admin/events/undefined');
  });
});
