import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const identity = vi.hoisted(() => ({ assignments: [{ roleCode: "USTADZ" }] }));
vi.mock("@refinedev/core", () => ({ useGetIdentity: () => ({ data: identity, isLoading: false }) }));
vi.mock("../../src/components/layouts/AdminLayout", () => ({ AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../../src/components/layouts/PortalLayout", () => ({ PortalLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
import { UkhuwahPage, canAccessUkhuwah } from "../../src/pages/shared/UkhuwahPage";
import { canSubmitRevision, reportSubmissionError } from "../../src/components/ukhuwah/ReportEditor";
import { contactSharingValid } from "../../src/components/ukhuwah/LocationEditor";
import { emptyUkhuwahLocation, emptyUkhuwahReport, type UkhuwahReport } from "../../src/lib/ukhuwah";
function render(path: string, admin = false) { return renderToStaticMarkup(<StaticRouter location={path}><UkhuwahPage admin={admin} /></StaticRouter>); }
beforeEach(() => { identity.assignments = [{ roleCode: "USTADZ" }]; });
describe("ukhuwah UI routes", () => {
  it("renders portal navigation and explicit privacy boundaries", () => {
    const html = render("/portal/peta-ukhuwah");
    for (const text of ["Peta Ukhuwah", "Laporan saya", "Laporan bersama hanya muncul setelah moderasi", "Memuat"]) expect(html).toContain(text);
    expect(html).not.toContain("Tambah lokasi lembaga"); expect(html).not.toContain("/admin/peta-ukhuwah");
  });
  it("renders eight templates and preview confirmation in new report", () => {
    const html = render("/portal/peta-ukhuwah/laporan/baru");
    for (const text of ["Pemetaan awal", "Permintaan pengajar", "Informasi khusus", "Simpan draf", "Pratinjau revisi tersimpan", "Cakupan akses"]) expect(html).toContain(text);
    expect(html).not.toContain('<img');
  });
  it("only global admin renders moderation menu/location editing", () => {
    expect(render("/admin/peta-ukhuwah", true)).toContain("Akses Peta Ukhuwah tidak tersedia");
    identity.assignments = [{ roleCode: "SYSTEM_ADMIN" }];
    const html = render("/admin/peta-ukhuwah", true);
    expect(html).toContain("Tambah lokasi lembaga"); expect(html).toContain("Moderasi"); expect(html).toContain("Tindak lanjut");
  });
  it("denies expired and scoped management and unrelated participant roles", () => {
    expect(canAccessUkhuwah([{ roleCode: "SUPER_ADMIN", eventId: "event" }], true)).toBe(false);
    expect(canAccessUkhuwah([{ roleCode: "SYSTEM_ADMIN", startsAt: "2099-01-01" }], true)).toBe(false);
    expect(canAccessUkhuwah([{ roleCode: "USTADZ", endsAt: "2000-01-01" }], false)).toBe(false);
    expect(canAccessUkhuwah([{ roleCode: "EVENT_VIEWER" }], false)).toBe(false);
  });
  it("does not silently render unknown paths", () => expect(render("/portal/peta-ukhuwah/unknown")).toContain("Halaman tidak tersedia"));
});
describe("ukhuwah editor safeguards", () => {
  it("requires saved clean reviewed version for submit", () => {
    const report = { ...emptyUkhuwahReport(), version: 2, publicationStatus: "DRAFT" } as UkhuwahReport;
    expect(canSubmitRevision(report, false, 2)).toBe(true);
    expect(canSubmitRevision(null, false, 2)).toBe(false);
    expect(canSubmitRevision(report, true, 2)).toBe(false);
    expect(canSubmitRevision(report, false, 1)).toBe(false);
    expect(canSubmitRevision({ ...report, publicationStatus: "PENDING" }, false, 2)).toBe(false);
  });
  it("requires completed content and contact consent", () => {
    expect(reportSubmissionError(emptyUkhuwahReport())).toContain("Lengkapi");
    expect(reportSubmissionError({ ...emptyUkhuwahReport(), title: "Uji laporan", body: "[ISI: rincian]", source: "Pengamatan" })).toContain("placeholder");
    expect(contactSharingValid(emptyUkhuwahLocation())).toBe(true);
    expect(contactSharingValid({ ...emptyUkhuwahLocation(), picContactShared: true })).toBe(false);
    expect(contactSharingValid({ ...emptyUkhuwahLocation(), officialContactShared: true, contactConsentConfirmed: true, contactConsentSource: "Pemilik menyetujui" })).toBe(true);
  });
});