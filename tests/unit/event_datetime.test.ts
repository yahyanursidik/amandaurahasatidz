import { describe, expect, it } from "vitest";
import { eventTimezoneLabel, formatEventDate, formatEventDateTime, formatEventTime, fromEventIso, toEventIso } from "../../src/lib/eventDateTime";

describe("event-local time", () => {
  it.each([
    ["Asia/Jakarta", "WIB", "2026-11-07T01:00:00.000Z"],
    ["Asia/Makassar", "WITA", "2026-11-07T00:00:00.000Z"],
    ["Asia/Jayapura", "WIT", "2026-11-06T23:00:00.000Z"],
  ])("keeps 08:00 in %s when saving and editing", (timezone, label, iso) => {
    expect(eventTimezoneLabel(timezone)).toBe(label);
    expect(toEventIso("2026-11-07T08:00", timezone)).toBe(iso);
    expect(fromEventIso(iso, timezone)).toBe("2026-11-07T08:00");
    expect(formatEventTime(iso, timezone)).toContain("08");
    expect(formatEventDateTime(iso, timezone)).toContain("08");
  });

  it("keeps optional deadlines empty", () => {
    expect(toEventIso("", "Asia/Jakarta")).toBeNull();
    expect(fromEventIso(null, "Asia/Jakarta")).toBe("");
  });

  it("keeps date-only values stable across local computer timezones", () => {
    expect(formatEventDate("2026-11-07")).toContain("7 Nov 2026");
  });
});
