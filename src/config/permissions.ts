export type GlobalRole =
  | "SUPER_ADMIN"
  | "SYSTEM_ADMIN"
  | "DATA_STEWARD"
  | "REPORT_VIEWER";

export type EventScopedRole =
  | "EVENT_ADMIN"
  | "COMMITTEE_LEAD"
  | "REGISTRATION_OFFICER"
  | "CHECKIN_OFFICER"
  | "INFORMATION_OFFICER"
  | "EVENT_VIEWER";

export type ExternalRole =
  | "USTADZ"
  | "INSTITUTION_REPRESENTATIVE";

export type RoleCode = GlobalRole | EventScopedRole | ExternalRole;

export type PermissionCode =
  | "events.read"
  | "events.create"
  | "events.update"
  | "events.publish"
  | "events.cancel"
  | "events.archive"
  | "institutions.read"
  | "institutions.create"
  | "institutions.update"
  | "institutions.merge"
  | "ustadz.read"
  | "ustadz.create"
  | "ustadz.update"
  | "ustadz.merge"
  | "invitations.read"
  | "invitations.create"
  | "invitations.send"
  | "invitations.revoke"
  | "participants.read"
  | "participants.create"
  | "participants.update"
  | "participants.approve"
  | "participants.waitlist"
  | "participants.cancel"
  | "participants.replace"
  | "participants.export"
  | "schedule.read"
  | "schedule.manage"
  | "announcements.read"
  | "announcements.manage"
  | "announcements.publish"
  | "attendance.read"
  | "attendance.record"
  | "attendance.correct"
  | "attendance.export"
  | "email.read"
  | "email.manage_templates"
  | "email.send"
  | "email.retry"
  | "users.read"
  | "users.manage"
  | "roles.manage"
  | "reports.read"
  | "reports.export"
  | "audit.read"
  | "settings.manage";

export const ROLE_PERMISSIONS: Record<RoleCode, PermissionCode[]> = {
  SUPER_ADMIN: [
    "events.read", "events.create", "events.update", "events.publish", "events.cancel", "events.archive",
    "institutions.read", "institutions.create", "institutions.update", "institutions.merge",
    "ustadz.read", "ustadz.create", "ustadz.update", "ustadz.merge",
    "invitations.read", "invitations.create", "invitations.send", "invitations.revoke",
    "participants.read", "participants.create", "participants.update", "participants.approve", "participants.waitlist", "participants.cancel", "participants.replace", "participants.export",
    "schedule.read", "schedule.manage",
    "announcements.read", "announcements.manage", "announcements.publish",
    "attendance.read", "attendance.record", "attendance.correct", "attendance.export",
    "email.read", "email.manage_templates", "email.send", "email.retry",
    "users.read", "users.manage", "roles.manage",
    "reports.read", "reports.export",
    "audit.read", "settings.manage"
  ],
  SYSTEM_ADMIN: [
    "events.read", "events.create", "events.update",
    "institutions.read", "institutions.create", "institutions.update",
    "ustadz.read", "ustadz.create", "ustadz.update",
    "users.read", "users.manage", "roles.manage",
    "audit.read", "settings.manage"
  ],
  DATA_STEWARD: [
    "institutions.read", "institutions.create", "institutions.update", "institutions.merge",
    "ustadz.read", "ustadz.create", "ustadz.update", "ustadz.merge",
    "reports.read"
  ],
  REPORT_VIEWER: [
    "events.read", "institutions.read", "ustadz.read", "participants.read", "attendance.read", "reports.read", "reports.export"
  ],
  EVENT_ADMIN: [
    "events.read", "events.update", "events.publish",
    "invitations.read", "invitations.create", "invitations.send", "invitations.revoke",
    "participants.read", "participants.create", "participants.update", "participants.approve", "participants.waitlist", "participants.cancel", "participants.replace", "participants.export",
    "schedule.read", "schedule.manage",
    "announcements.read", "announcements.manage", "announcements.publish",
    "attendance.read", "attendance.record", "attendance.correct", "attendance.export",
    "reports.read", "reports.export", "audit.read"
  ],
  COMMITTEE_LEAD: [
    "events.read", "participants.read", "schedule.read", "schedule.manage",
    "announcements.read", "announcements.manage", "announcements.publish",
    "attendance.read", "attendance.record", "reports.read"
  ],
  REGISTRATION_OFFICER: [
    "events.read", "participants.read", "participants.create", "participants.update", "attendance.read", "attendance.record"
  ],
  CHECKIN_OFFICER: [
    "events.read", "participants.read", "attendance.read", "attendance.record"
  ],
  INFORMATION_OFFICER: [
    "events.read", "schedule.read", "announcements.read", "announcements.manage"
  ],
  EVENT_VIEWER: [
    "events.read", "schedule.read", "announcements.read", "reports.read"
  ],
  USTADZ: [
    "events.read", "schedule.read", "announcements.read", "attendance.read"
  ],
  INSTITUTION_REPRESENTATIVE: [
    "events.read", "invitations.read", "participants.read", "participants.create", "participants.update"
  ]
};
