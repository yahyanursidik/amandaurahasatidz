import { describe, it, expect } from "vitest";
import {
  evaluatePermission,
  requireAuth,
  requirePermission,
  requireEventScope,
  requireInstitutionScope,
  UserContext,
} from "../../netlify/functions/lib/middleware/rbac";

describe("RBAC Authorization Matrix & Security Guards Unit Tests", () => {
  const eventIdA = "event-uuid-1111";
  const eventIdB = "event-uuid-2222";
  const instIdA = "inst-uuid-1111";
  const instIdB = "inst-uuid-2222";

  it("Kasus 1: Role benar, Event salah -> Must Deny (false / 403)", () => {
    const user: UserContext = {
      userId: "user-panitia-event-A",
      email: "panitia.eventa@yts.or.id",
      assignments: [
        {
          roleCode: "CHECKIN_OFFICER",
          eventId: eventIdA,
        },
      ],
    };

    // Correct role (CHECKIN_OFFICER can record attendance) on eventIdA -> Allowed
    expect(evaluatePermission(user, { action: "attendance.record", eventId: eventIdA })).toBe(true);

    // Same role on eventIdB (wrong event scope) -> Denied
    expect(evaluatePermission(user, { action: "attendance.record", eventId: eventIdB })).toBe(false);
    expect(() => requireEventScope(user, eventIdB)).toThrowError(/tidak ditugaskan pada event daurah ini/);
  });

  it("Kasus 2: Role salah, Event benar -> Must Deny (false / 403)", () => {
    const user: UserContext = {
      userId: "user-info-officer-event-A",
      email: "info.eventa@yts.or.id",
      assignments: [
        {
          roleCode: "INFORMATION_OFFICER", // INFORMATION_OFFICER cannot approve participants
          eventId: eventIdA,
        },
      ],
    };

    // Correct eventIdA, but wrong role code for participant approval -> Denied
    expect(evaluatePermission(user, { action: "participants.approve", eventId: eventIdA })).toBe(false);
    expect(() => requirePermission(user, "participants.approve", eventIdA)).toThrowError(/Akses ditolak/);
  });

  it("Kasus 3: Assignment kedaluwarsa -> Must Deny (false / 403)", () => {
    const pastDate = new Date(Date.now() - 86400000); // Yesterday
    const user: UserContext = {
      userId: "user-expired-assignment",
      email: "expired.officer@yts.or.id",
      assignments: [
        {
          roleCode: "EVENT_ADMIN",
          eventId: eventIdA,
          endsAt: pastDate, // Assignment expired
        },
      ],
    };

    expect(evaluatePermission(user, { action: "events.update", eventId: eventIdA })).toBe(false);
    expect(() => requirePermission(user, "events.update", eventIdA)).toThrowError(/Akses ditolak/);
  });

  it("Kasus 4: Super Admin -> Must Allow (true across all events & resources)", () => {
    const user: UserContext = {
      userId: "user-superadmin",
      email: "superadmin@yts.or.id",
      assignments: [{ roleCode: "SUPER_ADMIN" }],
    };

    expect(evaluatePermission(user, { action: "events.archive", eventId: eventIdA })).toBe(true);
    expect(evaluatePermission(user, { action: "events.archive", eventId: eventIdB })).toBe(true);
    expect(evaluatePermission(user, { action: "audit.read" })).toBe(true);

    expect(() => requireEventScope(user, eventIdB)).not.toThrow();
    expect(() => requireInstitutionScope(user, instIdB)).not.toThrow();
  });

  it("Kasus 5: Perwakilan Lembaga lain -> Must Deny (false / 403 for other institution)", () => {
    const user: UserContext = {
      userId: "user-rep-inst-A",
      email: "rep.insta@yts.or.id",
      assignments: [
        {
          roleCode: "INSTITUTION_REPRESENTATIVE",
          institutionId: instIdA,
        },
      ],
    };

    // Access to instIdA -> Allowed
    expect(evaluatePermission(user, { action: "participants.create", institutionId: instIdA })).toBe(true);
    expect(() => requireInstitutionScope(user, instIdA)).not.toThrow();

    // Access to instIdB (other institution) -> Denied
    expect(evaluatePermission(user, { action: "participants.create", institutionId: instIdB })).toBe(false);
    expect(() => requireInstitutionScope(user, instIdB)).toThrowError(/tidak memiliki wewenang untuk mengelola lembaga ini/);
  });
});
