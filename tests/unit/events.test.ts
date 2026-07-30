import { describe, it, expect } from "vitest";
import { getNextEventStatus } from "../../netlify/functions/lib/services/eventStateService";
import { createEventSchema, createEventDaySchema, createEventSessionSchema } from "../../netlify/functions/lib/validations/eventValidation";

describe("Event, Sesi & State Transition Machine Unit Tests", () => {
  it("should allow legal state machine transition alur: DRAFT -> PUBLISHED -> REGISTRATION_OPEN -> REGISTRATION_CLOSED -> ONGOING -> COMPLETED -> ARCHIVED", () => {
    expect(getNextEventStatus("DRAFT", "PUBLISH")).toBe("PUBLISHED");
    expect(getNextEventStatus("PUBLISHED", "OPEN_REGISTRATION")).toBe("REGISTRATION_OPEN");
    expect(getNextEventStatus("REGISTRATION_OPEN", "CLOSE_REGISTRATION")).toBe("REGISTRATION_CLOSED");
    expect(getNextEventStatus("REGISTRATION_CLOSED", "START_EVENT")).toBe("ONGOING");
    expect(getNextEventStatus("ONGOING", "COMPLETE_EVENT")).toBe("COMPLETED");
    expect(getNextEventStatus("COMPLETED", "ARCHIVE")).toBe("ARCHIVED");
  });

  it("should reject illegal state machine transition jumps (e.g. DRAFT -> COMPLETE_EVENT)", () => {
    expect(() => getNextEventStatus("DRAFT", "COMPLETE_EVENT")).toThrowError(/Transisi ilegal/);
    expect(() => getNextEventStatus("COMPLETED", "START_EVENT")).toThrowError(/Transisi ilegal/);
  });

  it("should allow cancellation from early active states", () => {
    expect(getNextEventStatus("DRAFT", "CANCEL")).toBe("CANCELLED");
    expect(getNextEventStatus("PUBLISHED", "CANCEL")).toBe("CANCELLED");
    expect(getNextEventStatus("REGISTRATION_OPEN", "CANCEL")).toBe("CANCELLED");
  });

  it("should validate createEventSchema payload with timezone and dates", () => {
    const payload = {
      code: "DAURAH-2026-BDG",
      slug: "daurah-2026-bandung",
      name: "Daurah Asatidz Nasional 2026",
      timezone: "Asia/Jakarta",
      startDate: "2026-08-15",
      endDate: "2026-08-18",
      venueName: "Hotel Grand Asrilia Bandung",
      mapsUrl: "https://maps.google.com/?q=Bandung",
    };

    const parsed = createEventSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("should validate event session schema with checkin window", () => {
    const sessionPayload = {
      eventDayId: "00000000-0000-0000-0000-000000000001",
      title: "Sesi 1: Fiqih Dakwah",
      startAt: "2026-08-15T08:00:00Z",
      endAt: "2026-08-15T10:00:00Z",
      checkinOpenAt: "2026-08-15T07:30:00Z",
      checkinCloseAt: "2026-08-15T08:15:00Z",
      sortOrder: 1,
    };

    const parsed = createEventSessionSchema.safeParse(sessionPayload);
    expect(parsed.success).toBe(true);
  });
});
