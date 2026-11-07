import { describe, expect, it } from "vitest";
import { getPendingReviewHref } from "../../src/pages/admin/AdminDashboardPage";

describe("admin dashboard work links", () => {
  it("opens pending participants for the event that needs review", () => {
    expect(getPendingReviewHref("7b62644d-91ee-43cf-b7c3-0514657fc01c"))
      .toBe("/admin/events/7b62644d-91ee-43cf-b7c3-0514657fc01c/registrations?view=participants&status=PENDING_REVIEW");
  });

  it("falls back to the event catalog when no event is identified", () => {
    expect(getPendingReviewHref(null)).toBe("/admin/events");
  });
});
