import { describe, expect, it } from "vitest";
import { portalLoginReturnPath } from "../../src/lib/portalLoginReturn";

describe("portal login return path", () => {
  it("returns to the requested portal page after login", () => {
    expect(portalLoginReturnPath("admin", "/admin/events/abc/registrations")).toBe("/admin/events/abc/registrations");
    expect(portalLoginReturnPath("committee", "/committee/check-in/")).toBe("/committee/check-in");
    expect(portalLoginReturnPath("ustadz", "/portal/ruang-asatidz/pesan/00000000-0000-4000-8000-000000000001")).toBe("/portal/ruang-asatidz/pesan/00000000-0000-4000-8000-000000000001");
  });

  it("rejects cross-portal and external redirects", () => {
    for (const from of ["//evil.example", "https://evil.example", "/portal/events", "/admin/../portal", "/admin\\evil", "/admin?next=evil", "/admin%2Fevil"]) {
      expect(portalLoginReturnPath("admin", from)).toBeNull();
    }
  });
});
