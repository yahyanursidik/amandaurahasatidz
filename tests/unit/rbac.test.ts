import { describe, it, expect } from "vitest";
import { evaluatePermission, UserContext } from "../../netlify/functions/lib/middleware/rbac";

describe("RBAC Evaluation Unit Tests", () => {
  it("should allow SUPER_ADMIN full global permissions", () => {
    const user: UserContext = {
      userId: "user-super-1",
      email: "super@yts.or.id",
      assignments: [{ roleCode: "SUPER_ADMIN" }],
    };

    expect(evaluatePermission(user, { action: "events.read" })).toBe(true);
    expect(evaluatePermission(user, { action: "events.archive" })).toBe(true);
    expect(evaluatePermission(user, { action: "audit.read" })).toBe(true);
  });

  it("should enforce event scope for EVENT_ADMIN", () => {
    const user: UserContext = {
      userId: "user-event-admin-1",
      email: "eventadmin@yts.or.id",
      assignments: [
        {
          roleCode: "EVENT_ADMIN",
          eventId: "event-uuid-100",
        },
      ],
    };

    // Allowed on event-uuid-100
    expect(evaluatePermission(user, { action: "events.update", eventId: "event-uuid-100" })).toBe(true);

    // Denied on event-uuid-200
    expect(evaluatePermission(user, { action: "events.update", eventId: "event-uuid-200" })).toBe(false);
  });

  it("should restrict CHECKIN_OFFICER permissions", () => {
    const user: UserContext = {
      userId: "user-checkin-1",
      email: "checkin@yts.or.id",
      assignments: [
        {
          roleCode: "CHECKIN_OFFICER",
          eventId: "event-uuid-100",
        },
      ],
    };

    expect(evaluatePermission(user, { action: "attendance.record", eventId: "event-uuid-100" })).toBe(true);
    expect(evaluatePermission(user, { action: "events.archive", eventId: "event-uuid-100" })).toBe(false);
  });
});
