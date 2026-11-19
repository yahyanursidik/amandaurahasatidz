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

  it("preserves an event and session filter only for the Asatidz materials route", () => {
    const event = "00000000-0000-4000-8000-000000000741";
    const session = "00000000-0000-4000-8000-000000000761";
    const scope = `/portal/materials?event=${event}`;
    expect(portalLoginReturnPath("ustadz", scope)).toBe(scope);
    expect(portalLoginReturnPath("ustadz", `${scope}&session=${session}`)).toBe(`${scope}&session=${session}`);
    for (const path of [`${scope}&next=//example.org`, `${scope}&event=${event}`, `/portal/materials?event=invalid`, `${scope}#abc`]) {
      expect(portalLoginReturnPath("ustadz", path)).toBeNull();
    }
    expect(portalLoginReturnPath("committee", scope)).toBeNull();
  });
});
