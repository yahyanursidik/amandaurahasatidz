import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ROLE_PERMISSIONS } from "../../src/config/permissions";
import { canAccessPortal, homeForAssignments } from "../../src/components/common/ProtectedRoute";
import { ParticipantManagementDialog } from "../../src/components/participants/ParticipantManagementDialog";
import { COMMITTEE_ACCOUNT_ROLES, COMMITTEE_ROLES } from "../../src/lib/committeeApi";
import { isCommitteeOrganizerOnly } from "../../src/lib/committeeOrganizerAccess";
import { hasCommunicationPermission } from "../../src/lib/eventCommunications";
import { availableParticipantCommands, participantStaffPermissions } from "../../src/lib/participantManagement";
import { participantResolutionHint } from "../../src/lib/participantResolution";
import { evaluatePermission, readableEventIds, requireGlobalPermission, requireReportAccess, type UserContext } from "../../netlify/functions/lib/middleware/rbac";
import { committeeDashboardQuerySchema, createCommitteeMemberSchema } from "../../netlify/functions/lib/validations/committeeValidation";

const firstEvent = "00000000-0000-4000-8000-000000000001";
const otherEvent = "00000000-0000-4000-8000-000000000002";
const user: UserContext = { userId: "admin-panitia", email: "panitia@example.test", assignments: [
  { roleCode: "COMMITTEE_ADMIN", eventId: firstEvent },
] };
const participant = { id: "p1", name: "Ustadz Ahmad", participantCode: "P-001",
  approvalStatus: "APPROVED", confirmationStatus: "CONFIRMED" };

describe("Admin Panitia Event", () => {
  it("can enter only the committee portal and receives operational permissions for its event", () => {
    expect(COMMITTEE_ROLES.find((role) => role.value === "COMMITTEE_ADMIN")?.label).toBe("Admin Panitia Event");
    expect(canAccessPortal([{ roleCode: "COMMITTEE_ADMIN", eventId: firstEvent }], "committee")).toBe(true);
    expect(canAccessPortal([{ roleCode: "COMMITTEE_ADMIN", eventId: firstEvent }], "admin")).toBe(false);
    for (const action of ["participants.read", "participants.approve", "participants.waitlist",
      "participants.cancel", "participants.replace", "participants.manage_portal_access"] as const) {
      expect(evaluatePermission(user, { action, eventId: firstEvent })).toBe(true);
      expect(evaluatePermission(user, { action, eventId: otherEvent })).toBe(false);
    }
    for (const action of ["events.update", "attendance.record", "users.manage", "email.send"] as const) {
      expect(ROLE_PERMISSIONS.COMMITTEE_ADMIN).not.toContain(action);
      expect(evaluatePermission(user, { action, eventId: firstEvent })).toBe(false);
    }
    expect(readableEventIds(user)).toEqual([firstEvent]);
  });

  it("denies future and expired assignments, but supports a global admin", () => {
    const future: UserContext = { ...user, assignments: [{ ...user.assignments[0], startsAt: new Date("2099-01-01") }] };
    const expired: UserContext = { ...user, assignments: [{ ...user.assignments[0], endsAt: new Date("2000-01-01") }] };
    for (const inactive of [future, expired]) {
      expect(readableEventIds(inactive)).toEqual([]);
      expect(evaluatePermission(inactive, { action: "participants.approve", eventId: firstEvent })).toBe(false);
    }
    expect(canAccessPortal([{ roleCode: "COMMITTEE_ADMIN", eventId: firstEvent, startsAt: "2099-01-01" }], "committee")).toBe(false);
    expect(canAccessPortal([{ roleCode: "COMMITTEE_ADMIN", eventId: firstEvent, endsAt: "2000-01-01" }], "committee")).toBe(false);
    expect(readableEventIds({ ...user, assignments: [{ roleCode: "SUPER_ADMIN" }] })).toBeNull();
  });

  it("validates a scoped account and requires an event for committee metrics", () => {
    expect(createCommitteeMemberSchema.safeParse({ name: "Admin Panitia", email: "panitia@example.test",
      password: "password-kuat", status: "ACTIVE", eventId: firstEvent, committeeRole: "COMMITTEE_ADMIN" }).success).toBe(true);
    expect(createCommitteeMemberSchema.safeParse({ name: "Admin Panitia", email: "panitia@example.test",
      password: "password-kuat", status: "ACTIVE", committeeRole: "COMMITTEE_ADMIN" }).success).toBe(false);
    expect(committeeDashboardQuerySchema.safeParse({}).success).toBe(false);
    expect(committeeDashboardQuerySchema.safeParse({ eventId: firstEvent }).success).toBe(true);
  });

  it("offers the actual resolution actions, including replacement, only for the assigned event", () => {
    const permissions = participantStaffPermissions(user.assignments, firstEvent);
    expect(availableParticipantCommands(participant, permissions)).toContain("replace");
    expect(availableParticipantCommands(participant, participantStaffPermissions(user.assignments, otherEvent))).toEqual([]);
    const html = renderToStaticMarkup(<ParticipantManagementDialog eventId={firstEvent} participant={participant}
      permissions={permissions} onlyActions={["replace"]} onCompleted={() => {}} />);
    expect(html).toContain("Ganti asatidz");
    expect(participantResolutionHint({ approvalStatus: "PENDING_REVIEW", confirmationStatus: "INVITED",
      contactComplete: true }).title).toBe("Perlu keputusan");
    expect(participantResolutionHint({ approvalStatus: "APPROVED", confirmationStatus: "INVITED",
      contactComplete: true }).title).toBe("Menunggu konfirmasi hadir");
    expect(participantResolutionHint({ approvalStatus: "DECLINED", confirmationStatus: "INVITED",
      contactComplete: true }).title).toBe("Pendaftaran ditolak");
  });
});

describe("Admin Panitia Semua Event", () => {
  const organizer: UserContext = { ...user, assignments: [{ roleCode: "COMMITTEE_ORGANIZER", eventId: null }] };
  const portalAssignments = [{ roleCode: "COMMITTEE_ORGANIZER", eventId: null }];

  it("can create and manage every event without an individual assignment", () => {
    expect(COMMITTEE_ACCOUNT_ROLES.find((role) => role.value === "COMMITTEE_ORGANIZER")?.label)
      .toBe("Admin Panitia Semua Event");
    for (const action of ["events.create", "events.update", "events.publish", "events.cancel",
      "invitations.create", "participants.approve", "schedule.manage", "attendance.record", "reports.read"] as const) {
      expect(evaluatePermission(organizer, { action, eventId: firstEvent })).toBe(true);
      expect(evaluatePermission(organizer, { action, eventId: otherEvent })).toBe(true);
    }
    expect(evaluatePermission(organizer, { action: "events.create" })).toBe(true);
    expect(readableEventIds(organizer)).toBeNull();
    expect(canAccessPortal(portalAssignments, "admin")).toBe(true);
    expect(canAccessPortal(portalAssignments, "committee")).toBe(true);
    expect(isCommitteeOrganizerOnly(portalAssignments)).toBe(true);
    expect(homeForAssignments(portalAssignments)).toBe("/admin/events");
    expect(homeForAssignments([...portalAssignments, { roleCode: "EVENT_ADMIN", eventId: firstEvent }]))
      .toBe("/admin/events");
    expect(hasCommunicationPermission({ effectivePermissions: ["announcements.manage"],
      assignments: [{ roleCode: "COMMITTEE_ORGANIZER", eventId: null }] }, otherEvent, "announcements.manage")).toBe(true);
  });

  it("does not inherit account administration, audit, archive, or unscoped reports", () => {
    for (const action of ["users.manage", "roles.manage", "audit.read", "events.archive"] as const) {
      expect(evaluatePermission(organizer, { action, eventId: firstEvent })).toBe(false);
    }
    expect(() => requireGlobalPermission(organizer, "reports.read")).toThrow();
    expect(() => requireReportAccess(organizer, "reports.read", "no-show")).toThrow();
    expect(() => requireReportAccess(organizer, "reports.read", "demographics", firstEvent)).toThrow();
    expect(() => requireReportAccess(organizer, "reports.read", "no-show", firstEvent)).not.toThrow();
    expect(() => requireReportAccess(organizer, "reports.read", "no-show", otherEvent)).not.toThrow();
  });

  it("can be created without an event but cannot make an old per-event role global", () => {
    const account = { name: "Admin Seluruh Event", email: "semua@example.test",
      password: "password-kuat", status: "ACTIVE" };
    expect(createCommitteeMemberSchema.safeParse({ ...account, committeeRole: "COMMITTEE_ORGANIZER" }).success).toBe(true);
    expect(createCommitteeMemberSchema.safeParse({ ...account, committeeRole: "COMMITTEE_ADMIN" }).success).toBe(false);
    expect(evaluatePermission({ ...user, assignments: [{ roleCode: "COMMITTEE_ADMIN", eventId: null }] },
      { action: "participants.approve", eventId: firstEvent })).toBe(false);
    expect(isCommitteeOrganizerOnly([{ roleCode: "COMMITTEE_ORGANIZER", eventId: firstEvent }])).toBe(false);
  });
});
