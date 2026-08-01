import { describe, expect, it } from "vitest";
import { canAccessPortal, homeForAssignments, portalForPath } from "../../src/components/common/ProtectedRoute";

describe("portal role guard", () => {
  it("maps protected routes to their portal", () => {
    expect(portalForPath("/admin/events")).toBe("admin");
    expect(portalForPath("/committee/check-in")).toBe("committee");
    expect(portalForPath("/portal/attendance")).toBe("ustadz");
  });

  it("prevents a participant role from entering the admin portal", () => {
    const assignments = [{ roleCode: "USTADZ" }];
    expect(canAccessPortal(assignments, "admin")).toBe(false);
    expect(canAccessPortal(assignments, "ustadz")).toBe(true);
    expect(homeForAssignments(assignments)).toBe("/portal");
  });

  it("routes committee and admin roles to their own workspaces", () => {
    expect(homeForAssignments([{ roleCode: "CHECKIN_OFFICER" }])).toBe("/committee");
    expect(homeForAssignments([{ roleCode: "SUPER_ADMIN" }])).toBe("/admin");
  });
});
