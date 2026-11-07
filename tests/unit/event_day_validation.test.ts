import { describe, expect, it } from "vitest";
import { updateEventDaySchema } from "../../netlify/functions/lib/validations/eventValidation";

describe("editing an event day", () => {
  it("accepts a title or check-in window without requiring a new date", () => {
    expect(updateEventDaySchema.safeParse({ title: "Hari kedua" }).success).toBe(true);
    expect(updateEventDaySchema.safeParse({ checkinCloseAt: null }).success).toBe(true);
  });

  it("rejects an empty edit or invalid day number", () => {
    expect(updateEventDaySchema.safeParse({}).success).toBe(false);
    expect(updateEventDaySchema.safeParse({ dayNumber: 0 }).success).toBe(false);
  });
});
