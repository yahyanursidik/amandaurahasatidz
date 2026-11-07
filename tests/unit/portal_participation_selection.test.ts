import { describe, expect, it } from "vitest";
import { choosePortalParticipationId, type PortalParticipationChoice } from "../../src/lib/portalParticipation";
import { portalNavItems } from "../../src/components/layouts/PortalLayout";

const entry = (participantId: string, startDate: string, endDate = startDate, overrides: Partial<PortalParticipationChoice> = {}): PortalParticipationChoice => ({
  participantId, startDate, endDate, eventStatus: "PUBLISHED", confirmationStatus: "CONFIRMED", ...overrides,
});

describe("portal event context", () => {
  it("chooses the ongoing event before later future programs", () => {
    const items = [entry("far-future", "2027-10-01"), entry("ongoing", "2026-11-06", "2026-11-08")];
    expect(choosePortalParticipationId(items, null, "2026-11-07")).toBe("ongoing");
  });

  it("chooses the nearest upcoming event and preserves an explicit valid selection", () => {
    const items = [entry("later", "2027-03-01"), entry("next", "2026-12-01")];
    expect(choosePortalParticipationId(items, null, "2026-11-07")).toBe("next");
    expect(choosePortalParticipationId(items, "later", "2026-11-07")).toBe("later");
  });

  it("ignores a stale selection and cancelled participation", () => {
    const items = [entry("cancelled", "2026-11-08", "2026-11-08", { confirmationStatus: "CANCELLED" }), entry("valid", "2026-12-01")];
    expect(choosePortalParticipationId(items, "cancelled", "2026-11-07")).toBe("valid");
    expect(choosePortalParticipationId([], "stale", "2026-11-07")).toBe("");
  });

  it("puts status and QR before secondary modules on mobile", () => {
    expect(portalNavItems.filter((item) => item.mobilePrimary).slice(0, 4).map((item) => item.href))
      .toEqual(["/portal", "/portal/invitations", "/portal/qr", "/portal/schedule"]);
  });
});
