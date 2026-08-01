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

  it("allows a committee lead to complete participant operations in its event", () => {
    const user: UserContext = {
      userId: "user-committee-lead-1",
      email: "lead@yts.or.id",
      assignments: [{ roleCode: "COMMITTEE_LEAD", eventId: "event-uuid-100" }],
    };

    expect(evaluatePermission(user, { action: "participants.read", eventId: "event-uuid-100" })).toBe(true);
    expect(evaluatePermission(user, { action: "participants.approve", eventId: "event-uuid-100" })).toBe(true);
    expect(evaluatePermission(user, { action: "participants.waitlist", eventId: "event-uuid-100" })).toBe(true);
    expect(evaluatePermission(user, { action: "participants.cancel", eventId: "event-uuid-100" })).toBe(true);
    expect(evaluatePermission(user, { action: "participants.approve", eventId: "event-uuid-200" })).toBe(false);
  });

  it("supports the explicit all-events scope used only by local demo sessions", () => {
    const user: UserContext = {
      userId: "local-committee-demo",
      email: "panitia@yts.or.id",
      assignments: [{ roleCode: "COMMITTEE_LEAD", eventId: "*" }],
    };

    expect(evaluatePermission(user, { action: "participants.read", eventId: "event-uuid-100" })).toBe(true);
    expect(evaluatePermission(user, { action: "participants.approve", eventId: "event-uuid-200" })).toBe(true);
  });
});
