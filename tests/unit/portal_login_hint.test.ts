import { describe, expect, it } from "vitest";
import { portalLoginHint } from "../../src/lib/portalLoginHint";

describe("safe login portal recommendations", () => {
  it("links the authenticated wrong-portal response only to the expected local portal", () => {
    expect(portalLoginHint({ details: { recommendedPortal: "committee", loginPath: "/login/committee" } }, "admin"))
      .toEqual({ path: "/login/committee", label: "Portal Panitia" });
  });
  it.each([null, {}, { details: null }, { details: { recommendedPortal: "owner", loginPath: "/login/admin" } },
    { details: { recommendedPortal: "committee", loginPath: "https://other.invalid/login/committee" } },
    { details: { recommendedPortal: "committee", loginPath: "/login/committee?password=secret" } },
    { details: { recommendedPortal: "committee", loginPath: "/login/admin" } }])("rejects an unsafe or absent recommendation: %j", (error) => {
      expect(portalLoginHint(error, "admin")).toBeNull();
    });
  it("does not recommend returning to the same portal", () => {
    expect(portalLoginHint({ details: { recommendedPortal: "committee", loginPath: "/login/committee" } }, "committee")).toBeNull();
  });
});
